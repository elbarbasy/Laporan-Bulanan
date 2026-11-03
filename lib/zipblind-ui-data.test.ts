import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_SIDEBAR_MENUS,
  ADMIN_DASHBOARD_SHORTCUTS,
  PREVIEW_PROJECTS,
  calculateExecutiveMetrics,
  filterProjectsByStatus,
} from './zipblind-ui-data';
import {
  authorizeRoleAccess,
  createAdminSessionToken,
  generateSecureSecretToken,
  hashSecretToken,
  validateSecretLinkRecord,
  verifyAdminSessionToken,
} from './zipblind-auth';
import {
  decodeActivityTypeAndTitle,
  encodeActivityTitleWithType,
  filterSchedulesByCalendarMode,
  formatAssignedTechniciansColumn,
  isCrossMonthActivity,
  mapToDbActivityType,
  summarizeActivitiesByPeriodAndStatus,
  validateProjectStatusTransition,
} from './zipblind-operational';
import {
  GALLERY_DOCUMENTATION_CATEGORIES,
  buildProjectAlbumsWithStages,
  decodePhotoCaptionMetadata,
  encodePhotoCaptionWithMetadata,
  filterGalleryPhotos,
  isBeforeAfterApplicable,
  mapDocCategoryToDbEnum,
  type GalleryPhotoItem,
} from './zipblind-gallery';
import {
  MONITORING_WORK_CONDITIONS,
  calculateMonitoringAndWorkRecap,
  evaluateEffectiveProjectCondition,
  normalizeToMonitoringCondition,
} from './zipblind-monitoring-rekap';
import {
  buildOfficialMonthlyReport,
  ensureUniqueMonthlyReportArchive,
  generateMonthlyReportExcelBuffer,
  generateMonthlyReportPdfBuffer,
  getOfficialReportCreationDate,
  getPreviousPeriodMonth,
} from './zipblind-monthly-report';
import {
  buildExecutiveDashboardPayload,
  enforceExecutiveReadOnlyGuard,
  verifyNoAdminSecretsLeaked,
} from './zipblind-executive';
import type { OperationalActivityRecord } from './zipblind-operational';

test('Sidebar Admin memiliki tepat 12 menu sesuai spesifikasi PROMPT 1', () => {
  assert.equal(ADMIN_SIDEBAR_MENUS.length, 12);
  const expectedLabels = [
    'Dashboard',
    'Jadwal Teknisi',
    'Data Teknisi',
    'Data Pelanggan',
    'Data Project',
    'Galeri Project',
    'Monitoring',
    'Rekap Pekerjaan',
    'Laporan Bulanan',
    'Dashboard Pimpinan',
    'Notifikasi',
    'Pengaturan',
  ];
  assert.deepEqual(
    ADMIN_SIDEBAR_MENUS.map((m) => m.label),
    expectedLabels
  );
});

test('Dashboard Admin memiliki tepat 4 shortcut sesuai spesifikasi PROMPT 1', () => {
  assert.equal(ADMIN_DASHBOARD_SHORTCUTS.length, 4);
  assert.deepEqual(
    ADMIN_DASHBOARD_SHORTCUTS.map((s) => s.title),
    ['Jadwal Teknisi', 'Data Project', 'Galeri Project', 'Laporan']
  );
});

test('calculateExecutiveMetrics menghitung metrik proyek secara akurat dan menangani empty state', () => {
  const emptyMetrics = calculateExecutiveMetrics([]);
  assert.equal(emptyMetrics.totalProjects, 0);
  assert.equal(emptyMetrics.completionRatePercent, 0);

  const metrics = calculateExecutiveMetrics(PREVIEW_PROJECTS);
  assert.equal(metrics.totalProjects, 24);
  assert.equal(metrics.completedProjects, 18);
  assert.equal(metrics.ongoingProjects, 4);
  assert.equal(metrics.delayedProjects, 2);
  assert.equal(metrics.completionRatePercent, 75);
  assert.equal(metrics.totalUnitsInstalled, 88);
});

test('filterProjectsByStatus memfilter berdasarkan status proyek dan kata kunci', () => {
  const selesaiOnly = filterProjectsByStatus(PREVIEW_PROJECTS, 'Selesai', '');
  assert.equal(selesaiOnly.length, 3);

  const searchResult = filterProjectsByStatus(PREVIEW_PROJECTS, 'Semua', 'SCBD');
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].code, 'PRJ-ZB-26107');
});

test('Seluruh file UI menggunakan Plus Jakarta Sans dan bebas dari font-mono / font tipis', async () => {
  const fs = await import('node:fs');
  const filesToCheck = [
    'app/layout.tsx',
    'app/globals.css',
    'app/page.tsx',
    'app/executive/[token]/page.tsx',
    'components/zipblind/AnimatedKpiNumber.tsx',
    'components/zipblind/AdminSidebar.tsx',
    'components/zipblind/AdminDashboardView.tsx',
    'components/zipblind/ExecutiveDashboardView.tsx',
    'components/zipblind/AdminModuleViews.tsx',
    'components/zipblind/OperationalModulesView.tsx',
    'components/zipblind/GalleryPortfolioView.tsx',
    'components/zipblind/AdminLoginScreen.tsx',
    'components/zipblind/SecretLinkManagerPanel.tsx',
    'components/zipblind/ZipblindCharts.tsx',
  ];

  for (const filePath of filesToCheck) {
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.equal(
      content.includes('font-mono'),
      false,
      `File ${filePath} masih mengandung font-mono`
    );
    assert.equal(
      content.includes('JetBrains_Mono'),
      false,
      `File ${filePath} masih mengandung JetBrains_Mono`
    );
    assert.equal(
      content.includes('font-light'),
      false,
      `File ${filePath} masih mengandung font-light`
    );
  }
});

test('Seluruh halaman menggunakan full-width responsive layout tanpa pembatas max-w-[1400px] atau max-w-[1380px]', async () => {
  const fs = await import('node:fs');
  const layoutFiles = [
    'app/page.tsx',
    'components/zipblind/AdminDashboardView.tsx',
    'components/zipblind/ExecutiveDashboardView.tsx',
    'components/zipblind/AdminModuleViews.tsx',
    'components/zipblind/OperationalModulesView.tsx',
    'components/zipblind/GalleryPortfolioView.tsx',
  ];

  for (const filePath of layoutFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.equal(
      content.includes('max-w-[1400px]'),
      false,
      `File ${filePath} masih memiliki pembatas max-w-[1400px]`
    );
    assert.equal(
      content.includes('max-w-[1380px]'),
      false,
      `File ${filePath} masih memiliki pembatas max-w-[1380px]`
    );
    assert.equal(
      content.includes('max-w-[1560px]'),
      false,
      `File ${filePath} masih memiliki pembatas max-w-[1560px]`
    );
  }
});

test('Skema database memiliki tepat 14 tabel dan 4 tipe ENUM sesuai spesifikasi PROMPT 2', async () => {
  const schema = await import('../src/db/schema');
  assert.deepEqual(schema.activityTypeEnum.enumValues, [
    'Pemasangan',
    'Pengukuran',
    'Survey',
    'Perbaikan',
    'Service',
    'Pengiriman',
    'Pengambilan',
    'Lainnya',
  ]);
  assert.deepEqual(schema.projectStatusEnum.enumValues, [
    'Dijadwalkan',
    'Sedang Berjalan',
    'Selesai',
    'Tertunda',
    'Dibatalkan',
  ]);
  assert.deepEqual(schema.activityStatusEnum.enumValues, [
    'Dijadwalkan',
    'Sedang Berjalan',
    'Selesai',
    'Tertunda',
    'Dibatalkan',
  ]);
  assert.deepEqual(schema.photoCategoryEnum.enumValues, [
    'Sebelum Pemasangan',
    'Proses Pekerjaan',
    'Hasil Akhir',
    'Lainnya',
  ]);

  const requiredTables = [
    schema.admins,
    schema.technicians,
    schema.customers,
    schema.projects,
    schema.projectActivities,
    schema.activityTechnicians,
    schema.productCatalog,
    schema.activityWorkDetails,
    schema.statusChangeLogs,
    schema.projectPhotos,
    schema.executiveSecretLinks,
    schema.executiveAccessLogs,
    schema.adminActivityLogs,
    schema.reportExportLogs,
  ];
  assert.equal(requiredTables.length, 14);
  for (const tbl of requiredTables) {
    assert.ok(tbl, 'Tabel wajib ada di skema database');
  }
});

test('PROMPT 3: Secret Link Pimpinan dibuat secara kriptografis, disimpan dalam SHA-256 hash, dan memvalidasi pencabutan serta kedaluwarsa', () => {
  const generated = generateSecureSecretToken();
  assert.ok(generated.rawToken.startsWith('zb_exec_'));
  assert.equal(generated.tokenPrefix.length, 12);
  assert.equal(generated.tokenHash.length, 64);
  assert.notEqual(generated.rawToken, generated.tokenHash);
  assert.equal(hashSecretToken(generated.rawToken), generated.tokenHash);

  const now = new Date('2026-11-02T10:00:00Z');
  const activeRecord = {
    id: 'link-1',
    label: 'Akses Pimpinan November 2026',
    tokenHash: generated.tokenHash,
    tokenPrefix: generated.tokenPrefix,
    canDownloadReports: true,
    expiresAt: new Date('2026-12-02T10:00:00Z'),
    isRevoked: false,
  };

  // 1. Token valid diterima dengan role executive read-only
  const okResult = validateSecretLinkRecord(activeRecord, generated.rawToken, now);
  assert.equal(okResult.valid, true);
  assert.equal(okResult.code, 'VALID');
  assert.equal(okResult.role, 'executive');
  assert.equal(okResult.readOnly, true);

  // 2. Token salah ditolak (401 TOKEN_NOT_FOUND)
  const wrongTokenResult = validateSecretLinkRecord(
    activeRecord,
    'zb_exec_0000000000000000000000000000000000000000000000000000000000000000',
    now
  );
  assert.equal(wrongTokenResult.valid, false);
  assert.equal(wrongTokenResult.status, 401);
  assert.equal(wrongTokenResult.code, 'TOKEN_NOT_FOUND');

  // 3. Token dicabut oleh Admin ditolak (403 TOKEN_REVOKED)
  const revokedResult = validateSecretLinkRecord(
    { ...activeRecord, isRevoked: true },
    generated.rawToken,
    now
  );
  assert.equal(revokedResult.valid, false);
  assert.equal(revokedResult.status, 403);
  assert.equal(revokedResult.code, 'TOKEN_REVOKED');

  // 4. Token kedaluwarsa ditolak (403 TOKEN_EXPIRED)
  const expiredResult = validateSecretLinkRecord(
    { ...activeRecord, expiresAt: new Date('2026-10-01T10:00:00Z') },
    generated.rawToken,
    now
  );
  assert.equal(expiredResult.valid, false);
  assert.equal(expiredResult.status, 403);
  assert.equal(expiredResult.code, 'TOKEN_EXPIRED');
});

test('PROMPT 3: Sesi Admin memvalidasi tanda tangan HMAC-SHA256 dan mendeteksi sesi kedaluwarsa', () => {
  const secret = 'test-secret-hmac-zipblind';
  const now = new Date('2026-11-02T10:00:00Z');
  const admin = {
    id: '373e0c6c-73ca-4636-949c-13ce8cc04aa7',
    email: 'admin@zipblind.co.id',
    fullName: 'Admin Utama',
  };

  // Sesi aktif (8 jam)
  const { token } = createAdminSessionToken(admin, secret, 3600, now);
  const validCheck = verifyAdminSessionToken(token, secret, now);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.code, 'VALID');
  assert.equal(validCheck.payload?.role, 'admin');

  // Sesi dimodifikasi / tanda tangan palsu ditolak
  const tamperedToken = `${token.slice(0, -4)}abcd`;
  const tamperedCheck = verifyAdminSessionToken(tamperedToken, secret, now);
  assert.equal(tamperedCheck.valid, false);
  assert.equal(tamperedCheck.code, 'INVALID_SIGNATURE');

  // Sesi kedaluwarsa ditolak dengan kode SESSION_EXPIRED
  const futureAfterExpiry = new Date('2026-11-02T12:00:00Z');
  const expiredCheck = verifyAdminSessionToken(token, secret, futureAfterExpiry);
  assert.equal(expiredCheck.valid, false);
  assert.equal(expiredCheck.code, 'SESSION_EXPIRED');
});

test('PROMPT 3: Pembatasan akses berdasarkan role (RBAC) menolak registrasi publik, menolak teknisi, dan melarang pimpinan mengubah data', () => {
  // 1. Registrasi publik dilarang
  const regCheck = authorizeRoleAccess({
    role: null,
    httpMethod: 'POST',
    targetScope: 'public_register',
  });
  assert.equal(regCheck.allowed, false);
  assert.equal(regCheck.status, 403);
  assert.equal(regCheck.code, 'PUBLIC_REGISTRATION_DISABLED');

  // 2. Teknisi tidak memiliki akun dan ditolak login
  const techCheck = authorizeRoleAccess({
    role: 'technician',
    httpMethod: 'POST',
    targetScope: 'admin',
  });
  assert.equal(techCheck.allowed, false);
  assert.equal(techCheck.status, 403);
  assert.equal(techCheck.code, 'TECHNICIAN_NO_ACCOUNT');

  // 3. Pimpinan ditolak mengakses halaman Admin
  const execOnAdmin = authorizeRoleAccess({
    role: 'executive',
    httpMethod: 'GET',
    targetScope: 'admin',
  });
  assert.equal(execOnAdmin.allowed, false);
  assert.equal(execOnAdmin.status, 403);
  assert.equal(execOnAdmin.code, 'FORBIDDEN_ROLE');

  // 4. Pimpinan diizinkan GET pada portal executive, tetapi dilarang melakukan perubahan data (POST/PUT/PATCH/DELETE)
  const execRead = authorizeRoleAccess({
    role: 'executive',
    httpMethod: 'GET',
    targetScope: 'executive',
  });
  assert.equal(execRead.allowed, true);

  for (const writeMethod of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const execWrite = authorizeRoleAccess({
      role: 'executive',
      httpMethod: writeMethod,
      targetScope: 'executive',
    });
    assert.equal(execWrite.allowed, false);
    assert.equal(execWrite.status, 403);
    assert.equal(execWrite.code, 'FORBIDDEN_READ_ONLY');
  }
});

test('PROMPT 4: Jadwal Teknisi menampilkan beberapa teknisi dalam satu kolom tanpa kolom jenis penugasan, serta mendukung filter kalender harian, mingguan, dan bulanan', () => {
  const combined = formatAssignedTechniciansColumn([
    { fullName: 'Budi Santoso' },
    { fullName: 'Andi Pratama' },
    { fullName: 'Dedi Kurniawan' },
  ]);
  assert.equal(combined, 'Budi Santoso, Andi Pratama, Dedi Kurniawan');

  const sampleSchedules = [
    { id: '1', startDate: '2026-11-10', endDate: '2026-11-10', status: 'Selesai' as const },
    { id: '2', startDate: '2026-11-11', endDate: '2026-11-14', status: 'Selesai' as const },
    { id: '3', startDate: '2026-12-15', endDate: '2026-12-15', status: 'Dijadwalkan' as const },
  ];

  // Harian pada 2026-11-10
  const daily = filterSchedulesByCalendarMode(sampleSchedules, 'harian', '2026-11-10');
  assert.equal(daily.length, 1);
  assert.equal(daily[0].id, '1');

  // Mingguan pada minggu 2026-11-10 (mencakup 10 Nov dan 11-14 Nov)
  const weekly = filterSchedulesByCalendarMode(sampleSchedules, 'mingguan', '2026-11-10');
  assert.equal(weekly.length, 2);

  // Bulanan pada Desember 2026
  const decMonthly = filterSchedulesByCalendarMode(sampleSchedules, 'bulanan', '2026-12-15');
  assert.equal(decMonthly.length, 1);
  assert.equal(decMonthly[0].id, '3');
});

test('PROMPT 4: Pemisahan status proyek vs status aktivitas, pencegahan aktivitas belum selesai dianggap selesai, dan aturan lintas bulan tanpa duplikasi proyek baru', () => {
  // Pemetaan jenis aktivitas Persiapan
  assert.equal(mapToDbActivityType('Persiapan'), 'Lainnya');
  const encoded = encodeActivityTitleWithType('Persiapan', 'Fabrikasi Rel Zipblind');
  const decoded = decodeActivityTypeAndTitle('Lainnya', encoded);
  assert.equal(decoded.activityType, 'Persiapan');
  assert.equal(decoded.cleanTitle, 'Fabrikasi Rel Zipblind');

  // Contoh spesifikasi PROMPT 4:
  // Pengukuran 10 Nov (Selesai), Persiapan 11 Nov (Selesai), Pemasangan 15 Des (Dijadwalkan / Belum Selesai)
  const rumahAActivities = [
    {
      id: 'act-1',
      projectId: 'prj-rumah-a',
      projectStartDate: '2026-11-10',
      startDate: '2026-11-10',
      status: 'Selesai' as const,
      quantitySets: 8,
    },
    {
      id: 'act-2',
      projectId: 'prj-rumah-a',
      projectStartDate: '2026-11-10',
      startDate: '2026-11-11',
      status: 'Selesai' as const,
      quantitySets: 8,
    },
    {
      id: 'act-3',
      projectId: 'prj-rumah-a',
      projectStartDate: '2026-11-10',
      startDate: '2026-12-15',
      status: 'Dijadwalkan' as const,
      quantitySets: 8,
    },
  ];

  // Aktivitas 15 Des terdeteksi sebagai lintas bulan terhadap proyek yang dimulai 10 Nov
  assert.equal(isCrossMonthActivity('2026-11-10', '2026-11-10'), false);
  assert.equal(isCrossMonthActivity('2026-11-10', '2026-12-15'), true);

  // Proyek TIDAK BOLEH dianggap Selesai selama aktivitas Pemasangan 15 Des masih Dijadwalkan
  const blockedCheck = validateProjectStatusTransition('Selesai', rumahAActivities);
  assert.equal(blockedCheck.allowed, false);
  assert.equal(blockedCheck.completedActivities, 2);
  assert.equal(blockedCheck.incompleteActivities, 1);

  // Rekap bulan Desember 2026: Proyek Rumah A terhitung sebagai Proyek Lanjutan Lintas Bulan (1),
  // BUKAN Proyek Baru (0)! Dan aktivitas Dijadwalkan tidak dihitung sebagai selesai (0).
  const decRecap = summarizeActivitiesByPeriodAndStatus(rumahAActivities, '2026-12');
  assert.equal(decRecap.distinctProjectsInPeriod, 1);
  assert.equal(decRecap.newProjectsStartedInPeriod, 0);
  assert.equal(decRecap.continuingCrossMonthProjectsInPeriod, 1);
  assert.equal(decRecap.completedActivitiesCount, 0);
  assert.equal(decRecap.scheduledActivitiesCount, 1);
});

test('PROMPT 5: Galeri Dokumentasi memiliki 8 kategori eksak, memisahkan foto pengukuran dari foto pemasangan dalam proyek yang sama, dan hanya mengaktifkan Before/After untuk Service/Perbaikan', () => {
  assert.deepEqual(GALLERY_DOCUMENTATION_CATEGORIES, [
    'Survey',
    'Pengukuran',
    'Persiapan',
    'Proses pemasangan',
    'Hasil akhir',
    'Service sebelum dan sesudah',
    'Pengiriman',
    'Lainnya',
  ]);

  // Aturan Before/After: TIDAK dipaksakan pada Pengukuran atau Pemasangan, HANYA untuk Service/Perbaikan
  assert.equal(isBeforeAfterApplicable('Pengukuran', 'Pengukuran'), false);
  assert.equal(isBeforeAfterApplicable('Proses pemasangan', 'Pemasangan'), false);
  assert.equal(isBeforeAfterApplicable('Hasil akhir', 'Pemasangan'), false);
  assert.equal(isBeforeAfterApplicable('Service sebelum dan sesudah', 'Service'), true);
  assert.equal(isBeforeAfterApplicable('Lainnya', 'Perbaikan'), true);

  // Encode & Decode metadata kategori dokumentasi
  const encodedService = encodePhotoCaptionWithMetadata({
    documentationCategory: 'Service sebelum dan sesudah',
    servicePhase: 'Sebelum Service',
    caption: 'Kondisi motor tubular sebelum penggantian komponen',
  });
  const decodedService = decodePhotoCaptionMetadata(
    mapDocCategoryToDbEnum('Service sebelum dan sesudah'),
    encodedService
  );
  assert.equal(decodedService.documentationCategory, 'Service sebelum dan sesudah');
  assert.equal(decodedService.servicePhase, 'Sebelum Service');
  assert.equal(
    decodedService.cleanCaption,
    'Kondisi motor tubular sebelum penggantian komponen'
  );

  // Uji Pemisahan Foto Pengukuran & Foto Pemasangan pada Proyek yang Sama
  const sampleProjects = [
    {
      id: 'prj-1',
      projectCode: 'PRJ-ZB-26101',
      title: 'Proyek Rumah A Kemang',
      status: 'Sedang Berjalan' as const,
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      customerCity: 'Jakarta Selatan',
      installationAddress: 'Jl. Kemang Timur No. 42',
      primaryProductName: 'Zipblind',
      totalQuantitySets: 8,
    },
  ];

  const samplePhotos: GalleryPhotoItem[] = [
    {
      id: 'ph-ukur-1',
      projectId: 'prj-1',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A Kemang',
      projectStatus: 'Sedang Berjalan',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      customerCity: 'Jakarta Selatan',
      installationAddress: 'Jl. Kemang Timur No. 42',
      activityId: 'act-ukur',
      activityCode: 'ACT-ZB-26101-A',
      activityType: 'Pengukuran',
      activityTitle: 'Pengukuran Presisi Bukaan Teras',
      activityDate: '2026-11-10',
      activityStatus: 'Selesai',
      productName: 'Zipblind',
      quantitySets: 8,
      documentationCategory: 'Pengukuran',
      servicePhase: 'Normal',
      storageBucket: 'project-photos',
      storagePath: 'prj-1/ukur.png',
      fileName: 'ukur.png',
      mimeType: 'image/png',
      fileSizeBytes: 1024,
      caption: 'Foto laser meter bukaan teras',
      imageUrl: '/api/admin/gallery/download/ph-ukur-1',
      downloadUrl: '/api/admin/gallery/download/ph-ukur-1?download=1',
      uploadedAt: '2026-11-10T10:00:00Z',
    },
    {
      id: 'ph-pasang-1',
      projectId: 'prj-1',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A Kemang',
      projectStatus: 'Sedang Berjalan',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      customerCity: 'Jakarta Selatan',
      installationAddress: 'Jl. Kemang Timur No. 42',
      activityId: 'act-pasang',
      activityCode: 'ACT-ZB-26101-C',
      activityType: 'Pemasangan',
      activityTitle: 'Pemasangan Utama Zipblind',
      activityDate: '2026-12-15',
      activityStatus: 'Dijadwalkan',
      productName: 'Zipblind',
      quantitySets: 8,
      documentationCategory: 'Proses pemasangan',
      servicePhase: 'Normal',
      storageBucket: 'project-photos',
      storagePath: 'prj-1/pasang.png',
      fileName: 'pasang.png',
      mimeType: 'image/png',
      fileSizeBytes: 2048,
      caption: 'Foto pemasangan bracket utama',
      imageUrl: '/api/admin/gallery/download/ph-pasang-1',
      downloadUrl: '/api/admin/gallery/download/ph-pasang-1?download=1',
      uploadedAt: '2026-12-15T10:00:00Z',
    },
  ];

  const albums = buildProjectAlbumsWithStages(sampleProjects, samplePhotos);
  assert.equal(albums.length, 1);
  assert.equal(albums[0].totalPhotos, 2);
  // Foto pengukuran dan foto pemasangan WAJIB terpisah dalam 2 stageGroups berbeda!
  assert.equal(albums[0].stageGroups.length, 2);
  assert.equal(albums[0].stageGroups[0].activityType, 'Pengukuran');
  assert.equal(albums[0].stageGroups[1].activityType, 'Pemasangan');

  // Uji filter berdasarkan jenis aktivitas, produk, status, pelanggan/lokasi, dan kategori
  const onlyUkur = filterGalleryPhotos(samplePhotos, { activityType: 'Pengukuran' });
  assert.equal(onlyUkur.length, 1);
  assert.equal(onlyUkur[0].id, 'ph-ukur-1');

  const onlyPasangCat = filterGalleryPhotos(samplePhotos, {
    documentationCategory: 'Proses pemasangan',
  });
  assert.equal(onlyPasangCat.length, 1);
  assert.equal(onlyPasangCat[0].id, 'ph-pasang-1');
});

test('PROMPT 6 (Skenario 1 & Aturan 1, 2, 3, 5, 6): Monitoring 5 kondisi pekerjaan, proyek tidak dianggap selesai jika ada aktivitas belum selesai, dan jumlah set mengikuti detail pekerjaan', () => {
  assert.deepEqual(MONITORING_WORK_CONDITIONS, [
    'Belum dimulai',
    'Sedang berjalan',
    'Selesai',
    'Tertunda',
    'Dibatalkan',
  ]);

  assert.equal(normalizeToMonitoringCondition('Belum Dimulai'), 'Belum dimulai');
  assert.equal(normalizeToMonitoringCondition('Dijadwalkan'), 'Belum dimulai');
  assert.equal(normalizeToMonitoringCondition('Sedang Berjalan'), 'Sedang berjalan');
  assert.equal(normalizeToMonitoringCondition('Selesai'), 'Selesai');
  assert.equal(normalizeToMonitoringCondition('Tertunda'), 'Tertunda');
  assert.equal(normalizeToMonitoringCondition('Dibatalkan'), 'Dibatalkan');

  const sampleTechs = [
    {
      id: 'tech-1',
      technicianCode: 'TECH-ZB-001',
      fullName: 'Budi Santoso',
      specialization: 'Motorized Zipblind',
      avatarUrl: '/images/ref_exec_tech1.png',
      isActive: true,
    },
    {
      id: 'tech-2',
      technicianCode: 'TECH-ZB-002',
      fullName: 'Andi Pratama',
      specialization: 'Outdoor Blind',
      avatarUrl: '/images/ref_exec_tech2.png',
      isActive: true,
    },
    {
      id: 'tech-3',
      technicianCode: 'TECH-ZB-003',
      fullName: 'Dedi Kurniawan',
      specialization: 'Roller & Vertical Blind',
      avatarUrl: '/images/ref_exec_tech3.png',
      isActive: true,
    },
  ];

  const sampleProjects = [
    {
      id: 'prj-1',
      projectCode: 'PRJ-ZB-26101',
      title: 'Proyek Rumah A Kemang',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Jl. Kemang Timur No. 42',
      status: 'Sedang Berjalan' as const,
      startDate: '2026-11-10',
    },
    {
      id: 'prj-2',
      projectCode: 'PRJ-ZB-26102',
      title: 'Kantor Nusantara SCBD',
      customerId: 'cust-2',
      customerName: 'PT Nusantara Capital',
      installationAddress: 'SCBD Lot 9',
      status: 'Selesai' as const,
      startDate: '2026-11-05',
    },
    {
      id: 'prj-3',
      projectCode: 'PRJ-ZB-26103',
      title: 'Villa PIK 2',
      customerId: 'cust-3',
      customerName: 'Ibu Clarissa Wijaya',
      installationAddress: 'PIK 2',
      status: 'Sedang Berjalan' as const,
      startDate: '2026-11-10',
    },
    {
      id: 'prj-4',
      projectCode: 'PRJ-ZB-26104',
      title: 'Klinik Medika Utama',
      customerId: 'cust-4',
      customerName: 'Klinik Medika',
      installationAddress: 'Menteng',
      status: 'Tertunda' as const,
      startDate: '2026-11-14',
    },
    {
      id: 'prj-5',
      projectCode: 'PRJ-ZB-26105',
      title: 'Ruko Harmoni',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Harmoni',
      status: 'Dibatalkan' as const,
      startDate: '2026-11-16',
    },
  ];

  const sampleActivities: OperationalActivityRecord[] = [
    // Proyek 1: Pengukuran (Selesai, 8 set), Persiapan (Selesai, 8 set), Pemasangan 15 Des (Dijadwalkan/Belum dimulai, 8 set)
    {
      id: 'act-1a',
      projectId: 'prj-1',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A Kemang',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Jl. Kemang Timur No. 42',
      activityCode: 'ACT-1A',
      activityType: 'Pengukuran',
      title: 'Pengukuran Rumah A',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      scheduledTimeSlot: '09:00 - 12:00 WIB',
      status: 'Selesai',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [sampleTechs[0], sampleTechs[1]],
      isCrossMonth: false,
    },
    {
      id: 'act-1b',
      projectId: 'prj-1',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A Kemang',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Jl. Kemang Timur No. 42',
      activityCode: 'ACT-1B',
      activityType: 'Persiapan',
      title: 'Persiapan Rumah A',
      startDate: '2026-11-11',
      endDate: '2026-11-14',
      scheduledTimeSlot: '10:00 - 16:00 WIB',
      status: 'Selesai',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [sampleTechs[0]],
      isCrossMonth: false,
    },
    {
      id: 'act-1c',
      projectId: 'prj-1',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A Kemang',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Jl. Kemang Timur No. 42',
      activityCode: 'ACT-1C',
      activityType: 'Pemasangan',
      title: 'Pemasangan Rumah A',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      scheduledTimeSlot: '08:30 - 16:30 WIB',
      status: 'Dijadwalkan',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [sampleTechs[0], sampleTechs[1], sampleTechs[2]],
      isCrossMonth: true,
    },
    // Proyek 2: Semua aktivitas selesai (14 set Roller Blind)
    {
      id: 'act-2a',
      projectId: 'prj-2',
      projectCode: 'PRJ-ZB-26102',
      projectTitle: 'Kantor Nusantara SCBD',
      projectStatus: 'Selesai',
      projectStartDate: '2026-11-05',
      customerId: 'cust-2',
      customerName: 'PT Nusantara Capital',
      installationAddress: 'SCBD Lot 9',
      activityCode: 'ACT-2A',
      activityType: 'Pengukuran',
      title: 'Pengukuran SCBD',
      startDate: '2026-11-05',
      endDate: '2026-11-05',
      scheduledTimeSlot: '09:00 - 12:00 WIB',
      status: 'Selesai',
      notes: null,
      productId: 'prod-2',
      productName: 'Roller Blind',
      quantitySets: 14,
      technicians: [sampleTechs[2]],
      isCrossMonth: false,
    },
    {
      id: 'act-2b',
      projectId: 'prj-2',
      projectCode: 'PRJ-ZB-26102',
      projectTitle: 'Kantor Nusantara SCBD',
      projectStatus: 'Selesai',
      projectStartDate: '2026-11-05',
      customerId: 'cust-2',
      customerName: 'PT Nusantara Capital',
      installationAddress: 'SCBD Lot 9',
      activityCode: 'ACT-2B',
      activityType: 'Pemasangan',
      title: 'Pemasangan SCBD',
      startDate: '2026-11-12',
      endDate: '2026-11-12',
      scheduledTimeSlot: '13:00 - 17:30 WIB',
      status: 'Selesai',
      notes: null,
      productId: 'prod-2',
      productName: 'Roller Blind',
      quantitySets: 14,
      technicians: [sampleTechs[2]],
      isCrossMonth: false,
    },
    // Proyek 3: Sedang Berjalan (6 set Zipblind)
    {
      id: 'act-3a',
      projectId: 'prj-3',
      projectCode: 'PRJ-ZB-26103',
      projectTitle: 'Villa PIK 2',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-3',
      customerName: 'Ibu Clarissa Wijaya',
      installationAddress: 'PIK 2',
      activityCode: 'ACT-3A',
      activityType: 'Pemasangan',
      title: 'Instalasi Villa PIK 2',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      scheduledTimeSlot: '13:00 - 17:00 WIB',
      status: 'Sedang Berjalan',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 6,
      technicians: [sampleTechs[1], sampleTechs[0]],
      isCrossMonth: false,
    },
    // Proyek 4: Tertunda (10 set Vertical Blind)
    {
      id: 'act-4a',
      projectId: 'prj-4',
      projectCode: 'PRJ-ZB-26104',
      projectTitle: 'Klinik Medika Utama',
      projectStatus: 'Tertunda',
      projectStartDate: '2026-11-14',
      customerId: 'cust-4',
      customerName: 'Klinik Medika',
      installationAddress: 'Menteng',
      activityCode: 'ACT-4A',
      activityType: 'Survey',
      title: 'Survey Klinik Medika',
      startDate: '2026-11-14',
      endDate: '2026-11-14',
      scheduledTimeSlot: '14:00 - 16:00 WIB',
      status: 'Tertunda',
      notes: null,
      productId: 'prod-3',
      productName: 'Vertical Blind',
      quantitySets: 10,
      technicians: [sampleTechs[2]],
      isCrossMonth: false,
    },
    // Proyek 5: Dibatalkan (4 set Venetian Blind)
    {
      id: 'act-5a',
      projectId: 'prj-5',
      projectCode: 'PRJ-ZB-26105',
      projectTitle: 'Ruko Harmoni',
      projectStatus: 'Dibatalkan',
      projectStartDate: '2026-11-16',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Harmoni',
      activityCode: 'ACT-5A',
      activityType: 'Survey',
      title: 'Survey Ruko Harmoni',
      startDate: '2026-11-16',
      endDate: '2026-11-16',
      scheduledTimeSlot: '10:00 - 12:00 WIB',
      status: 'Dibatalkan',
      notes: null,
      productId: 'prod-4',
      productName: 'Venetian Blind',
      quantitySets: 4,
      technicians: [sampleTechs[1]],
      isCrossMonth: false,
    },
  ];

  // Aturan 2: Evaluasi proyek Rumah A (2 Selesai, 1 Dijadwalkan) -> TIDAK BOLEH dianggap Selesai!
  const prj1Eval = evaluateEffectiveProjectCondition('Selesai', [
    { status: 'Selesai' },
    { status: 'Selesai' },
    { status: 'Dijadwalkan' },
  ]);
  assert.equal(prj1Eval.isFullyCompleted, false);
  assert.equal(prj1Eval.effectiveCondition, 'Sedang berjalan');

  // Proyek 2 (2 Selesai dari 2 aktivitas) -> Selesai penuh
  const prj2Eval = evaluateEffectiveProjectCondition('Selesai', [
    { status: 'Selesai' },
    { status: 'Selesai' },
  ]);
  assert.equal(prj2Eval.isFullyCompleted, true);
  assert.equal(prj2Eval.effectiveCondition, 'Selesai');

  const recapAll = calculateMonitoringAndWorkRecap({
    activities: sampleActivities,
    projects: sampleProjects,
    technicians: sampleTechs,
  });

  // Aturan 5: 8 aktivitas dari 5 proyek tetap dihitung sebagai 5 proyek (aktivitas lanjutan tidak dihitung proyek baru)
  assert.equal(recapAll.totalProjects, 5);
  assert.equal(recapAll.totalActivities, 8);
  assert.equal(recapAll.fullyCompletedProjectsCount, 1); // Hanya Proyek 2 yang selesai penuh

  // Monitoring 5 kondisi pekerjaan
  assert.equal(recapAll.monitoringConditionsCount['Belum dimulai'], 1); // act-1c
  assert.equal(recapAll.monitoringConditionsCount['Sedang berjalan'], 1); // act-3a
  assert.equal(recapAll.monitoringConditionsCount['Selesai'], 4); // act-1a, act-1b, act-2a, act-2b
  assert.equal(recapAll.monitoringConditionsCount['Tertunda'], 1); // act-4a
  assert.equal(recapAll.monitoringConditionsCount['Dibatalkan'], 1); // act-5a

  // Rekap pekerjaan: Selesai = 4, Berjalan = 1, Tertunda (termasuk aktivitas belum selesai/menunggu jadwal) = 2
  assert.equal(recapAll.totalCompletedWork, 4);
  assert.equal(recapAll.totalOngoingWork, 1);
  assert.equal(recapAll.totalPendingWork, 2);
  assert.equal(recapAll.strictDelayedWorkCount, 1);
  assert.equal(recapAll.notStartedWorkCount, 1);

  // Aturan 6: Jumlah set mengikuti detail pekerjaan aktif (8+8+8+14+14+6+10 = 68 set), bukan jumlah proyek (5)
  assert.equal(recapAll.totalSets, 68);
  assert.equal(recapAll.completedSets, 44); // 8 + 8 + 14 + 14

  // Total berdasarkan jenis aktivitas
  const ukurRecap = recapAll.byActivityType.find((a) => a.activityType === 'Pengukuran');
  assert.ok(ukurRecap);
  assert.equal(ukurRecap.totalActivities, 2);
  assert.equal(ukurRecap.totalSets, 22); // 8 + 14

  const pasangRecap = recapAll.byActivityType.find((a) => a.activityType === 'Pemasangan');
  assert.ok(pasangRecap);
  assert.equal(pasangRecap.totalActivities, 3);
  assert.equal(pasangRecap.completedActivities, 1);
  assert.equal(pasangRecap.ongoingActivities, 1);
  assert.equal(pasangRecap.pendingActivities, 1);
  assert.equal(pasangRecap.totalSets, 28); // 8 + 14 + 6

  // Total berdasarkan produk
  const zipProd = recapAll.byProduct.find((p) => p.productName === 'Zipblind');
  assert.ok(zipProd);
  assert.equal(zipProd.totalActivities, 4);
  assert.equal(zipProd.distinctProjectsCount, 2);
  assert.equal(zipProd.totalSets, 30); // 8 + 8 + 8 + 6

  // Produktivitas masing-masing teknisi
  const budiProd = recapAll.technicianProductivity.find((t) => t.technicianId === 'tech-1');
  assert.ok(budiProd);
  assert.equal(budiProd.totalAssignedActivities, 4); // act-1a, act-1b, act-1c, act-3a
  assert.equal(budiProd.completedActivities, 2); // act-1a, act-1b
  assert.equal(budiProd.ongoingActivities, 1); // act-3a
  assert.equal(budiProd.pendingActivities, 1); // act-1c
  assert.equal(budiProd.totalSetsHandled, 30); // 8 + 8 + 8 + 6
});

test('PROMPT 6 (Skenario 2 & Aturan 4, 5): Aktivitas lintas bulan dihitung pada periode pelaksanaan yang sesuai dan aktivitas lanjutan tidak dihitung sebagai proyek baru', () => {
  const activities: OperationalActivityRecord[] = [
    {
      id: 'act-nov-1',
      projectId: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang',
      activityCode: 'ACT-1',
      activityType: 'Pengukuran',
      title: 'Pengukuran',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      scheduledTimeSlot: '09:00',
      status: 'Selesai',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [],
      isCrossMonth: false,
    },
    {
      id: 'act-nov-2',
      projectId: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang',
      activityCode: 'ACT-2',
      activityType: 'Persiapan',
      title: 'Persiapan',
      startDate: '2026-11-11',
      endDate: '2026-11-14',
      scheduledTimeSlot: '10:00',
      status: 'Selesai',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [],
      isCrossMonth: false,
    },
    {
      id: 'act-dec-3',
      projectId: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang',
      activityCode: 'ACT-3',
      activityType: 'Pemasangan',
      title: 'Pemasangan',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      scheduledTimeSlot: '08:30',
      status: 'Dijadwalkan',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [],
      isCrossMonth: true,
    },
  ];

  // Periode November 2026: Hanya 2 aktivitas yang tercatat pada November (Pengukuran & Persiapan)
  const novRecap = calculateMonitoringAndWorkRecap({
    activities,
    filters: { periodMonth: '2026-11' },
  });
  assert.equal(novRecap.totalActivities, 2);
  assert.equal(novRecap.totalCompletedWork, 2);
  assert.equal(novRecap.totalPendingWork, 0);
  assert.equal(novRecap.totalSets, 16);
  assert.equal(novRecap.newProjectsInPeriod, 1);
  assert.equal(novRecap.followUpContinuingProjectsInPeriod, 0);
  // Meskipun 2 aktivitas di bulan November selesai, proyek Rumah A tetap TIDAK dianggap selesai penuh
  // karena masih ada aktivitas Pemasangan pada 15 Desember yang belum selesai!
  assert.equal(novRecap.fullyCompletedProjectsCount, 0);
  assert.equal(novRecap.projectSummaries[0].effectiveProjectCondition, 'Sedang berjalan');

  // Periode Desember 2026: Hanya 1 aktivitas lanjutan (Pemasangan 15 Des), dan TIDAK dihitung sebagai proyek baru!
  const decRecap = calculateMonitoringAndWorkRecap({
    activities,
    filters: { periodMonth: '2026-12' },
  });
  assert.equal(decRecap.totalActivities, 1);
  assert.equal(decRecap.totalCompletedWork, 0);
  assert.equal(decRecap.totalPendingWork, 1);
  assert.equal(decRecap.totalSets, 8);
  assert.equal(decRecap.newProjectsInPeriod, 0); // Bukan proyek baru!
  assert.equal(decRecap.followUpContinuingProjectsInPeriod, 1); // Proyek lanjutan lintas bulan
  assert.equal(decRecap.filteredActivities[0].isFollowUpActivity, true);
});

test('PROMPT 7: Waktu pembuatan otomatis tanggal 1 bulan berikutnya, pencegahan duplikasi laporan periode yang sama, 14 isi laporan lengkap, skenario lintas bulan Proyek Rumah A, serta ekspor PDF & Excel', () => {
  // 1. Waktu Pembuatan: Laporan November dibuat pada 1 Desember; Laporan Desember dibuat pada 1 Januari
  const novCreation = getOfficialReportCreationDate('2026-11');
  assert.equal(novCreation.isoDate, '2026-12-01');
  assert.equal(novCreation.label, '1 Desember 2026');

  const decCreation = getOfficialReportCreationDate('2026-12');
  assert.equal(decCreation.isoDate, '2027-01-01');
  assert.equal(decCreation.label, '1 Januari 2027');

  assert.equal(getPreviousPeriodMonth('2026-11'), '2026-10');
  assert.equal(getPreviousPeriodMonth('2026-12'), '2026-11');
  assert.equal(getPreviousPeriodMonth('2027-01'), '2026-12');

  // 2. Pencegahan Laporan Ganda untuk Periode yang Sama
  const initialArchives = [
    { id: 'rep-1', periodMonth: '2026-11', title: 'Laporan November 2026' },
  ];
  const duplicateAttempt = ensureUniqueMonthlyReportArchive(initialArchives, {
    id: 'rep-2',
    periodMonth: '2026-11',
    title: 'Laporan November 2026 Duplikat',
  });
  assert.equal(duplicateAttempt.duplicatePrevented, true);
  assert.equal(duplicateAttempt.archives.length, 1);
  assert.equal(duplicateAttempt.existingReport.id, 'rep-1');

  const newPeriodAttempt = ensureUniqueMonthlyReportArchive(initialArchives, {
    id: 'rep-dec',
    periodMonth: '2026-12',
    title: 'Laporan Desember 2026',
  });
  assert.equal(newPeriodAttempt.duplicatePrevented, false);
  assert.equal(newPeriodAttempt.archives.length, 2);

  // 3. Uji Skenario Lintas Bulan Proyek Rumah A & 14 Isi Laporan
  const sampleTech = {
    id: 'tech-1',
    technicianCode: 'TECH-ZB-001',
    fullName: 'Budi Santoso',
    specialization: 'Motorized Zipblind',
    avatarUrl: '/images/ref_exec_tech1.png',
    isActive: true,
  };

  const sampleProjects = [
    {
      id: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      title: 'Proyek Rumah A',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang, Jakarta Selatan',
      status: 'Sedang Berjalan' as const,
      startDate: '2026-11-10',
    },
    {
      id: 'prj-scbd',
      projectCode: 'PRJ-ZB-26102',
      title: 'Kantor SCBD',
      customerId: 'cust-2',
      customerName: 'PT Nusantara Capital',
      installationAddress: 'SCBD Lot 9',
      status: 'Selesai' as const,
      startDate: '2026-11-05',
    },
  ];

  const sampleActivities: OperationalActivityRecord[] = [
    // Proyek Rumah A: Pengukuran selesai pada November
    {
      id: 'act-ra-ukur',
      projectId: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang',
      activityCode: 'ACT-RA-1',
      activityType: 'Pengukuran',
      title: 'Pengukuran Rumah A',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      scheduledTimeSlot: '09:00',
      status: 'Selesai',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [sampleTech],
      isCrossMonth: false,
    },
    // Proyek Rumah A: Pemasangan dilakukan pada Desember
    {
      id: 'act-ra-pasang',
      projectId: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang',
      activityCode: 'ACT-RA-2',
      activityType: 'Pemasangan',
      title: 'Pemasangan Rumah A',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      scheduledTimeSlot: '09:00',
      status: 'Dijadwalkan',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [sampleTech],
      isCrossMonth: true,
    },
    // Proyek SCBD: Pemasangan selesai penuh di November
    {
      id: 'act-scbd-pasang',
      projectId: 'prj-scbd',
      projectCode: 'PRJ-ZB-26102',
      projectTitle: 'Kantor SCBD',
      projectStatus: 'Selesai',
      projectStartDate: '2026-11-05',
      customerId: 'cust-2',
      customerName: 'PT Nusantara Capital',
      installationAddress: 'SCBD',
      activityCode: 'ACT-SCBD-1',
      activityType: 'Pemasangan',
      title: 'Pemasangan SCBD',
      startDate: '2026-11-12',
      endDate: '2026-11-12',
      scheduledTimeSlot: '13:00',
      status: 'Selesai',
      notes: null,
      productId: 'prod-2',
      productName: 'Roller Blind',
      quantitySets: 14,
      technicians: [sampleTech],
      isCrossMonth: false,
    },
  ];

  // A. LAPORAN NOVEMBER 2026:
  // - Menampilkan Pengukuran Rumah A sebagai Selesai
  // - Menampilkan Pemasangan Rumah A sebagai pekerjaan yang belum dilaksanakan (terjadwal 15 Desember)
  // - Proyek Rumah A berstatus Berjalan (bukan Selesai), sedangkan Proyek SCBD berstatus Selesai
  const novReport = buildOfficialMonthlyReport({
    periodMonth: '2026-11',
    activities: sampleActivities,
    projects: sampleProjects,
    technicians: [sampleTech],
    products: [
      { id: 'prod-1', name: 'Zipblind' },
      { id: 'prod-2', name: 'Roller Blind' },
    ],
    photos: [
      {
        id: 'ph-1',
        projectId: 'prj-rumah-a',
        projectCode: 'PRJ-ZB-26101',
        projectTitle: 'Proyek Rumah A',
        activityId: 'act-ra-ukur',
        activityType: 'Pengukuran',
        activityDate: '2026-11-10',
        documentationCategory: 'Pengukuran',
        caption: 'Foto pengukuran Rumah A',
        uploadedAt: '2026-11-10T10:00:00Z',
        imageUrl: '/images/ref_proj_thumb.png',
      },
    ],
  });

  assert.equal(novReport.officialGeneratedDate, '2026-12-01');
  assert.equal(novReport.totalProjects, 2);
  assert.equal(novReport.newProjectsCount, 2);
  assert.equal(novReport.continuingProjectsCount, 0);
  assert.equal(novReport.completedProjects, 1); // Hanya SCBD
  assert.equal(novReport.ongoingProjects, 1); // Rumah A karena pemasangan masih di Desember
  assert.equal(novReport.measurementActivity.executedInPeriodCount, 1);
  assert.equal(novReport.measurementActivity.completedCount, 1);
  // Pemasangan di November: 1 dilaksanakan & selesai (SCBD), dan 1 belum dilaksanakan karena jadwal Desember (Rumah A)
  assert.equal(novReport.installationActivity.executedInPeriodCount, 1);
  assert.equal(novReport.installationActivity.completedCount, 1);
  assert.equal(novReport.installationActivity.unexecutedFutureCrossMonthCount, 1);
  assert.equal(novReport.installationActivity.unexecutedFutureCrossMonthSets, 8);
  assert.equal(novReport.totalSets, 22); // 8 + 14
  assert.equal(novReport.photoDocumentation.length, 1);

  const rumahAInNov = novReport.projectDetails.find((p) => p.projectId === 'prj-rumah-a');
  assert.ok(rumahAInNov);
  assert.equal(rumahAInNov.statusInPeriod, 'Berjalan');
  assert.equal(rumahAInNov.activitiesInPeriod.length, 1);
  assert.equal(rumahAInNov.activitiesInPeriod[0].activityType, 'Pengukuran');
  assert.equal(rumahAInNov.activitiesInPeriod[0].condition, 'Selesai');
  assert.equal(rumahAInNov.unexecutedFollowUpActivities.length, 1);
  assert.equal(rumahAInNov.unexecutedFollowUpActivities[0].activityType, 'Pemasangan');

  // B. LAPORAN DESEMBER 2026:
  // - Menampilkan aktivitas Pemasangan Rumah A sesuai pelaksanaannya di Desember
  // - TIDAK menghitung aktivitas Desember sebagai proyek baru (newProjectsCount = 0, continuingProjectsCount = 1)
  // - Perbandingan dengan bulan sebelumnya otomatis mengacu ke November 2026
  const decReport = buildOfficialMonthlyReport({
    periodMonth: '2026-12',
    activities: sampleActivities,
    projects: sampleProjects,
    technicians: [sampleTech],
  });

  assert.equal(decReport.officialGeneratedDate, '2027-01-01');
  assert.equal(decReport.totalProjects, 1);
  assert.equal(decReport.newProjectsCount, 0); // BUKAN proyek baru!
  assert.equal(decReport.continuingProjectsCount, 1); // Proyek lanjutan dari November
  assert.equal(decReport.installationActivity.executedInPeriodCount, 1);
  assert.equal(decReport.totalSets, 8);
  assert.equal(decReport.previousMonthComparison.previousPeriodMonth, '2026-11');
  assert.equal(decReport.previousMonthComparison.previousTotalProjects, 2);
  assert.equal(decReport.previousMonthComparison.previousTotalSets, 22);

  // C. Uji generator PDF & Excel
  const pdfBuf = generateMonthlyReportPdfBuffer(novReport);
  const pdfStr = pdfBuf.toString('utf-8');
  assert.ok(pdfStr.startsWith('%PDF-1.4'));
  assert.ok(pdfStr.includes('LAPORAN OPERASIONAL BULANAN RESMI'));
  assert.ok(pdfStr.includes('%%EOF'));

  const excelBuf = generateMonthlyReportExcelBuffer(novReport);
  const excelStr = excelBuf.toString('utf-8');
  assert.ok(excelStr.includes('<?mso-application progid="Excel.Sheet"?>'));
  assert.ok(excelStr.includes('LAPORAN OPERASIONAL BULANAN RESMI ZIPBLIND'));
});

test('PROMPT 8: Dashboard Pimpinan menampilkan 13 konten wajib dari data aktual, menegakkan mode Read-Only, mencegah kebocoran data internal admin, serta memvalidasi token aktif, kedaluwarsa, dan dicabut', () => {
  const sampleTech = {
    id: 'tech-1',
    technicianCode: 'TECH-ZB-001',
    fullName: 'Budi Santoso',
    specialization: 'Spesialis Motorized & Outdoor Zipblind',
    avatarUrl: '/images/ref_exec_tech1.png',
    isActive: true,
  };

  const sampleProjects = [
    {
      id: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      title: 'Proyek Rumah A — Teras & Patio Kemang',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang, Jakarta Selatan',
      status: 'Sedang Berjalan' as const,
      startDate: '2026-11-10',
    },
    {
      id: 'prj-scbd',
      projectCode: 'PRJ-ZB-26102',
      title: 'Proyek Fasad Executive Lounge SCBD',
      customerId: 'cust-2',
      customerName: 'PT Nusantara Capital',
      installationAddress: 'SCBD Lot 28',
      status: 'Selesai' as const,
      startDate: '2026-11-05',
    },
  ];

  const sampleActivities: OperationalActivityRecord[] = [
    {
      id: 'act-1',
      projectId: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A — Teras & Patio Kemang',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang',
      activityCode: 'ACT-RA-1',
      activityType: 'Pengukuran',
      title: 'Pengukuran Rumah A',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      scheduledTimeSlot: '09:00',
      status: 'Selesai',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [sampleTech],
      isCrossMonth: false,
    },
    {
      id: 'act-2',
      projectId: 'prj-rumah-a',
      projectCode: 'PRJ-ZB-26101',
      projectTitle: 'Proyek Rumah A — Teras & Patio Kemang',
      projectStatus: 'Sedang Berjalan',
      projectStartDate: '2026-11-10',
      customerId: 'cust-1',
      customerName: 'Bpk. Hendra Kusuma',
      installationAddress: 'Kemang',
      activityCode: 'ACT-RA-2',
      activityType: 'Pemasangan',
      title: 'Pemasangan Rumah A',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      scheduledTimeSlot: '09:00',
      status: 'Dijadwalkan',
      notes: null,
      productId: 'prod-1',
      productName: 'Zipblind',
      quantitySets: 8,
      technicians: [sampleTech],
      isCrossMonth: true,
    },
    {
      id: 'act-3',
      projectId: 'prj-scbd',
      projectCode: 'PRJ-ZB-26102',
      projectTitle: 'Proyek Fasad Executive Lounge SCBD',
      projectStatus: 'Selesai',
      projectStartDate: '2026-11-05',
      customerId: 'cust-2',
      customerName: 'PT Nusantara Capital',
      installationAddress: 'SCBD',
      activityCode: 'ACT-SCBD-1',
      activityType: 'Pemasangan',
      title: 'Pemasangan SCBD',
      startDate: '2026-11-12',
      endDate: '2026-11-12',
      scheduledTimeSlot: '13:00',
      status: 'Selesai',
      notes: null,
      productId: 'prod-2',
      productName: 'Roller Blind',
      quantitySets: 14,
      technicians: [sampleTech],
      isCrossMonth: false,
    },
  ];

  const execPayload = buildExecutiveDashboardPayload({
    requestedPeriod: '2026-11',
    activities: sampleActivities,
    projects: sampleProjects,
    technicians: [sampleTech],
    products: [
      { id: 'prod-1', name: 'Zipblind' },
      { id: 'prod-2', name: 'Roller Blind' },
      { id: 'prod-3', name: 'Vertical Blind' },
      { id: 'prod-4', name: 'Venetian Blind' },
    ],
    photos: [
      {
        id: 'ph-1',
        projectId: 'prj-rumah-a',
        projectCode: 'PRJ-ZB-26101',
        projectTitle: 'Proyek Rumah A — Teras & Patio Kemang',
        activityId: 'act-1',
        activityType: 'Pengukuran',
        activityDate: '2026-11-10',
        documentationCategory: 'Pengukuran',
        caption: 'Dokumentasi pengukuran Rumah A',
        uploadedAt: '2026-11-10T10:00:00Z',
        imageUrl: '/images/ref_proj_thumb.png',
      },
    ],
  });

  // Verifikasi 13 konten wajib Dashboard Pimpinan
  assert.equal(execPayload.readOnly, true);
  assert.equal(execPayload.role, 'executive');
  // 1. Ringkasan periode laporan
  assert.equal(execPayload.periodSummary.periodMonth, '2026-11');
  assert.equal(execPayload.periodSummary.periodLabel, 'November 2026');
  assert.equal(execPayload.periodSummary.officialGeneratedDateLabel, '1 Desember 2026');
  // 2. Total proyek
  assert.equal(execPayload.totalProjects, 2);
  // 3. Proyek selesai
  assert.equal(execPayload.completedProjects, 1);
  // 4. Proyek berjalan
  assert.equal(execPayload.ongoingProjects, 1);
  // 5. Proyek tertunda
  assert.equal(execPayload.delayedProjects, 0);
  // 6. Grafik perkembangan pekerjaan
  assert.equal(execPayload.workTrendSeries.length, 6);
  const novPoint = execPayload.workTrendSeries.find((pt) => pt.periodMonth === '2026-11');
  assert.ok(novPoint);
  assert.equal(novPoint.totalSets, 22);
  // 7. Rekap jenis aktivitas
  assert.ok(execPayload.activityTypeRecap.length >= 5);
  // 8. Rekap produk
  assert.equal(execPayload.productRecap.length, 4);
  // 9. Produktivitas teknisi
  assert.equal(execPayload.technicianProductivity.length, 1);
  assert.equal(execPayload.technicianProductivity[0].fullName, 'Budi Santoso');
  assert.equal(execPayload.technicianProductivity[0].completionScorePercent, 100);
  // 10. Riwayat proyek
  assert.equal(execPayload.projectHistory.length, 2);
  // 11. Dokumentasi proyek
  assert.equal(execPayload.projectDocumentation.length, 1);
  // 12. Arsip laporan bulanan
  assert.equal(execPayload.monthlyReportArchives.length, 3);
  // 13. Perbandingan bulan sebelumnya
  assert.equal(execPayload.previousMonthComparison.previousPeriodMonth, '2026-10');
  assert.equal(execPayload.previousMonthComparison.deltaTotalSets, 22);

  // Verifikasi keamanan: Tidak ada kredensial atau data internal Admin yang bocor
  const leakCheck = verifyNoAdminSecretsLeaked(execPayload);
  assert.equal(leakCheck.safe, true);
  assert.equal(leakCheck.leakedKeys.length, 0);

  const unsafePayloadCheck = verifyNoAdminSecretsLeaked({
    ...execPayload,
    internalDebug: { passwordHash: 'secret', tokenHash: 'hash123' },
  });
  assert.equal(unsafePayloadCheck.safe, false);
  assert.equal(unsafePayloadCheck.leakedKeys.length, 2);

  // Verifikasi penegakan Read-Only Pimpinan:
  // Aksi yang diizinkan: lihat dashboard, unduh PDF, unduh Excel
  assert.equal(
    enforceExecutiveReadOnlyGuard({
      httpMethod: 'GET',
      attemptedOperation: 'view_dashboard',
    }).allowed,
    true
  );
  assert.equal(
    enforceExecutiveReadOnlyGuard({
      httpMethod: 'GET',
      attemptedOperation: 'download_pdf',
      canDownloadReports: true,
    }).allowed,
    true
  );
  assert.equal(
    enforceExecutiveReadOnlyGuard({
      httpMethod: 'GET',
      attemptedOperation: 'download_excel',
      canDownloadReports: true,
    }).allowed,
    true
  );

  // Aksi terlarang pimpinan: tambah data, ubah data, hapus data, ubah jadwal, kelola teknisi, akses pengaturan admin
  for (const forbiddenOp of [
    'add_data',
    'update_data',
    'delete_data',
    'update_schedule',
    'manage_technicians',
    'access_admin_settings',
  ] as const) {
    const guard = enforceExecutiveReadOnlyGuard({
      httpMethod: 'POST',
      attemptedOperation: forbiddenOp,
    });
    assert.equal(guard.allowed, false);
    assert.equal(guard.status, 403);
    assert.equal(guard.code, 'FORBIDDEN_EXECUTIVE_READ_ONLY');
  }

  // Verifikasi 3 skenario token secret link pimpinan: Valid, Kedaluwarsa, Dicabut
  const generated = generateSecureSecretToken();
  const now = new Date('2026-11-15T10:00:00Z');

  // 1) Token Valid
  const validResult = validateSecretLinkRecord(
    {
      id: 'sl-valid',
      label: 'Token Pimpinan Valid',
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      canDownloadReports: true,
      expiresAt: new Date('2026-12-15T10:00:00Z'),
      isRevoked: false,
      revokedAt: null,
    },
    generated.rawToken,
    now
  );
  assert.equal(validResult.valid, true);
  assert.equal(validResult.status, 200);
  assert.equal(validResult.code, 'VALID');

  // 2) Token Kedaluwarsa
  const expiredResult = validateSecretLinkRecord(
    {
      id: 'sl-expired',
      label: 'Token Pimpinan Kedaluwarsa',
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      canDownloadReports: true,
      expiresAt: new Date('2026-11-01T10:00:00Z'),
      isRevoked: false,
      revokedAt: null,
    },
    generated.rawToken,
    now
  );
  assert.equal(expiredResult.valid, false);
  assert.equal(expiredResult.status, 403);
  assert.equal(expiredResult.code, 'TOKEN_EXPIRED');

  // 3) Token Dicabut
  const revokedResult = validateSecretLinkRecord(
    {
      id: 'sl-revoked',
      label: 'Token Pimpinan Dicabut',
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      canDownloadReports: true,
      expiresAt: new Date('2026-12-15T10:00:00Z'),
      isRevoked: true,
      revokedAt: new Date('2026-11-10T10:00:00Z'),
    },
    generated.rawToken,
    now
  );
  assert.equal(revokedResult.valid, false);
  assert.equal(revokedResult.status, 403);
  assert.equal(revokedResult.code, 'TOKEN_REVOKED');
});




