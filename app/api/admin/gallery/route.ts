import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { projectPhotos } from '@/src/db/schema';
import {
  getSupabaseProjectUrl,
  logAdminSecurityActivity,
  validateAdminRequestSession,
} from '@/src/lib/server-auth';
import { authorizeRoleAccess } from '@/lib/zipblind-auth';
import { getOperationalSnapshot } from '@/src/lib/operational-db';
import {
  buildProjectAlbumsWithStages,
  decodePhotoCaptionMetadata,
  encodePhotoCaptionWithMetadata,
  mapDocCategoryToDbEnum,
  type DocumentationCategory,
  type GalleryPhotoItem,
  type ServiceComparePhase,
} from '@/lib/zipblind-gallery';

const STORAGE_BUCKET_NAME = 'project-photos';
const LOCAL_STORAGE_ROOT = path.join(process.cwd(), 'public', 'storage', STORAGE_BUCKET_NAME);

async function verifyGalleryAccess(
  req: NextRequest,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
) {
  const explicitRoleHeader = req.headers.get('x-zipblind-role');
  if (explicitRoleHeader === 'executive' || explicitRoleHeader === 'technician') {
    const rbac = authorizeRoleAccess({
      role: explicitRoleHeader,
      httpMethod: method,
      targetScope:
        explicitRoleHeader === 'executive' && method !== 'GET' ? 'executive' : 'admin',
    });
    return {
      allowed: false as const,
      response: NextResponse.json(
        { error: rbac.message, code: rbac.code },
        { status: rbac.status }
      ),
    };
  }

  const authCheck = await validateAdminRequestSession(req);
  if (!authCheck.authenticated || !authCheck.admin) {
    return {
      allowed: false as const,
      response: NextResponse.json(
        { error: authCheck.message, code: authCheck.code },
        { status: authCheck.status }
      ),
    };
  }

  return {
    allowed: true as const,
    admin: authCheck.admin,
  };
}

async function buildGallerySnapshot() {
  const opSnapshot = await getOperationalSnapshot();
  const rawPhotoRows = await db
    .select()
    .from(projectPhotos)
    .orderBy(desc(projectPhotos.uploadedAt));

  const projectMap = new Map(opSnapshot.projects.map((p) => [p.id, p]));
  const activityMap = new Map(opSnapshot.activities.map((a) => [a.id, a]));

  const formattedPhotos: GalleryPhotoItem[] = rawPhotoRows
    .map((row) => {
      const proj = projectMap.get(row.projectId);
      if (!proj) return null;

      const linkedAct = row.activityId ? activityMap.get(row.activityId) : undefined;
      const decodedMeta = decodePhotoCaptionMetadata(row.category, row.caption);

      // Tentukan jenis aktivitas dari aktivitas yang terhubung atau dari kategori dokumentasi
      const resolvedActivityType = linkedAct
        ? linkedAct.activityType
        : decodedMeta.documentationCategory === 'Pengukuran'
        ? 'Pengukuran'
        : decodedMeta.documentationCategory === 'Persiapan'
        ? 'Persiapan'
        : decodedMeta.documentationCategory === 'Survey'
        ? 'Survey'
        : decodedMeta.documentationCategory === 'Pengiriman'
        ? 'Pengiriman'
        : decodedMeta.documentationCategory === 'Service sebelum dan sesudah'
        ? 'Service'
        : 'Pemasangan';

      const imageUrl = `/api/admin/gallery/download/${row.id}`;
      const downloadUrl = `/api/admin/gallery/download/${row.id}?download=1`;

      return {
        id: row.id,
        projectId: proj.id,
        projectCode: proj.projectCode,
        projectTitle: proj.title,
        projectStatus: proj.status,
        customerId: proj.customerId,
        customerName: proj.customerName,
        customerCity: proj.customerCity,
        installationAddress: proj.installationAddress,
        activityId: linkedAct?.id || null,
        activityCode: linkedAct?.activityCode || null,
        activityType: resolvedActivityType,
        activityTitle:
          linkedAct?.title ||
          `Tahap ${decodedMeta.documentationCategory} — ${proj.title}`,
        activityDate: linkedAct?.startDate || proj.startDate || '2026-11-10',
        activityStatus: linkedAct?.status || proj.status,
        productName: linkedAct?.productName || proj.primaryProductName || 'Zipblind',
        quantitySets: linkedAct?.quantitySets || proj.totalQuantitySets || 1,
        documentationCategory: decodedMeta.documentationCategory,
        servicePhase: decodedMeta.servicePhase,
        storageBucket: row.storageBucket,
        storagePath: row.storagePath,
        fileName: row.fileName,
        mimeType: row.mimeType || 'image/png',
        fileSizeBytes: Number(row.fileSizeBytes || 0),
        caption:
          decodedMeta.cleanCaption ||
          `${decodedMeta.documentationCategory} — ${proj.title}`,
        imageUrl,
        downloadUrl,
        uploadedAt: row.uploadedAt.toISOString(),
      };
    })
    .filter((item): item is GalleryPhotoItem => item !== null);

  const albums = buildProjectAlbumsWithStages(opSnapshot.projects, formattedPhotos);

  return {
    photos: formattedPhotos,
    albums,
    projects: opSnapshot.projects,
    activities: opSnapshot.activities,
    customers: opSnapshot.customers,
    products: opSnapshot.products,
  };
}

export async function GET(req: NextRequest) {
  const access = await verifyGalleryAccess(req, 'GET');
  if (!access.allowed) return access.response;

  const snapshot = await buildGallerySnapshot();
  return NextResponse.json(snapshot, { status: 200 });
}

export async function POST(req: NextRequest) {
  const access = await verifyGalleryAccess(req, 'POST');
  if (!access.allowed) return access.response;

  try {
    const contentType = req.headers.get('content-type') || '';

    let projectId = '';
    let activityId: string | null = null;
    let documentationCategory: DocumentationCategory = 'Hasil akhir';
    let servicePhase: ServiceComparePhase = 'Normal';
    let caption = '';
    let fileName = '';
    let mimeType = 'image/png';
    let fileBuffer: Buffer | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      projectId = String(formData.get('projectId') || '').trim();
      const rawActId = String(formData.get('activityId') || '').trim();
      activityId = rawActId && rawActId !== 'NONE' ? rawActId : null;
      documentationCategory = (String(
        formData.get('documentationCategory') || 'Hasil akhir'
      ).trim() as DocumentationCategory);
      servicePhase = (String(
        formData.get('servicePhase') || 'Normal'
      ).trim() as ServiceComparePhase);
      caption = String(formData.get('caption') || '').trim();

      const uploadedFile = formData.get('file');
      if (uploadedFile && typeof uploadedFile === 'object' && 'arrayBuffer' in uploadedFile) {
        const arrayBuf = await uploadedFile.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuf);
        fileName = (uploadedFile as File).name || `foto-proyek-${Date.now()}.png`;
        mimeType = (uploadedFile as File).type || 'image/png';
      }
    } else {
      const body = await req.json();
      projectId = String(body.projectId || '').trim();
      const rawActId = String(body.activityId || '').trim();
      activityId = rawActId && rawActId !== 'NONE' ? rawActId : null;
      documentationCategory = (body.documentationCategory ||
        'Hasil akhir') as DocumentationCategory;
      servicePhase = (body.servicePhase || 'Normal') as ServiceComparePhase;
      caption = String(body.caption || '').trim();
      fileName = String(body.fileName || `dokumentasi-${Date.now()}.png`).trim();
      mimeType = String(body.mimeType || 'image/png').trim();

      if (body.fileDataUrl && typeof body.fileDataUrl === 'string') {
        const commaIdx = body.fileDataUrl.indexOf(',');
        const base64Part =
          commaIdx >= 0 ? body.fileDataUrl.slice(commaIdx + 1) : body.fileDataUrl;
        fileBuffer = Buffer.from(base64Part, 'base64');
      } else if (body.fileBase64 && typeof body.fileBase64 === 'string') {
        const commaIdx = body.fileBase64.indexOf(',');
        const base64Part =
          commaIdx >= 0 ? body.fileBase64.slice(commaIdx + 1) : body.fileBase64;
        fileBuffer = Buffer.from(base64Part, 'base64');
      }
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Proyek wajib dipilih sebelum mengunggah foto dokumentasi.' },
        { status: 400 }
      );
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { error: 'File foto wajib disertakan untuk diunggah.' },
        { status: 400 }
      );
    }

    // Dukung baik UUID maupun projectCode / activityCode
    const opSnap = await getOperationalSnapshot();
    const matchedProj = opSnap.projects.find(
      (p) => p.id === projectId || p.projectCode === projectId
    );
    if (!matchedProj) {
      return NextResponse.json(
        { error: 'Proyek tidak ditemukan di database.' },
        { status: 404 }
      );
    }
    projectId = matchedProj.id;

    if (activityId) {
      const matchedAct = opSnap.activities.find(
        (a) => a.id === activityId || a.activityCode === activityId
      );
      activityId = matchedAct ? matchedAct.id : null;
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueKey = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}-${sanitizedName}`;
    const storagePath = `${projectId}/${uniqueKey}`;
    const absoluteFilePath = path.join(LOCAL_STORAGE_ROOT, projectId, uniqueKey);

    await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await fs.writeFile(absoluteFilePath, fileBuffer);

    const supabaseServerKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (
      supabaseServerKey &&
      supabaseServerKey !== 'your-supabase-service-role-key-server-only' &&
      supabaseServerKey !== 'your-supabase-anon-key'
    ) {
      try {
        const sbUrl = getSupabaseProjectUrl();
        await fetch(
          `${sbUrl}/storage/v1/object/${STORAGE_BUCKET_NAME}/${storagePath}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${supabaseServerKey}`,
              apikey: supabaseServerKey,
              'Content-Type': mimeType,
              'x-upsert': 'true',
            },
            body: new Uint8Array(fileBuffer),
          }
        );
      } catch {
        // Local storage copy remains primary fallback if external network call fails
      }
    }

    const dbCategory = mapDocCategoryToDbEnum(documentationCategory);
    const encodedCaption = encodePhotoCaptionWithMetadata({
      documentationCategory,
      servicePhase,
      caption: caption || `${documentationCategory} (${sanitizedName})`,
    });

    const [insertedPhoto] = await db
      .insert(projectPhotos)
      .values({
        projectId,
        activityId,
        category: dbCategory,
        storageBucket: STORAGE_BUCKET_NAME,
        storagePath,
        fileName: sanitizedName,
        mimeType,
        fileSizeBytes: fileBuffer.length,
        caption: encodedCaption,
        uploadedBy: access.admin.id,
      })
      .returning();

    await logAdminSecurityActivity({
      adminId: access.admin.id,
      actionType: 'UPLOAD_PROJECT_PHOTO',
      entityName: 'project_photos',
      entityId: insertedPhoto.id,
      description: `Mengunggah foto dokumentasi "${sanitizedName}" pada kategori "${documentationCategory}"`,
      metadata: {
        projectId,
        activityId,
        documentationCategory,
        storageBucket: STORAGE_BUCKET_NAME,
        storagePath,
        fileSizeBytes: fileBuffer.length,
      },
    });

    const snapshot = await buildGallerySnapshot();
    return NextResponse.json(
      {
        message: `Foto dokumentasi "${sanitizedName}" berhasil diunggah ke dalam album proyek.`,
        photoId: insertedPhoto.id,
        storagePath: insertedPhoto.storagePath,
        created: insertedPhoto,
        snapshot,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error POST /api/admin/gallery:', err);
    return NextResponse.json(
      {
        error: 'Gagal mengunggah foto dokumentasi proyek.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const access = await verifyGalleryAccess(req, 'PATCH');
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'ID foto wajib disertakan.' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(projectPhotos)
      .where(eq(projectPhotos.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 });
    }

    const opSnap = await getOperationalSnapshot();
    const decodedOld = decodePhotoCaptionMetadata(existing.category, existing.caption);
    const nextCategory = (body.documentationCategory ||
      decodedOld.documentationCategory) as DocumentationCategory;
    const nextPhase = (body.servicePhase ||
      decodedOld.servicePhase) as ServiceComparePhase;
    const nextCaption =
      body.caption !== undefined ? String(body.caption).trim() : decodedOld.cleanCaption;

    let nextProjectId = existing.projectId;
    if (body.projectId) {
      const matchedProj = opSnap.projects.find(
        (p) => p.id === body.projectId || p.projectCode === body.projectId
      );
      if (matchedProj) nextProjectId = matchedProj.id;
    }

    let nextActivityId = existing.activityId;
    if (body.activityId !== undefined) {
      if (!body.activityId || body.activityId === 'NONE') {
        nextActivityId = null;
      } else {
        const matchedAct = opSnap.activities.find(
          (a) => a.id === body.activityId || a.activityCode === body.activityId
        );
        nextActivityId = matchedAct ? matchedAct.id : null;
      }
    }

    const [updated] = await db
      .update(projectPhotos)
      .set({
        projectId: nextProjectId,
        activityId: nextActivityId,
        category: mapDocCategoryToDbEnum(nextCategory),
        caption: encodePhotoCaptionWithMetadata({
          documentationCategory: nextCategory,
          servicePhase: nextPhase,
          caption: nextCaption,
        }),
      })
      .where(eq(projectPhotos.id, id))
      .returning();

    const snapshot = await buildGallerySnapshot();
    return NextResponse.json({
      message: 'Pengelompokan & metadata foto dokumentasi berhasil diperbarui.',
      updated,
      snapshot,
    });
  } catch (err) {
    console.error('Error PATCH /api/admin/gallery:', err);
    return NextResponse.json(
      { error: 'Gagal memperbarui pengelompokan foto.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const access = await verifyGalleryAccess(req, 'DELETE');
  if (!access.allowed) return access.response;

  try {
    let id = String(req.nextUrl.searchParams.get('id') || '').trim();
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = String(body.id || '').trim();
    }
    if (!id) {
      return NextResponse.json({ error: 'ID foto wajib disertakan.' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(projectPhotos)
      .where(eq(projectPhotos.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 });
    }

    // Hapus file fisik dari storage bucket jika ada
    const absoluteFilePath = path.join(LOCAL_STORAGE_ROOT, existing.storagePath);
    try {
      await fs.unlink(absoluteFilePath);
    } catch {
      // Abaikan apabila file fisik sudah terhapus
    }

    await db.delete(projectPhotos).where(eq(projectPhotos.id, id));

    await logAdminSecurityActivity({
      adminId: access.admin.id,
      actionType: 'DELETE_PROJECT_PHOTO',
      entityName: 'project_photos',
      entityId: id,
      description: `Menghapus foto dokumentasi "${existing.fileName}"`,
    });

    const snapshot = await buildGallerySnapshot();
    return NextResponse.json({
      message: `Foto dokumentasi "${existing.fileName}" berhasil dihapus.`,
      snapshot,
    });
  } catch (err) {
    console.error('Error DELETE /api/admin/gallery:', err);
    return NextResponse.json(
      { error: 'Gagal menghapus foto dokumentasi.' },
      { status: 500 }
    );
  }
}
