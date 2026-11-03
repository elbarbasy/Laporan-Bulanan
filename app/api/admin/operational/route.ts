import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  activityTechnicians,
  activityWorkDetails,
  customers,
  productCatalog,
  projectActivities,
  projects,
  statusChangeLogs,
  technicians,
} from '@/src/db/schema';
import {
  logAdminSecurityActivity,
  validateAdminRequestSession,
} from '@/src/lib/server-auth';
import { authorizeRoleAccess } from '@/lib/zipblind-auth';
import {
  encodeActivityTitleWithType,
  mapToDbActivityType,
  validateProjectStatusTransition,
  type OperationalActivityType,
  type OperationalStatus,
} from '@/lib/zipblind-operational';
import { getOperationalSnapshot } from '@/src/lib/operational-db';

async function verifyAdminOperationalAccess(req: NextRequest, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  const explicitRoleHeader = req.headers.get('x-zipblind-role');
  if (explicitRoleHeader === 'executive' || explicitRoleHeader === 'technician') {
    const rbac = authorizeRoleAccess({
      role: explicitRoleHeader,
      httpMethod: method,
      targetScope: explicitRoleHeader === 'executive' && method !== 'GET' ? 'executive' : 'admin',
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

export async function GET(req: NextRequest) {
  const access = await verifyAdminOperationalAccess(req, 'GET');
  if (!access.allowed) return access.response;

  const snapshot = await getOperationalSnapshot();
  return NextResponse.json(snapshot, { status: 200 });
}

export async function POST(req: NextRequest) {
  const access = await verifyAdminOperationalAccess(req, 'POST');
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const entity = String(body.entity || '').trim();

    // 1. CREATE TECHNICIAN
    if (entity === 'technician') {
      const fullName = String(body.fullName || '').trim();
      const phone = String(body.phone || '').trim();
      const specialization = String(body.specialization || 'Teknisi Instalasi & Pengukuran').trim();
      const avatarUrl = String(body.avatarUrl || '/images/ref_exec_tech1.png').trim();
      const isActive = body.isActive !== false;

      if (!fullName || !phone) {
        return NextResponse.json(
          { error: 'Nama lengkap dan nomor telepon teknisi wajib diisi.' },
          { status: 400 }
        );
      }

      const codeSuffix = String(Math.floor(100 + Math.random() * 900));
      const technicianCode =
        String(body.technicianCode || '').trim() || `TECH-ZB-${codeSuffix}`;

      const [created] = await db
        .insert(technicians)
        .values({
          technicianCode,
          fullName,
          phone,
          specialization,
          avatarUrl,
          isActive,
        })
        .returning();

      await logAdminSecurityActivity({
        adminId: access.admin.id,
        actionType: 'CREATE_TECHNICIAN',
        entityName: 'technicians',
        entityId: created.id,
        description: `Menambahkan teknisi baru: ${created.fullName} (${created.technicianCode})`,
      });

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json(
        {
          message: `Teknisi "${created.fullName}" berhasil ditambahkan.`,
          created,
          snapshot,
        },
        { status: 201 }
      );
    }

    // 2. CREATE CUSTOMER
    if (entity === 'customer') {
      const fullName = String(body.fullName || '').trim();
      const contactPerson = String(body.contactPerson || fullName).trim();
      const phone = String(body.phone || '').trim();
      const email = String(body.email || '').trim();
      const address = String(body.address || '').trim();
      const city = String(body.city || 'Jakarta').trim();
      const notes = String(body.notes || '').trim();

      if (!fullName || !phone || !address) {
        return NextResponse.json(
          { error: 'Nama pelanggan, nomor telepon, dan alamat wajib diisi.' },
          { status: 400 }
        );
      }

      const codeSuffix = String(Math.floor(100 + Math.random() * 900));
      const customerCode =
        String(body.customerCode || '').trim() || `CUST-ZB-${codeSuffix}`;

      const [created] = await db
        .insert(customers)
        .values({
          customerCode,
          fullName,
          contactPerson,
          phone,
          email: email || null,
          address,
          city,
          notes: notes || null,
        })
        .returning();

      await logAdminSecurityActivity({
        adminId: access.admin.id,
        actionType: 'CREATE_CUSTOMER',
        entityName: 'customers',
        entityId: created.id,
        description: `Menambahkan pelanggan baru: ${created.fullName} (${created.customerCode})`,
      });

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json(
        {
          message: `Pelanggan "${created.fullName}" berhasil ditambahkan.`,
          created,
          snapshot,
        },
        { status: 201 }
      );
    }

    // 3. CREATE PROJECT
    if (entity === 'project') {
      const customerId = String(body.customerId || '').trim();
      const title = String(body.title || '').trim();
      const installationAddress = String(body.installationAddress || '').trim();
      const description = String(body.description || '').trim();
      const startDate = String(body.startDate || '2026-11-10').trim();
      const targetEndDate = String(body.targetEndDate || startDate).trim();
      const status = (body.status || 'Dijadwalkan') as OperationalStatus;

      if (!customerId || !title || !installationAddress) {
        return NextResponse.json(
          { error: 'Pelanggan, nama proyek, dan alamat instalasi wajib diisi.' },
          { status: 400 }
        );
      }

      const codeSuffix = String(Math.floor(100 + Math.random() * 900));
      const projectCode =
        String(body.projectCode || '').trim() || `PRJ-ZB-26${codeSuffix}`;

      const [createdProject] = await db
        .insert(projects)
        .values({
          projectCode,
          customerId,
          title,
          installationAddress,
          description: description || null,
          status: status === 'Selesai' ? 'Sedang Berjalan' : status,
          startDate,
          targetEndDate: targetEndDate >= startDate ? targetEndDate : startDate,
          createdBy: access.admin.id,
        })
        .returning();

      // Jika disertakan aktivitas awal saat membuat proyek
      if (body.initialActivity && typeof body.initialActivity === 'object') {
        const initAct = body.initialActivity;
        const uiType = (initAct.activityType || 'Pengukuran') as OperationalActivityType;
        const actDate = String(initAct.startDate || startDate).trim();
        const actEndDate = String(initAct.endDate || actDate).trim();
        const actStatus = (initAct.status || 'Dijadwalkan') as OperationalStatus;
        const quantitySets = Math.max(1, Number(initAct.quantitySets || 1));

        const [createdAct] = await db
          .insert(projectActivities)
          .values({
            projectId: createdProject.id,
            activityCode: `ACT-${projectCode.replace('PRJ-', '')}-A`,
            activityType: mapToDbActivityType(uiType),
            title: encodeActivityTitleWithType(
              uiType,
              String(initAct.title || `${uiType} ${title}`)
            ),
            startDate: actDate,
            endDate: actEndDate >= actDate ? actEndDate : actDate,
            scheduledTimeSlot: String(initAct.scheduledTimeSlot || '09:00 - 13:00 WIB'),
            status: actStatus,
            notes: initAct.notes ? String(initAct.notes) : null,
            completedAt: actStatus === 'Selesai' ? new Date() : null,
            createdBy: access.admin.id,
          })
          .returning();

        // Assign teknisi
        const techIds: string[] = Array.isArray(initAct.technicianIds)
          ? initAct.technicianIds.filter(Boolean)
          : [];
        if (techIds.length > 0) {
          await db.insert(activityTechnicians).values(
            techIds.map((tId, idx) => ({
              activityId: createdAct.id,
              technicianId: tId,
              isLead: idx === 0,
            }))
          );
        }

        // Work details
        const allProds = await db.select().from(productCatalog);
        const targetProduct =
          allProds.find((p) => p.id === initAct.productId || p.name === initAct.productName) ||
          allProds[0];

        if (targetProduct) {
          await db.insert(activityWorkDetails).values({
            activityId: createdAct.id,
            activityType: mapToDbActivityType(uiType),
            productId: targetProduct.id,
            quantitySets,
            notes: initAct.notes ? String(initAct.notes) : null,
          });
        }
      }

      await logAdminSecurityActivity({
        adminId: access.admin.id,
        actionType: 'CREATE_PROJECT',
        entityName: 'projects',
        entityId: createdProject.id,
        description: `Menambahkan proyek baru: ${createdProject.title} (${createdProject.projectCode})`,
      });

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json(
        {
          message: `Proyek "${createdProject.title}" berhasil dibuat.`,
          created: createdProject,
          snapshot,
        },
        { status: 201 }
      );
    }

    // 4. CREATE ACTIVITY / JADWAL TEKNISI
    if (entity === 'activity') {
      const projectId = String(body.projectId || '').trim();
      const uiType = (body.activityType || 'Pemasangan') as OperationalActivityType;
      const rawTitle = String(body.title || `${uiType} Proyek`).trim();
      const startDate = String(body.startDate || '2026-11-10').trim();
      const endDate = String(body.endDate || startDate).trim();
      const scheduledTimeSlot = String(body.scheduledTimeSlot || '09:00 - 15:00 WIB').trim();
      const status = (body.status || 'Dijadwalkan') as OperationalStatus;
      const notes = body.notes ? String(body.notes).trim() : null;
      const quantitySets = Math.max(1, Number(body.quantitySets || 1));
      const technicianIds: string[] = Array.isArray(body.technicianIds)
        ? Array.from(new Set(body.technicianIds.map(String).filter(Boolean)))
        : [];

      if (!projectId || !startDate) {
        return NextResponse.json(
          { error: 'Proyek dan tanggal pelaksanaan jadwal wajib dipilih.' },
          { status: 400 }
        );
      }

      if (technicianIds.length === 0) {
        return NextResponse.json(
          { error: 'Pilih minimal satu teknisi yang ditugaskan.' },
          { status: 400 }
        );
      }

      const codeSuffix = String(Math.floor(1000 + Math.random() * 9000));
      const activityCode =
        String(body.activityCode || '').trim() || `ACT-ZB-${codeSuffix}`;

      const [createdAct] = await db
        .insert(projectActivities)
        .values({
          projectId,
          activityCode,
          activityType: mapToDbActivityType(uiType),
          title: encodeActivityTitleWithType(uiType, rawTitle),
          startDate,
          endDate: endDate >= startDate ? endDate : startDate,
          scheduledTimeSlot,
          status,
          notes,
          completedAt: status === 'Selesai' ? new Date() : null,
          createdBy: access.admin.id,
        })
        .returning();

      // Simpan penugasan satu atau beberapa teknisi
      await db.insert(activityTechnicians).values(
        technicianIds.map((tId, idx) => ({
          activityId: createdAct.id,
          technicianId: tId,
          isLead: idx === 0,
        }))
      );

      // Simpan detail pekerjaan & produk (jumlah set)
      const allProds = await db.select().from(productCatalog);
      const selectedProduct =
        allProds.find((p) => p.id === body.productId || p.name === body.productName) ||
        allProds[0];

      if (selectedProduct) {
        await db.insert(activityWorkDetails).values({
          activityId: createdAct.id,
          activityType: mapToDbActivityType(uiType),
          productId: selectedProduct.id,
          quantitySets,
          notes,
        });
      }

      // Catat log status aktivitas
      await db.insert(statusChangeLogs).values({
        projectId,
        activityId: createdAct.id,
        entityType: 'activity',
        oldStatus: null,
        newStatus: status,
        reasonNotes: `Penjadwalan aktivitas baru (${uiType}) pada ${startDate}`,
        changedBy: access.admin.id,
      });

      await logAdminSecurityActivity({
        adminId: access.admin.id,
        actionType: 'CREATE_ACTIVITY_SCHEDULE',
        entityName: 'project_activities',
        entityId: createdAct.id,
        description: `Menambahkan jadwal/aktivitas ${uiType} (${createdAct.activityCode}) pada ${startDate}`,
      });

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json(
        {
          message: `Jadwal & aktivitas "${uiType}" berhasil ditambahkan ke proyek.`,
          created: createdAct,
          snapshot,
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Entitas operasional tidak dikenali.' }, { status: 400 });
  } catch (err) {
    console.error('Error POST /api/admin/operational:', err);
    return NextResponse.json(
      { error: 'Gagal menyimpan data operasional ke database.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const access = await verifyAdminOperationalAccess(req, 'PUT');
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const entity = String(body.entity || '').trim();
    const id = String(body.id || '').trim();

    if (!id) {
      return NextResponse.json({ error: 'ID data wajib disertakan.' }, { status: 400 });
    }

    // 1. UPDATE TECHNICIAN (Data & Avatar)
    if (entity === 'technician') {
      const fullName = String(body.fullName || '').trim();
      const phone = String(body.phone || '').trim();
      const specialization = String(body.specialization || '').trim();
      const avatarUrl = String(body.avatarUrl || '/images/ref_tech_1.png').trim();
      const isActive = Boolean(body.isActive);

      if (!fullName || !phone) {
        return NextResponse.json(
          { error: 'Nama lengkap dan nomor telepon teknisi wajib diisi.' },
          { status: 400 }
        );
      }

      const [updated] = await db
        .update(technicians)
        .set({
          fullName,
          phone,
          specialization,
          avatarUrl,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(technicians.id, id))
        .returning();

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: `Data teknisi "${updated.fullName}" berhasil diperbarui.`,
        updated,
        snapshot,
      });
    }

    // 2. UPDATE CUSTOMER
    if (entity === 'customer') {
      const fullName = String(body.fullName || '').trim();
      const contactPerson = String(body.contactPerson || fullName).trim();
      const phone = String(body.phone || '').trim();
      const email = String(body.email || '').trim();
      const address = String(body.address || '').trim();
      const city = String(body.city || 'Jakarta').trim();
      const notes = String(body.notes || '').trim();

      if (!fullName || !phone || !address) {
        return NextResponse.json(
          { error: 'Nama pelanggan, nomor telepon, dan alamat wajib diisi.' },
          { status: 400 }
        );
      }

      const [updated] = await db
        .update(customers)
        .set({
          fullName,
          contactPerson,
          phone,
          email: email || null,
          address,
          city,
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: `Data pelanggan "${updated.fullName}" berhasil diperbarui.`,
        updated,
        snapshot,
      });
    }

    // 3. UPDATE PROJECT
    if (entity === 'project') {
      const [existingProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!existingProject) {
        return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
      }

      const targetStatus = (body.status || existingProject.status) as OperationalStatus;

      // Validasi aturan bisnis: Aktivitas yang belum selesai tidak boleh dianggap selesai
      if (targetStatus === 'Selesai') {
        const projActs = await db
          .select()
          .from(projectActivities)
          .where(eq(projectActivities.projectId, id));
        const validation = validateProjectStatusTransition(
          targetStatus,
          projActs.map((a) => ({ status: a.status as OperationalStatus, title: a.title }))
        );
        if (!validation.allowed) {
          return NextResponse.json(
            {
              error: validation.reason,
              code: 'INCOMPLETE_ACTIVITIES_BLOCK',
            },
            { status: 400 }
          );
        }
      }

      const startDate = String(body.startDate || existingProject.startDate || '2026-11-10');
      const rawEndDate = String(body.targetEndDate || existingProject.targetEndDate || startDate);
      const targetEndDate = rawEndDate >= startDate ? rawEndDate : startDate;

      const [updated] = await db
        .update(projects)
        .set({
          customerId: String(body.customerId || existingProject.customerId),
          title: String(body.title || existingProject.title).trim(),
          installationAddress: String(
            body.installationAddress || existingProject.installationAddress
          ).trim(),
          description:
            body.description !== undefined
              ? String(body.description).trim() || null
              : existingProject.description,
          status: targetStatus,
          startDate,
          targetEndDate,
          completedAt: targetStatus === 'Selesai' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      if (existingProject.status !== targetStatus) {
        await db.insert(statusChangeLogs).values({
          projectId: id,
          activityId: null,
          entityType: 'project',
          oldStatus: existingProject.status,
          newStatus: targetStatus,
          reasonNotes: 'Perubahan status proyek oleh Admin',
          changedBy: access.admin.id,
        });
      }

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: `Data proyek "${updated.title}" berhasil diperbarui.`,
        updated,
        snapshot,
      });
    }

    // 4. UPDATE ACTIVITY / JADWAL TEKNISI
    if (entity === 'activity') {
      const [existingAct] = await db
        .select()
        .from(projectActivities)
        .where(eq(projectActivities.id, id))
        .limit(1);

      if (!existingAct) {
        return NextResponse.json(
          { error: 'Jadwal aktivitas tidak ditemukan.' },
          { status: 404 }
        );
      }

      const uiType = (body.activityType || existingAct.activityType) as OperationalActivityType;
      const rawTitle = String(body.title || existingAct.title).trim();
      const startDate = String(body.startDate || existingAct.startDate).trim();
      const rawEndDate = String(body.endDate || startDate).trim();
      const endDate = rawEndDate >= startDate ? rawEndDate : startDate;
      const scheduledTimeSlot = String(
        body.scheduledTimeSlot || existingAct.scheduledTimeSlot || '09:00 - 15:00 WIB'
      ).trim();
      const newStatus = (body.status || existingAct.status) as OperationalStatus;
      const notes =
        body.notes !== undefined ? String(body.notes).trim() || null : existingAct.notes;
      const quantitySets = Math.max(1, Number(body.quantitySets || 1));

      const [updatedAct] = await db
        .update(projectActivities)
        .set({
          projectId: String(body.projectId || existingAct.projectId),
          activityType: mapToDbActivityType(uiType),
          title: encodeActivityTitleWithType(uiType, rawTitle),
          startDate,
          endDate,
          scheduledTimeSlot,
          status: newStatus,
          notes,
          completedAt: newStatus === 'Selesai' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(projectActivities.id, id))
        .returning();

      // Perbarui daftar teknisi yang ditugaskan jika dikirim
      if (Array.isArray(body.technicianIds)) {
        const techIds: string[] = Array.from(
          new Set(body.technicianIds.map(String).filter(Boolean))
        );
        if (techIds.length > 0) {
          await db
            .delete(activityTechnicians)
            .where(eq(activityTechnicians.activityId, id));
          await db.insert(activityTechnicians).values(
            techIds.map((tId, idx) => ({
              activityId: id,
              technicianId: tId,
              isLead: idx === 0,
            }))
          );
        }
      }

      // Perbarui detail produk dan jumlah set
      const allProds = await db.select().from(productCatalog);
      const selectedProduct =
        allProds.find((p) => p.id === body.productId || p.name === body.productName) ||
        allProds[0];

      if (selectedProduct) {
        await db.delete(activityWorkDetails).where(eq(activityWorkDetails.activityId, id));
        await db.insert(activityWorkDetails).values({
          activityId: id,
          activityType: mapToDbActivityType(uiType),
          productId: selectedProduct.id,
          quantitySets,
          notes,
        });
      }

      if (existingAct.status !== newStatus) {
        await db.insert(statusChangeLogs).values({
          projectId: updatedAct.projectId,
          activityId: id,
          entityType: 'activity',
          oldStatus: existingAct.status,
          newStatus,
          reasonNotes: `Perubahan status aktivitas jadwal (${uiType})`,
          changedBy: access.admin.id,
        });
      }

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: `Jadwal & aktivitas "${uiType}" berhasil diperbarui.`,
        updated: updatedAct,
        snapshot,
      });
    }

    return NextResponse.json({ error: 'Entitas tidak dikenali.' }, { status: 400 });
  } catch (err) {
    console.error('Error PUT /api/admin/operational:', err);
    return NextResponse.json(
      { error: 'Gagal memperbarui data operasional.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const access = await verifyAdminOperationalAccess(req, 'PATCH');
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const entity = String(body.entity || '').trim();
    const id = String(body.id || '').trim();

    if (!id) {
      return NextResponse.json({ error: 'ID data wajib disertakan.' }, { status: 400 });
    }

    // 1. TOGGLE STATUS AKTIF TEKNISI / UBAH AVATAR CEPAT
    if (entity === 'technician') {
      const [tech] = await db
        .select()
        .from(technicians)
        .where(eq(technicians.id, id))
        .limit(1);
      if (!tech) {
        return NextResponse.json({ error: 'Teknisi tidak ditemukan.' }, { status: 404 });
      }

      const nextActive =
        typeof body.isActive === 'boolean' ? body.isActive : !tech.isActive;
      const nextAvatar = body.avatarUrl ? String(body.avatarUrl) : tech.avatarUrl;

      const [updated] = await db
        .update(technicians)
        .set({
          isActive: nextActive,
          avatarUrl: nextAvatar,
          updatedAt: new Date(),
        })
        .where(eq(technicians.id, id))
        .returning();

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: `Status teknisi "${updated.fullName}" diubah menjadi ${
          updated.isActive ? 'Aktif' : 'Nonaktif'
        }.`,
        updated,
        snapshot,
      });
    }

    // 2. UBAH STATUS PROYEK (Terpisah dari Status Aktivitas)
    if (entity === 'project') {
      const targetStatus = body.status as OperationalStatus;
      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      if (!proj) {
        return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
      }

      if (targetStatus === 'Selesai') {
        const projActs = await db
          .select()
          .from(projectActivities)
          .where(eq(projectActivities.projectId, id));
        const validation = validateProjectStatusTransition(
          targetStatus,
          projActs.map((a) => ({ status: a.status as OperationalStatus, title: a.title }))
        );
        if (!validation.allowed) {
          return NextResponse.json(
            {
              error: validation.reason,
              code: 'INCOMPLETE_ACTIVITIES_BLOCK',
            },
            { status: 400 }
          );
        }
      }

      const [updated] = await db
        .update(projects)
        .set({
          status: targetStatus,
          completedAt: targetStatus === 'Selesai' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      if (proj.status !== targetStatus) {
        await db.insert(statusChangeLogs).values({
          projectId: id,
          activityId: null,
          entityType: 'project',
          oldStatus: proj.status,
          newStatus: targetStatus,
          reasonNotes: 'Perubahan langsung status proyek oleh Admin',
          changedBy: access.admin.id,
        });
      }

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: `Status proyek "${updated.title}" diperbarui menjadi "${targetStatus}".`,
        updated,
        snapshot,
      });
    }

    // 3. UBAH STATUS AKTIVITAS / JADWAL TEKNISI (Terpisah dari Status Proyek)
    if (entity === 'activity') {
      const targetStatus = body.status as OperationalStatus;
      const [act] = await db
        .select()
        .from(projectActivities)
        .where(eq(projectActivities.id, id))
        .limit(1);
      if (!act) {
        return NextResponse.json({ error: 'Jadwal aktivitas tidak ditemukan.' }, { status: 404 });
      }

      const [updated] = await db
        .update(projectActivities)
        .set({
          status: targetStatus,
          completedAt: targetStatus === 'Selesai' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(projectActivities.id, id))
        .returning();

      if (act.status !== targetStatus) {
        await db.insert(statusChangeLogs).values({
          projectId: act.projectId,
          activityId: id,
          entityType: 'activity',
          oldStatus: act.status,
          newStatus: targetStatus,
          reasonNotes: 'Perubahan status pekerjaan oleh Admin',
          changedBy: access.admin.id,
        });
      }

      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: `Status pekerjaan berhasil diubah menjadi "${targetStatus}".`,
        updated,
        snapshot,
      });
    }

    return NextResponse.json({ error: 'Entitas tidak dikenali.' }, { status: 400 });
  } catch (err) {
    console.error('Error PATCH /api/admin/operational:', err);
    return NextResponse.json(
      { error: 'Gagal memperbarui status operasional.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const access = await verifyAdminOperationalAccess(req, 'DELETE');
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const entity = String(body.entity || '').trim();
    const id = String(body.id || '').trim();

    if (!id) {
      return NextResponse.json({ error: 'ID data wajib disertakan.' }, { status: 400 });
    }

    if (entity === 'activity') {
      await db.delete(projectActivities).where(eq(projectActivities.id, id));
      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: 'Jadwal aktivitas berhasil dihapus.',
        snapshot,
      });
    }

    if (entity === 'project') {
      await db.delete(projects).where(eq(projects.id, id));
      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: 'Data proyek beserta tahapan aktivitasnya berhasil dihapus.',
        snapshot,
      });
    }

    if (entity === 'customer') {
      // Hapus proyek yang terhubung terlebih dahulu agar constraint restrict tidak gagal ketika Admin menghapus pelanggan
      await db.delete(projects).where(eq(projects.customerId, id));
      await db.delete(customers).where(eq(customers.id, id));
      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: 'Data pelanggan berhasil dihapus.',
        snapshot,
      });
    }

    if (entity === 'technician') {
      // Hapus relasi penugasan teknisi terlebih dahulu sebelum menghapus teknisi
      await db.delete(activityTechnicians).where(eq(activityTechnicians.technicianId, id));
      await db.delete(technicians).where(eq(technicians.id, id));
      const snapshot = await getOperationalSnapshot();
      return NextResponse.json({
        message: 'Data teknisi berhasil dihapus.',
        snapshot,
      });
    }

    return NextResponse.json({ error: 'Entitas tidak dikenali.' }, { status: 400 });
  } catch (err) {
    console.error('Error DELETE /api/admin/operational:', err);
    return NextResponse.json(
      { error: 'Gagal menghapus data operasional.' },
      { status: 500 }
    );
  }
}
