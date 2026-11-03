import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  executiveAccessLogs,
  executiveSecretLinks,
  projectPhotos,
  reportExportLogs,
} from '@/src/db/schema';
import {
  hashSecretToken,
  isWellFormedSecretToken,
  validateSecretLinkRecord,
} from '@/lib/zipblind-auth';
import { validateAdminRequestSession } from '@/src/lib/server-auth';
import { getOperationalSnapshot } from '@/src/lib/operational-db';
import { decodePhotoCaptionMetadata } from '@/lib/zipblind-gallery';
import {
  buildExecutiveDashboardPayload,
  enforceExecutiveReadOnlyGuard,
  verifyNoAdminSecretsLeaked,
} from '@/lib/zipblind-executive';

export async function GET(req: NextRequest) {
  try {
    const rawToken =
      req.nextUrl.searchParams.get('token') ||
      req.headers.get('x-executive-token') ||
      '';
    const requestedPeriod = req.nextUrl.searchParams.get('period') || '2026-11';

    let validatedLinkMeta: {
      id: string;
      label: string;
      tokenPrefix: string;
      canDownloadReports: boolean;
      expiresAt: string;
      lastAccessedAt: string;
    } | null = null;

    if (rawToken.trim()) {
      // 1. Validasi Secret Token Pimpinan secara ketat di Backend
      if (!isWellFormedSecretToken(rawToken)) {
        return NextResponse.json(
          {
            valid: false,
            code: 'TOKEN_INVALID_FORMAT',
            message: 'Akses ditolak: Format token secret link tidak valid.',
          },
          { status: 401 }
        );
      }

      const incomingHash = hashSecretToken(rawToken);
      const [record] = await db
        .select()
        .from(executiveSecretLinks)
        .where(eq(executiveSecretLinks.tokenHash, incomingHash))
        .limit(1);

      const validation = validateSecretLinkRecord(record, rawToken, new Date());
      if (!validation.valid || !record) {
        return NextResponse.json(
          {
            valid: false,
            code: validation.code,
            message: validation.message,
          },
          { status: validation.status }
        );
      }

      const readGuard = enforceExecutiveReadOnlyGuard({
        httpMethod: 'GET',
        attemptedOperation: 'view_dashboard',
        canDownloadReports: record.canDownloadReports,
      });

      if (!readGuard.allowed) {
        return NextResponse.json(
          {
            valid: false,
            code: readGuard.code,
            message: readGuard.message,
          },
          { status: readGuard.status }
        );
      }

      const now = new Date();
      await db
        .update(executiveSecretLinks)
        .set({ lastAccessedAt: now })
        .where(eq(executiveSecretLinks.id, record.id));

      const forwardedFor = req.headers.get('x-forwarded-for');
      const ipAddress = forwardedFor
        ? forwardedFor.split(',')[0].trim().slice(0, 64)
        : '127.0.0.1';
      const userAgent = req.headers.get('user-agent') || 'ZIPBLIND-Executive-Portal';

      await db.insert(executiveAccessLogs).values({
        secretLinkId: record.id,
        accessAction: 'view_dashboard',
        ipAddress,
        userAgent,
      });

      validatedLinkMeta = {
        id: record.id,
        label: record.label,
        tokenPrefix: record.tokenPrefix,
        canDownloadReports: record.canDownloadReports,
        expiresAt: record.expiresAt.toISOString(),
        lastAccessedAt: now.toISOString(),
      };
    } else {
      // Apabila tidak menyertakan secret token di URL/header, hanya izinkan bila pratinjau oleh sesi Admin aktif
      const adminSession = await validateAdminRequestSession(req);
      if (!adminSession.authenticated || !adminSession.admin) {
        return NextResponse.json(
          {
            valid: false,
            code: 'TOKEN_MISSING',
            message:
              'Akses ditolak: Token secret link pimpinan wajib disertakan untuk membuka Dashboard Pimpinan.',
          },
          { status: 401 }
        );
      }
    }

    // 2. Muat data operasional aktual dari database PostgreSQL
    const snapshot = await getOperationalSnapshot();
    const [rawPhotos, rawExportLogs] = await Promise.all([
      db.select().from(projectPhotos).orderBy(desc(projectPhotos.uploadedAt)),
      db.select().from(reportExportLogs).orderBy(desc(reportExportLogs.exportedAt)),
    ]);

    const projectMap = new Map(snapshot.projects.map((p) => [p.id, p]));
    const activityMap = new Map(snapshot.activities.map((a) => [a.id, a]));

    const tokenQuerySuffix = rawToken.trim()
      ? `?token=${encodeURIComponent(rawToken.trim())}`
      : '';

    const formattedPhotos = rawPhotos.map((ph) => {
      const proj = projectMap.get(ph.projectId);
      const act = ph.activityId ? activityMap.get(ph.activityId) : undefined;
      const decoded = decodePhotoCaptionMetadata(ph.category, ph.caption);

      return {
        id: ph.id,
        projectId: ph.projectId,
        projectCode: proj?.projectCode || 'PRJ-ZB',
        projectTitle: proj?.title || 'Proyek ZIPBLIND',
        activityId: ph.activityId,
        activityType: act?.activityType || decoded.documentationCategory,
        activityDate: act?.startDate || proj?.startDate || '2026-11-10',
        documentationCategory: decoded.documentationCategory,
        caption: decoded.cleanCaption,
        uploadedAt: ph.uploadedAt.toISOString(),
        imageUrl: `/api/admin/gallery/download/${ph.id}${tokenQuerySuffix}`,
      };
    });

    const dashboardPayload = buildExecutiveDashboardPayload({
      requestedPeriod,
      activities: snapshot.activities,
      projects: snapshot.projects,
      technicians: snapshot.technicians,
      products: snapshot.products,
      photos: formattedPhotos,
      exportLogs: rawExportLogs.map((e) => ({
        reportPeriodMonth: e.reportPeriodMonth,
        exportFormat: e.exportFormat,
        exportedAt: e.exportedAt.toISOString(),
      })),
    });

    // Pastikan tidak ada kredensial atau data internal Admin yang bocor
    const leakCheck = verifyNoAdminSecretsLeaked(dashboardPayload);
    if (!leakCheck.safe) {
      return NextResponse.json(
        {
          valid: false,
          code: 'SECURITY_SANITIZATION_ERROR',
          message: 'Respons diblokir oleh filter keamanan data internal.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        code: 'VALID',
        link: validatedLinkMeta,
        dashboard: dashboardPayload,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error GET /api/executive/dashboard:', error);
    return NextResponse.json(
      {
        valid: false,
        code: 'INTERNAL_ERROR',
        message: 'Gagal memuat data Dashboard Pimpinan dari database.',
      },
      { status: 500 }
    );
  }
}

// Semua upaya tambah/ubah/hapus data pada endpoint Dashboard Pimpinan ditolak keras (403 Read-Only)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const attemptedOperation = body.operation || 'add_data';
  const guard = enforceExecutiveReadOnlyGuard({
    httpMethod: 'POST',
    attemptedOperation,
  });
  return NextResponse.json(
    {
      allowed: false,
      code: guard.code,
      message: guard.message,
    },
    { status: guard.status }
  );
}

export async function PUT() {
  const guard = enforceExecutiveReadOnlyGuard({
    httpMethod: 'PUT',
    attemptedOperation: 'update_data',
  });
  return NextResponse.json(
    { allowed: false, code: guard.code, message: guard.message },
    { status: guard.status }
  );
}

export async function PATCH() {
  const guard = enforceExecutiveReadOnlyGuard({
    httpMethod: 'PATCH',
    attemptedOperation: 'update_schedule',
  });
  return NextResponse.json(
    { allowed: false, code: guard.code, message: guard.message },
    { status: guard.status }
  );
}

export async function DELETE() {
  const guard = enforceExecutiveReadOnlyGuard({
    httpMethod: 'DELETE',
    attemptedOperation: 'delete_data',
  });
  return NextResponse.json(
    { allowed: false, code: guard.code, message: guard.message },
    { status: guard.status }
  );
}
