import { asc, desc, eq, inArray } from 'drizzle-orm';
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
  decodeActivityTypeAndTitle,
  encodeActivityTitleWithType,
  isCrossMonthActivity,
  mapToDbActivityType,
  type OperationalActivityRecord,
  type OperationalActivityType,
  type OperationalStatus,
} from '@/lib/zipblind-operational';

let seedingPromise: Promise<void> | null = null;

/**
 * Memastikan katalog produk dasar dan data operasional awal tersedia di PostgreSQL
 * apabila tabel operasional masih kosong.
 */
export async function ensureOperationalDataSeeded(): Promise<void> {
  if (seedingPromise) {
    return seedingPromise;
  }

  seedingPromise = (async () => {
    try {
      // 1. Pastikan Katalog Produk dasar ada
      const existingProducts = await db.select().from(productCatalog);
      if (existingProducts.length === 0) {
        await db
          .insert(productCatalog)
          .values([
            { name: 'Zipblind', unitLabel: 'set', isActive: true },
            { name: 'Roller Blind', unitLabel: 'set', isActive: true },
            { name: 'Vertical Blind', unitLabel: 'set', isActive: true },
            { name: 'Venetian Blind', unitLabel: 'set', isActive: true },
          ])
          .onConflictDoNothing();
      }

      // 2. Periksa apakah teknisi sudah ada
      const existingTechs = await db.select().from(technicians).limit(1);
      if (existingTechs.length > 0) {
        return;
      }

      // Seed 4 Teknisi dengan avatar masing-masing
      const insertedTechs = await db
        .insert(technicians)
        .values([
          {
            technicianCode: 'TECH-ZB-001',
            fullName: 'Budi Santoso',
            phone: '0812-8890-1101',
            specialization: 'Spesialis Motorized & Outdoor Zipblind',
            avatarUrl: '/images/ref_exec_tech1.png',
            isActive: true,
          },
          {
            technicianCode: 'TECH-ZB-002',
            fullName: 'Andi Pratama',
            phone: '0812-8890-1102',
            specialization: 'Instalasi Suntex & Heavy Duty Track',
            avatarUrl: '/images/ref_exec_tech2.png',
            isActive: true,
          },
          {
            technicianCode: 'TECH-ZB-003',
            fullName: 'Dedi Kurniawan',
            phone: '0813-7740-2203',
            specialization: 'Presisi Pengukuran & Kalibrasi Rel',
            avatarUrl: '/images/ref_exec_tech3.png',
            isActive: true,
          },
          {
            technicianCode: 'TECH-ZB-004',
            fullName: 'Hendra Wijaya',
            phone: '0813-7740-2204',
            specialization: 'Interior Roller, Vertical & Venetian Blind',
            avatarUrl: '/images/ref_act_avatar3.png',
            isActive: true,
          },
        ])
        .returning();

      // Seed 4 Pelanggan
      const insertedCustomers = await db
        .insert(customers)
        .values([
          {
            customerCode: 'CUST-ZB-001',
            fullName: 'Bpk. Hendra Kusuma (Rumah A Kemang)',
            contactPerson: 'Hendra Kusuma',
            phone: '0811-900-4411',
            email: 'hendra.kusuma@kemangresidence.id',
            address: 'Jl. Kemang Timur Raya No. 42, Bangka, Mampang Prapatan',
            city: 'Jakarta Selatan',
            notes: 'Pelanggan residensial premium area teras & balkon belakang.',
          },
          {
            customerCode: 'CUST-ZB-002',
            fullName: 'PT Nusantara Capital Realty',
            contactPerson: 'Ibu Clarissa Wijaya',
            phone: '021-5150-8899',
            email: 'facility@nusantaracapital.co.id',
            address: 'District 8 SCBD Lot 28, Senayan, Kebayoran Baru',
            city: 'Jakarta Selatan',
            notes: 'Pemasangan blind fasad kantor lantai 18 & 19.',
          },
          {
            customerCode: 'CUST-ZB-003',
            fullName: 'Villa Samudra Indah PIK 2',
            contactPerson: 'Bpk. Richard Tan',
            phone: '0816-700-9922',
            email: 'richard.tan@pik2villa.id',
            address: 'Cluster Bahamas Blok B2 No. 8, Pantai Indah Kapuk 2',
            city: 'Tangerang',
            notes: 'Area tepi laut membutuhkan ketahanan angin tinggi.',
          },
          {
            customerCode: 'CUST-ZB-004',
            fullName: 'Klinik Utama Medika Pondok Indah',
            contactPerson: 'dr. Nadia Prameswari',
            phone: '021-765-3321',
            email: 'operasional@medikapondokindah.id',
            address: 'Jl. Metro Pondok Indah Kav. IV, Kebayoran Lama',
            city: 'Jakarta Selatan',
            notes: 'Pemasangan bertahap di luar jam praktik utama.',
          },
        ])
        .returning();

      const allProducts = await db.select().from(productCatalog);
      const zipblindProd = allProducts.find((p) => p.name === 'Zipblind') || allProducts[0];
      const rollerProd = allProducts.find((p) => p.name === 'Roller Blind') || allProducts[0];
      const verticalProd = allProducts.find((p) => p.name === 'Vertical Blind') || allProducts[0];
      const venetianProd = allProducts.find((p) => p.name === 'Venetian Blind') || allProducts[0];

      const [cust1, cust2, cust3, cust4] = insertedCustomers;
      const [tech1, tech2, tech3, tech4] = insertedTechs;

      // Seed 4 Proyek (Termasuk contoh multi-aktivitas lintas bulan sesuai spesifikasi PROMPT 4)
      const insertedProjects = await db
        .insert(projects)
        .values([
          {
            projectCode: 'PRJ-ZB-26101',
            customerId: cust1.id,
            title: 'Proyek Rumah A — Teras & Patio Kemang',
            installationAddress: cust1.address,
            description:
              'Instalasi Motorized Outdoor Zipblind 8 set dengan tahapan Pengukuran (10 Nov), Persiapan (11 Nov), dan Pemasangan lintas bulan (15 Des).',
            status: 'Sedang Berjalan',
            startDate: '2026-11-10',
            targetEndDate: '2026-12-15',
          },
          {
            projectCode: 'PRJ-ZB-26102',
            customerId: cust2.id,
            title: 'Proyek Fasad Executive Lounge SCBD',
            installationAddress: cust2.address,
            description: 'Pemasangan Roller Blind Sunscreen 14 set untuk ruang rapat direksi.',
            status: 'Selesai',
            startDate: '2026-11-05',
            targetEndDate: '2026-11-12',
            completedAt: new Date('2026-11-12T09:30:00Z'),
          },
          {
            projectCode: 'PRJ-ZB-26103',
            customerId: cust3.id,
            title: 'Proyek Gazebo & Balkon Villa Samudra PIK 2',
            installationAddress: cust3.address,
            description: 'Pemasangan Heavy Duty Windproof Zipblind 6 set.',
            status: 'Sedang Berjalan',
            startDate: '2026-11-10',
            targetEndDate: '2026-11-20',
          },
          {
            projectCode: 'PRJ-ZB-26104',
            customerId: cust4.id,
            title: 'Proyek Ruang Konsultasi Klinik Medika',
            installationAddress: cust4.address,
            description: 'Pemasangan Vertical & Venetian Blind antibakteri 10 set.',
            status: 'Tertunda',
            startDate: '2026-11-14',
            targetEndDate: '2026-11-28',
          },
        ])
        .returning();

      const [prj1, prj2, prj3, prj4] = insertedProjects;

      // Seed Aktivitas Proyek & Jadwal Teknisi
      // Proyek 1 memiliki 3 aktivitas berbeda tanggal (10 Nov, 11 Nov, 15 Des)
      const acts = await db
        .insert(projectActivities)
        .values([
          {
            projectId: prj1.id,
            activityCode: 'ACT-ZB-26101-A',
            activityType: 'Pengukuran',
            title: 'Pengukuran Presisi Bukaan Teras & Balkon Rumah A',
            startDate: '2026-11-10',
            endDate: '2026-11-10',
            scheduledTimeSlot: '09:00 - 11:30 WIB',
            status: 'Selesai',
            notes: 'Ukuran laser selesai diverifikasi bersama pemilik rumah.',
            completedAt: new Date('2026-11-10T04:30:00Z'),
          },
          {
            projectId: prj1.id,
            activityCode: 'ACT-ZB-26101-B',
            activityType: mapToDbActivityType('Persiapan'),
            title: encodeActivityTitleWithType(
              'Persiapan',
              'Fabrikasi Rel Side-Channel & Kain Outdoor Zipblind'
            ),
            startDate: '2026-11-11',
            endDate: '2026-11-14',
            scheduledTimeSlot: '10:00 - 15:00 WIB',
            status: 'Selesai',
            notes: 'Komponen motor tubular dan kain telah lolos QC workshop.',
            completedAt: new Date('2026-11-14T08:00:00Z'),
          },
          {
            projectId: prj1.id,
            activityCode: 'ACT-ZB-26101-C',
            activityType: 'Pemasangan',
            title: 'Pemasangan Utama Motorized Zipblind Rumah A',
            startDate: '2026-12-15',
            endDate: '2026-12-15',
            scheduledTimeSlot: '08:30 - 16:30 WIB',
            status: 'Dijadwalkan',
            notes: 'Jadwal pemasangan lintas bulan menunggu penyelesaian kanopi kaca pelanggan.',
          },
          {
            projectId: prj2.id,
            activityCode: 'ACT-ZB-26102-A',
            activityType: 'Pengukuran',
            title: 'Pengukuran Jendela Fasad Lantai 18 SCBD',
            startDate: '2026-11-05',
            endDate: '2026-11-05',
            scheduledTimeSlot: '09:00 - 12:00 WIB',
            status: 'Selesai',
            notes: 'Seluruh 14 titik jendela telah diukur.',
            completedAt: new Date('2026-11-05T05:00:00Z'),
          },
          {
            projectId: prj2.id,
            activityCode: 'ACT-ZB-26102-B',
            activityType: 'Pemasangan',
            title: 'Pemasangan Roller Blind Sunscreen SCBD',
            startDate: '2026-11-12',
            endDate: '2026-11-12',
            scheduledTimeSlot: '13:00 - 17:30 WIB',
            status: 'Selesai',
            notes: 'Pemasangan 14 set selesai dan berita acara serah terima ditandatangani.',
            completedAt: new Date('2026-11-12T10:30:00Z'),
          },
          {
            projectId: prj3.id,
            activityCode: 'ACT-ZB-26103-A',
            activityType: 'Pemasangan',
            title: 'Instalasi Heavy Duty Zipblind Balkon Villa PIK 2',
            startDate: '2026-11-10',
            endDate: '2026-11-10',
            scheduledTimeSlot: '13:00 - 17:00 WIB',
            status: 'Sedang Berjalan',
            notes: 'Pemasangan bracket dan pengujian sensor angin sedang berjalan.',
          },
          {
            projectId: prj4.id,
            activityCode: 'ACT-ZB-26104-A',
            activityType: 'Survey',
            title: 'Survey & Konsultasi Blind Ruang Praktik Klinik Medika',
            startDate: '2026-11-14',
            endDate: '2026-11-14',
            scheduledTimeSlot: '14:00 - 16:00 WIB',
            status: 'Tertunda',
            notes: 'Menunggu konfirmasi jadwal kosong ruang tindakan lantai 2.',
          },
        ])
        .returning();

      const [act1A, act1B, act1C, act2A, act2B, act3A, act4A] = acts;

      // Seed Penugasan Teknisi (Beberapa aktivitas memiliki beberapa teknisi sekaligus)
      await db.insert(activityTechnicians).values([
        // ACT-ZB-26101-A: Budi Santoso & Andi Pratama
        { activityId: act1A.id, technicianId: tech1.id, isLead: true },
        { activityId: act1A.id, technicianId: tech2.id, isLead: false },
        // ACT-ZB-26101-B: Budi Santoso
        { activityId: act1B.id, technicianId: tech1.id, isLead: true },
        // ACT-ZB-26101-C: Budi Santoso, Andi Pratama, Dedi Kurniawan
        { activityId: act1C.id, technicianId: tech1.id, isLead: true },
        { activityId: act1C.id, technicianId: tech2.id, isLead: false },
        { activityId: act1C.id, technicianId: tech3.id, isLead: false },
        // ACT-ZB-26102-A: Dedi Kurniawan
        { activityId: act2A.id, technicianId: tech3.id, isLead: true },
        // ACT-ZB-26102-B: Dedi Kurniawan & Hendra Wijaya
        { activityId: act2B.id, technicianId: tech3.id, isLead: true },
        { activityId: act2B.id, technicianId: tech4.id, isLead: false },
        // ACT-ZB-26103-A: Andi Pratama & Budi Santoso
        { activityId: act3A.id, technicianId: tech2.id, isLead: true },
        { activityId: act3A.id, technicianId: tech1.id, isLead: false },
        // ACT-ZB-26104-A: Hendra Wijaya
        { activityId: act4A.id, technicianId: tech4.id, isLead: true },
      ]);

      // Seed Detail Pekerjaan & Produk dalam Satuan Set
      await db.insert(activityWorkDetails).values([
        {
          activityId: act1A.id,
          activityType: 'Pengukuran',
          productId: zipblindProd.id,
          quantitySets: 8,
          notes: 'Pengukuran 8 set Motorized Outdoor Zipblind Series Z-90.',
        },
        {
          activityId: act1B.id,
          activityType: 'Lainnya',
          productId: zipblindProd.id,
          quantitySets: 8,
          notes: 'Persiapan komponen & perakitan 8 set Zipblind.',
        },
        {
          activityId: act1C.id,
          activityType: 'Pemasangan',
          productId: zipblindProd.id,
          quantitySets: 8,
          notes: 'Pemasangan 8 set Motorized Outdoor Zipblind.',
        },
        {
          activityId: act2A.id,
          activityType: 'Pengukuran',
          productId: rollerProd.id,
          quantitySets: 14,
          notes: 'Pengukuran 14 set Roller Blind Sunscreen.',
        },
        {
          activityId: act2B.id,
          activityType: 'Pemasangan',
          productId: rollerProd.id,
          quantitySets: 14,
          notes: 'Pemasangan 14 set Roller Blind Sunscreen.',
        },
        {
          activityId: act3A.id,
          activityType: 'Pemasangan',
          productId: zipblindProd.id,
          quantitySets: 6,
          notes: 'Pemasangan 6 set Heavy Duty Windproof Zipblind.',
        },
        {
          activityId: act4A.id,
          activityType: 'Survey',
          productId: verticalProd.id || venetianProd.id,
          quantitySets: 10,
          notes: 'Survey 10 set Vertical Blind Antibakteri.',
        },
      ]);
    } catch (err) {
      console.error('Gagal melakukan seed data operasional awal:', err);
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

/**
 * Mengambil seluruh snapshot data operasional lengkap dari PostgreSQL:
 * - Teknisi
 * - Pelanggan (beserta ringkasan riwayat proyeknya)
 * - Proyek (beserta daftar aktivitas, teknisi, produk, jumlah set, dan status terpisah)
 * - Jadwal / Aktivitas
 * - Katalog Produk
 */
export async function getOperationalSnapshot() {
  await ensureOperationalDataSeeded();

  const [
    allTechs,
    allCustomers,
    allProjects,
    allActivities,
    allAssignments,
    allWorkDetails,
    allProducts,
    recentStatusLogs,
  ] = await Promise.all([
    db.select().from(technicians).orderBy(asc(technicians.technicianCode)),
    db.select().from(customers).orderBy(asc(customers.customerCode)),
    db.select().from(projects).orderBy(desc(projects.createdAt)),
    db.select().from(projectActivities).orderBy(asc(projectActivities.startDate)),
    db.select().from(activityTechnicians),
    db.select().from(activityWorkDetails),
    db.select().from(productCatalog).orderBy(asc(productCatalog.name)),
    db.select().from(statusChangeLogs).orderBy(desc(statusChangeLogs.changedAt)).limit(25),
  ]);

  const techMap = new Map(allTechs.map((t) => [t.id, t]));
  const customerMap = new Map(allCustomers.map((c) => [c.id, c]));
  const projectMap = new Map(allProjects.map((p) => [p.id, p]));
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  // Kelompokkan penugasan teknisi per activityId
  const assignmentsByActivity = new Map<
    string,
    Array<{
      id: string;
      technicianCode: string;
      fullName: string;
      avatarUrl: string;
      specialization: string | null;
      isActive: boolean;
      isLead: boolean;
    }>
  >();

  for (const asg of allAssignments) {
    const tech = techMap.get(asg.technicianId);
    if (!tech) continue;
    const list = assignmentsByActivity.get(asg.activityId) || [];
    list.push({
      id: tech.id,
      technicianCode: tech.technicianCode,
      fullName: tech.fullName,
      avatarUrl: tech.avatarUrl || '/images/ref_exec_tech1.png',
      specialization: tech.specialization,
      isActive: tech.isActive,
      isLead: asg.isLead,
    });
    assignmentsByActivity.set(asg.activityId, list);
  }

  // Kelompokkan work details per activityId
  const workDetailByActivity = new Map<
    string,
    {
      productId: string | null;
      productName: string;
      quantitySets: number;
      notes: string | null;
    }
  >();

  for (const wd of allWorkDetails) {
    const prod = productMap.get(wd.productId);
    const existing = workDetailByActivity.get(wd.activityId);
    if (!existing) {
      workDetailByActivity.set(wd.activityId, {
        productId: wd.productId,
        productName: prod?.name || 'Zipblind',
        quantitySets: wd.quantitySets,
        notes: wd.notes,
      });
    } else {
      existing.quantitySets += wd.quantitySets;
    }
  }

  // Susun daftar aktivitas terformat (Jadwal Teknisi & Aktivitas Proyek)
  const formattedActivities: OperationalActivityRecord[] = allActivities.map((act) => {
    const proj = projectMap.get(act.projectId);
    const cust = proj ? customerMap.get(proj.customerId) : undefined;
    const assignedTechs = assignmentsByActivity.get(act.id) || [];
    const wd = workDetailByActivity.get(act.id);
    const decoded = decodeActivityTypeAndTitle(act.activityType, act.title);
    const crossMonth = isCrossMonthActivity(
      proj?.startDate || null,
      act.startDate,
      act.endDate
    );

    return {
      id: act.id,
      projectId: act.projectId,
      projectCode: proj?.projectCode || '-',
      projectTitle: proj?.title || 'Proyek ZIPBLIND',
      projectStatus: (proj?.status || 'Dijadwalkan') as OperationalStatus,
      projectStartDate: proj?.startDate || null,
      customerId: proj?.customerId || '',
      customerName: cust?.fullName || 'Pelanggan ZIPBLIND',
      installationAddress: proj?.installationAddress || cust?.address || '-',
      activityCode: act.activityCode,
      activityType: decoded.activityType as OperationalActivityType,
      title: decoded.cleanTitle,
      startDate: act.startDate,
      endDate: act.endDate,
      scheduledTimeSlot: act.scheduledTimeSlot || '09:00 - 15:00 WIB',
      status: act.status as OperationalStatus,
      notes: act.notes || wd?.notes || null,
      productId: wd?.productId || allProducts[0]?.id || null,
      productName: wd?.productName || 'Zipblind',
      quantitySets: wd?.quantitySets || 1,
      technicians: assignedTechs,
      isCrossMonth: crossMonth,
    };
  });

  // Kelompokkan aktivitas per projectId
  const activitiesByProject = new Map<string, OperationalActivityRecord[]>();
  for (const act of formattedActivities) {
    const list = activitiesByProject.get(act.projectId) || [];
    list.push(act);
    activitiesByProject.set(act.projectId, list);
  }

  // Susun daftar Proyek lengkap beserta seluruh aktivitasnya
  const formattedProjects = allProjects.map((proj) => {
    const cust = customerMap.get(proj.customerId);
    const projActs = activitiesByProject.get(proj.id) || [];
    const completedActs = projActs.filter((a) => a.status === 'Selesai').length;
    const incompleteActs = projActs.filter(
      (a) => a.status !== 'Selesai' && a.status !== 'Dibatalkan'
    ).length;
    const hasCrossMonth = projActs.some((a) => a.isCrossMonth);

    // Hitung total set unik proyek (mengambil nilai maksimum set dari tahapan aktivitas atau penjumlahan pemasangan)
    const installationSets = projActs
      .filter((a) => a.activityType === 'Pemasangan')
      .reduce((acc, item) => acc + item.quantitySets, 0);
    const maxStageSets = projActs.reduce(
      (max, item) => Math.max(max, item.quantitySets),
      0
    );
    const totalQuantitySets = installationSets > 0 ? installationSets : maxStageSets;

    const latestAct = projActs[projActs.length - 1] || null;

    return {
      id: proj.id,
      projectCode: proj.projectCode,
      customerId: proj.customerId,
      customerName: cust?.fullName || '-',
      customerPhone: cust?.phone || '-',
      customerCity: cust?.city || '-',
      title: proj.title,
      installationAddress: proj.installationAddress,
      description: proj.description || '',
      status: proj.status as OperationalStatus,
      startDate: proj.startDate || '',
      targetEndDate: proj.targetEndDate || '',
      completedAt: proj.completedAt ? proj.completedAt.toISOString() : null,
      totalActivities: projActs.length,
      completedActivities: completedActs,
      incompleteActivities: incompleteActs,
      totalQuantitySets,
      primaryProductName: latestAct?.productName || 'Zipblind',
      latestActivitySummary: latestAct
        ? `${latestAct.activityType}: ${latestAct.status} (${latestAct.startDate})`
        : 'Belum ada aktivitas',
      isCrossMonth: hasCrossMonth,
      activities: projActs,
    };
  });

  // Kelompokkan proyek per customerId untuk fitur Riwayat Proyek Pelanggan
  const projectsByCustomer = new Map<string, typeof formattedProjects>();
  for (const prj of formattedProjects) {
    const list = projectsByCustomer.get(prj.customerId) || [];
    list.push(prj);
    projectsByCustomer.set(prj.customerId, list);
  }

  // Hitung jumlah penugasan aktif/selesai per teknisi
  const formattedTechnicians = allTechs.map((tech) => {
    const techActivities = formattedActivities.filter((a) =>
      a.technicians.some((t) => t.id === tech.id)
    );
    const completedCount = techActivities.filter((a) => a.status === 'Selesai').length;
    return {
      id: tech.id,
      technicianCode: tech.technicianCode,
      fullName: tech.fullName,
      phone: tech.phone,
      specialization: tech.specialization || 'Teknisi Instalasi & Pengukuran',
      avatarUrl: tech.avatarUrl || '/images/ref_tech_1.png',
      isActive: tech.isActive,
      totalAssignedActivities: techActivities.length,
      completedActivities: completedCount,
    };
  });

  const formattedCustomers = allCustomers.map((cust) => {
    const custProjects = projectsByCustomer.get(cust.id) || [];
    return {
      id: cust.id,
      customerCode: cust.customerCode,
      fullName: cust.fullName,
      contactPerson: cust.contactPerson || cust.fullName,
      phone: cust.phone,
      email: cust.email || '',
      address: cust.address,
      city: cust.city || 'Jakarta',
      notes: cust.notes || '',
      totalProjects: custProjects.length,
      projects: custProjects,
    };
  });

  return {
    technicians: formattedTechnicians,
    customers: formattedCustomers,
    projects: formattedProjects,
    activities: formattedActivities,
    products: allProducts.map((p) => ({
      id: p.id,
      name: p.name,
      unitLabel: p.unitLabel,
    })),
    statusLogs: recentStatusLogs,
  };
}
