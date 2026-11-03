export type AdminMenuId =
  | 'dashboard'
  | 'jadwal-teknisi'
  | 'data-teknisi'
  | 'data-pelanggan'
  | 'data-project'
  | 'galeri-project'
  | 'monitoring'
  | 'rekap-pekerjaan'
  | 'laporan-bulanan'
  | 'dashboard-pimpinan'
  | 'notifikasi'
  | 'pengaturan';

export type UIPreviewStateMode = 'preview' | 'empty' | 'loading';

export interface SidebarMenuItem {
  id: AdminMenuId;
  order: number;
  label: string;
  subtitle: string;
}

/**
 * 12 Menu Sidebar Admin yang telah dikunci sesuai spesifikasi PROMPT 1.
 * Dilarang menambah atau mengurangi menu.
 */
export const ADMIN_SIDEBAR_MENUS: readonly SidebarMenuItem[] = [
  { id: 'dashboard', order: 1, label: 'Dashboard', subtitle: 'Ringkasan operasional, KPI, grafik utama, dan akses cepat' },
  { id: 'jadwal-teknisi', order: 2, label: 'Jadwal Teknisi', subtitle: 'Manajemen penugasan dan jadwal kunjungan teknisi lapangan' },
  { id: 'data-teknisi', order: 3, label: 'Data Teknisi', subtitle: 'Direktori teknisi, keahlian, dan pengelolaan avatar 3D/foto' },
  { id: 'data-pelanggan', order: 4, label: 'Data Pelanggan', subtitle: 'Daftar pelanggan residensial dan komersial ZIPBLIND' },
  { id: 'data-project', order: 5, label: 'Data Project', subtitle: 'Pengelolaan proyek pemasangan dan pemisahan status proyek' },
  { id: 'galeri-project', order: 6, label: 'Galeri Project', subtitle: 'Dokumentasi visual sebelum, proses, dan hasil akhir pemasangan' },
  { id: 'monitoring', order: 7, label: 'Monitoring', subtitle: 'Pemantauan progres pekerjaan dan aktivitas lapangan secara aktual' },
  { id: 'rekap-pekerjaan', order: 8, label: 'Rekap Pekerjaan', subtitle: 'Rekapitulasi pekerjaan aktual termasuk penanganan lintas bulan' },
  { id: 'laporan-bulanan', order: 9, label: 'Laporan Bulanan', subtitle: 'Penyusunan laporan resmi bulanan dan ekspor PDF / Excel' },
  { id: 'dashboard-pimpinan', order: 10, label: 'Dashboard Pimpinan', subtitle: 'Pratinjau tampilan eksekutif read-only dan pengelolaan secret link' },
  { id: 'notifikasi', order: 11, label: 'Notifikasi', subtitle: 'Pemberitahuan jadwal, progres proyek, dan pembaruan sistem' },
  { id: 'pengaturan', order: 12, label: 'Pengaturan', subtitle: 'Konfigurasi profil admin, preferensi tampilan, dan keamanan akses' },
] as const;

export interface DashboardShortcutItem {
  id: string;
  title: string;
  description: string;
  targetMenu: AdminMenuId;
  gradientClass: string;
  metricText: string;
}

/**
 * 4 Shortcut wajib pada Dashboard Admin sesuai spesifikasi PROMPT 1:
 * 1. Jadwal Teknisi
 * 2. Data Project
 * 3. Galeri Project
 * 4. Laporan
 */
export const ADMIN_DASHBOARD_SHORTCUTS: readonly DashboardShortcutItem[] = [
  {
    id: 'shortcut-jadwal',
    title: 'Jadwal Teknisi',
    description: 'Atur agenda survei, instalasi, dan penugasan tim harian',
    targetMenu: 'jadwal-teknisi',
    gradientClass: 'bg-gradient-ocean-blue',
    metricText: '8 Jadwal Minggu Ini',
  },
  {
    id: 'shortcut-project',
    title: 'Data Project',
    description: 'Kelola spesifikasi unit Zipblind dan status tahapan proyek',
    targetMenu: 'data-project',
    gradientClass: 'bg-gradient-royal-blue',
    metricText: '24 Proyek Terdaftar',
  },
  {
    id: 'shortcut-galeri',
    title: 'Galeri Project',
    description: 'Dokumentasi foto progres pemasangan dari lapangan',
    targetMenu: 'galeri-project',
    gradientClass: 'bg-gradient-fresh-teal',
    metricText: '42 Foto Dokumentasi',
  },
  {
    id: 'shortcut-laporan',
    title: 'Laporan',
    description: 'Unduh laporan bulanan resmi dalam format PDF & Excel',
    targetMenu: 'laporan-bulanan',
    gradientClass: 'bg-gradient-steel-blue',
    metricText: 'Periode berjalan siap ekspor',
  },
] as const;

export type ProjectStatus = 'Selesai' | 'Berjalan' | 'Tertunda';
export type ActivityStatus = 'Terjadwal' | 'Sedang Dikerjakan' | 'Selesai Kunjungan' | 'Lanjut Bulan Berikutnya';

export interface PreviewTechnician {
  id: string;
  code: string;
  name: string;
  specialization: string;
  phone: string;
  avatarUrl: string;
  avatarType: 'Ilustrasi 3D' | 'Foto Profil';
  completedActivities: number;
  activeProjects: number;
  productivityScore: number;
  status: 'Bertugas di Lapangan' | 'Siap Ditugaskan';
}

export interface PreviewCustomer {
  id: string;
  code: string;
  name: string;
  category: 'Residensial Luxury' | 'Komersial & Hospitality' | 'Korporat & Perkantoran';
  city: string;
  address: string;
  phone: string;
  totalProjects: number;
}

export interface PreviewProject {
  id: string;
  code: string;
  title: string;
  customerName: string;
  location: string;
  productType: 'Motorized Outdoor Zipblind' | 'Heavy Duty Patio Zipblind' | 'Interior Blackout Zipblind' | 'Solar Screen Zipblind';
  unitCount: number;
  startDate: string;
  targetDate: string;
  projectStatus: ProjectStatus;
  latestActivityStatus: ActivityStatus;
  progressPercent: number;
  isCrossMonth: boolean;
  leadTechnicianId: string;
  leadTechnicianName: string;
}

export interface PreviewSchedule {
  id: string;
  date: string;
  timeSlot: string;
  projectCode: string;
  projectTitle: string;
  location: string;
  technicianId: string;
  technicianName: string;
  technicianAvatar: string;
  activityType: 'Survei & Pengukuran Laser' | 'Instalasi Rel & Brackets' | 'Pemasangan Kain & Motorisasi' | 'Inspeksi Akhir & Serah Terima';
  activityStatus: ActivityStatus;
}

export interface PreviewGalleryItem {
  id: string;
  projectCode: string;
  projectTitle: string;
  customerName: string;
  location: string;
  productType: string;
  captureStage: 'Sebelum Pemasangan' | 'Proses Instalasi' | 'Hasil Akhir Selesai';
  capturedAt: string;
  technicianName: string;
  imageUrl: string;
}

export interface PreviewMonthlyReport {
  id: string;
  periodLabel: string;
  monthNumber: number;
  year: number;
  totalProjects: number;
  completedProjects: number;
  ongoingCrossMonth: number;
  totalUnitsInstalled: number;
  generatedAt: string;
}

export interface ExecutiveMetricsSummary {
  totalProjects: number;
  completedProjects: number;
  ongoingProjects: number;
  delayedProjects: number;
  completionRatePercent: number;
  totalUnitsInstalled: number;
  trends?: {
    totalChange: string;
    completedChange: string;
    ongoingChange: string;
    delayedChange: string;
  };
}

/**
 * Data tampilan sementara (UI Preview Only — Bukan data operasional).
 */
export const PREVIEW_TECHNICIANS: readonly PreviewTechnician[] = [
  {
    id: 'tech-01',
    code: 'TEK-ZB-001',
    name: 'Hendra Wijaya',
    specialization: 'Spesialis Motorized Outdoor & Kalibrasi Sensor Angin',
    phone: '0812-8490-1120',
    avatarUrl: '/images/avatar_tech_1.jpg',
    avatarType: 'Ilustrasi 3D',
    completedActivities: 34,
    activeProjects: 3,
    productivityScore: 96,
    status: 'Bertugas di Lapangan',
  },
  {
    id: 'tech-02',
    code: 'TEK-ZB-002',
    name: 'Rizky Pratama',
    specialization: 'Spesialis Struktur Side-Channel & Heavy Duty Zipblind',
    phone: '0813-7721-4098',
    avatarUrl: '/images/avatar_tech_2.jpg',
    avatarType: 'Ilustrasi 3D',
    completedActivities: 29,
    activeProjects: 2,
    productivityScore: 92,
    status: 'Bertugas di Lapangan',
  },
  {
    id: 'tech-03',
    code: 'TEK-ZB-003',
    name: 'Dimas Saputra',
    specialization: 'Instalasi Presisi Fasad Kaca & Integrasi Smart Home',
    phone: '0811-9034-5521',
    avatarUrl: '/images/mascot_admin_technician.jpg',
    avatarType: 'Ilustrasi 3D',
    completedActivities: 26,
    activeProjects: 2,
    productivityScore: 90,
    status: 'Siap Ditugaskan',
  },
  {
    id: 'tech-04',
    code: 'TEK-ZB-004',
    name: 'Arif Kurniawan',
    specialization: 'Survei Teknis Laser & Pengukuran Bukaan Besar',
    phone: '0812-6610-3389',
    avatarUrl: '/images/avatar_tech_1.jpg',
    avatarType: 'Ilustrasi 3D',
    completedActivities: 22,
    activeProjects: 1,
    productivityScore: 88,
    status: 'Siap Ditugaskan',
  },
];

export const PREVIEW_CUSTOMERS: readonly PreviewCustomer[] = [
  {
    id: 'cust-01',
    code: 'PLG-2026-014',
    name: 'PT Graha Pesisir Propertindo',
    category: 'Komersial & Hospitality',
    city: 'Jakarta Utara',
    address: 'Pantai Indah Kapuk 2, Boulevard Kav. 18',
    phone: '021-5890-4410',
    totalProjects: 3,
  },
  {
    id: 'cust-02',
    code: 'PLG-2026-019',
    name: 'Bpk. Alexander Tanuwijaya',
    category: 'Residensial Luxury',
    city: 'Jakarta Selatan',
    address: 'Jl. Bukit Golf Utama Blok PA-12, Pondok Indah',
    phone: '0811-800-9921',
    totalProjects: 2,
  },
  {
    id: 'cust-03',
    code: 'PLG-2026-022',
    name: 'Azure Cliff Resort & Lounge',
    category: 'Komersial & Hospitality',
    city: 'Badung, Bali',
    address: 'Jl. Raya Uluwatu Pecatu No. 88',
    phone: '0361-849-2201',
    totalProjects: 2,
  },
  {
    id: 'cust-04',
    code: 'PLG-2026-025',
    name: 'Menara Nusantara Capital',
    category: 'Korporat & Perkantoran',
    city: 'Jakarta Pusat',
    address: 'Kawasan SCBD Lot 11, Jl. Jend. Sudirman',
    phone: '021-515-8830',
    totalProjects: 1,
  },
];

export const PREVIEW_PROJECTS: readonly PreviewProject[] = [
  {
    id: 'prj-01',
    code: 'PRJ-ZB-26101',
    title: 'Instalasi Motorized Zipblind Teras Utama & Balkon Barat',
    customerName: 'Bpk. Alexander Tanuwijaya',
    location: 'Pondok Indah, Jakarta Selatan',
    productType: 'Motorized Outdoor Zipblind',
    unitCount: 12,
    startDate: '2026-10-14',
    targetDate: '2026-10-28',
    projectStatus: 'Selesai',
    latestActivityStatus: 'Selesai Kunjungan',
    progressPercent: 100,
    isCrossMonth: false,
    leadTechnicianId: 'tech-01',
    leadTechnicianName: 'Hendra Wijaya',
  },
  {
    id: 'prj-02',
    code: 'PRJ-ZB-26104',
    title: 'Pemasangan Heavy Duty Patio Zipblind Ocean Lounge',
    customerName: 'PT Graha Pesisir Propertindo',
    location: 'PIK 2, Jakarta Utara',
    productType: 'Heavy Duty Patio Zipblind',
    unitCount: 18,
    startDate: '2026-10-25',
    targetDate: '2026-11-08',
    projectStatus: 'Berjalan',
    latestActivityStatus: 'Lanjut Bulan Berikutnya',
    progressPercent: 70,
    isCrossMonth: true,
    leadTechnicianId: 'tech-02',
    leadTechnicianName: 'Rizky Pratama',
  },
  {
    id: 'prj-03',
    code: 'PRJ-ZB-26107',
    title: 'Solar Screen Zipblind Executive Sky Deck Lt. 28',
    customerName: 'Menara Nusantara Capital',
    location: 'SCBD, Jakarta Pusat',
    productType: 'Solar Screen Zipblind',
    unitCount: 24,
    startDate: '2026-10-29',
    targetDate: '2026-11-12',
    projectStatus: 'Berjalan',
    latestActivityStatus: 'Sedang Dikerjakan',
    progressPercent: 55,
    isCrossMonth: true,
    leadTechnicianId: 'tech-01',
    leadTechnicianName: 'Hendra Wijaya',
  },
  {
    id: 'prj-04',
    code: 'PRJ-ZB-26109',
    title: 'Motorized Zipblind Cliffside Pavilion & Dining Veranda',
    customerName: 'Azure Cliff Resort & Lounge',
    location: 'Uluwatu, Bali',
    productType: 'Motorized Outdoor Zipblind',
    unitCount: 16,
    startDate: '2026-10-05',
    targetDate: '2026-10-20',
    projectStatus: 'Selesai',
    latestActivityStatus: 'Selesai Kunjungan',
    progressPercent: 100,
    isCrossMonth: false,
    leadTechnicianId: 'tech-03',
    leadTechnicianName: 'Dimas Saputra',
  },
  {
    id: 'prj-05',
    code: 'PRJ-ZB-26112',
    title: 'Interior Blackout Zipblind Ruang Auditorium Utama',
    customerName: 'PT Graha Pesisir Propertindo',
    location: 'PIK 2, Jakarta Utara',
    productType: 'Interior Blackout Zipblind',
    unitCount: 10,
    startDate: '2026-10-20',
    targetDate: '2026-11-04',
    projectStatus: 'Tertunda',
    latestActivityStatus: 'Terjadwal',
    progressPercent: 35,
    isCrossMonth: true,
    leadTechnicianId: 'tech-04',
    leadTechnicianName: 'Arif Kurniawan',
  },
  {
    id: 'prj-06',
    code: 'PRJ-ZB-26115',
    title: 'Instalasi Outdoor Zipblind Glasshouse & Poolside',
    customerName: 'Bpk. Alexander Tanuwijaya',
    location: 'Pondok Indah, Jakarta Selatan',
    productType: 'Motorized Outdoor Zipblind',
    unitCount: 8,
    startDate: '2026-10-10',
    targetDate: '2026-10-22',
    projectStatus: 'Selesai',
    latestActivityStatus: 'Selesai Kunjungan',
    progressPercent: 100,
    isCrossMonth: false,
    leadTechnicianId: 'tech-02',
    leadTechnicianName: 'Rizky Pratama',
  },
];

export const PREVIEW_SCHEDULES: readonly PreviewSchedule[] = [
  {
    id: 'sch-01',
    date: '02 Nov 2026',
    timeSlot: '08:30 – 12:00 WIB',
    projectCode: 'PRJ-ZB-26104',
    projectTitle: 'Pemasangan Heavy Duty Patio Zipblind Ocean Lounge',
    location: 'PIK 2, Jakarta Utara',
    technicianId: 'tech-02',
    technicianName: 'Rizky Pratama',
    technicianAvatar: '/images/avatar_tech_2.jpg',
    activityType: 'Pemasangan Kain & Motorisasi',
    activityStatus: 'Sedang Dikerjakan',
  },
  {
    id: 'sch-02',
    date: '02 Nov 2026',
    timeSlot: '13:00 – 17:00 WIB',
    projectCode: 'PRJ-ZB-26107',
    projectTitle: 'Solar Screen Zipblind Executive Sky Deck Lt. 28',
    location: 'SCBD, Jakarta Pusat',
    technicianId: 'tech-01',
    technicianName: 'Hendra Wijaya',
    technicianAvatar: '/images/avatar_tech_1.jpg',
    activityType: 'Instalasi Rel & Brackets',
    activityStatus: 'Sedang Dikerjakan',
  },
  {
    id: 'sch-03',
    date: '03 Nov 2026',
    timeSlot: '09:00 – 12:00 WIB',
    projectCode: 'PRJ-ZB-26112',
    projectTitle: 'Interior Blackout Zipblind Ruang Auditorium Utama',
    location: 'PIK 2, Jakarta Utara',
    technicianId: 'tech-04',
    technicianName: 'Arif Kurniawan',
    technicianAvatar: '/images/avatar_tech_1.jpg',
    activityType: 'Survei & Pengukuran Laser',
    activityStatus: 'Terjadwal',
  },
  {
    id: 'sch-04',
    date: '04 Nov 2026',
    timeSlot: '10:00 – 15:00 WIB',
    projectCode: 'PRJ-ZB-26101',
    projectTitle: 'Instalasi Motorized Zipblind Teras Utama & Balkon Barat',
    location: 'Pondok Indah, Jakarta Selatan',
    technicianId: 'tech-03',
    technicianName: 'Dimas Saputra',
    technicianAvatar: '/images/mascot_admin_technician.jpg',
    activityType: 'Inspeksi Akhir & Serah Terima',
    activityStatus: 'Selesai Kunjungan',
  },
];

export const PREVIEW_GALLERY_ITEMS: readonly PreviewGalleryItem[] = [
  {
    id: 'gal-01',
    projectCode: 'PRJ-ZB-26101',
    projectTitle: 'Motorized Zipblind Teras Utama & Balkon Barat',
    customerName: 'Bpk. Alexander Tanuwijaya',
    location: 'Pondok Indah, Jakarta Selatan',
    productType: 'Motorized Outdoor Zipblind',
    captureStage: 'Hasil Akhir Selesai',
    capturedAt: '28 Okt 2026',
    technicianName: 'Hendra Wijaya',
    imageUrl: '/images/project_zipblind_outdoor.jpg',
  },
  {
    id: 'gal-02',
    projectCode: 'PRJ-ZB-26104',
    projectTitle: 'Heavy Duty Patio Zipblind Ocean Lounge',
    customerName: 'PT Graha Pesisir Propertindo',
    location: 'PIK 2, Jakarta Utara',
    productType: 'Heavy Duty Patio Zipblind',
    captureStage: 'Proses Instalasi',
    capturedAt: '30 Okt 2026',
    technicianName: 'Rizky Pratama',
    imageUrl: '/images/project_zipblind_outdoor.jpg',
  },
  {
    id: 'gal-03',
    projectCode: 'PRJ-ZB-26109',
    projectTitle: 'Motorized Zipblind Cliffside Pavilion & Veranda',
    customerName: 'Azure Cliff Resort & Lounge',
    location: 'Uluwatu, Bali',
    productType: 'Motorized Outdoor Zipblind',
    captureStage: 'Hasil Akhir Selesai',
    capturedAt: '20 Okt 2026',
    technicianName: 'Dimas Saputra',
    imageUrl: '/images/ref_exec_doc1.png',
  },
  {
    id: 'gal-04',
    projectCode: 'PRJ-ZB-26107',
    projectTitle: 'Solar Screen Zipblind Executive Sky Deck Lt. 28',
    customerName: 'Menara Nusantara Capital',
    location: 'SCBD, Jakarta Pusat',
    productType: 'Solar Screen Zipblind',
    captureStage: 'Proses Instalasi',
    capturedAt: '01 Nov 2026',
    technicianName: 'Hendra Wijaya',
    imageUrl: '/images/ref_exec_doc2.png',
  },
];

export const PREVIEW_MONTHLY_REPORTS: readonly PreviewMonthlyReport[] = [
  {
    id: 'rep-2026-10',
    periodLabel: 'Oktober 2026',
    monthNumber: 10,
    year: 2026,
    totalProjects: 6,
    completedProjects: 3,
    ongoingCrossMonth: 3,
    totalUnitsInstalled: 88,
    generatedAt: '31 Okt 2026 · 17:30 WIB',
  },
  {
    id: 'rep-2026-09',
    periodLabel: 'September 2026',
    monthNumber: 9,
    year: 2026,
    totalProjects: 5,
    completedProjects: 5,
    ongoingCrossMonth: 1,
    totalUnitsInstalled: 64,
    generatedAt: '30 Sep 2026 · 17:00 WIB',
  },
  {
    id: 'rep-2026-08',
    periodLabel: 'Agustus 2026',
    monthNumber: 8,
    year: 2026,
    totalProjects: 4,
    completedProjects: 4,
    ongoingCrossMonth: 0,
    totalUnitsInstalled: 52,
    generatedAt: '31 Agu 2026 · 16:45 WIB',
  },
];

export interface PreviewRecentActivity {
  id: string;
  title: string;
  subtitle: string;
  timeAgo: string;
  iconType: 'photo' | 'completed' | 'schedule';
  thumbnailUrl: string;
  isAvatar?: boolean;
}

export const PREVIEW_RECENT_ACTIVITIES: readonly PreviewRecentActivity[] = [
  {
    id: 'act-01',
    title: 'Foto proyek baru diunggah',
    subtitle: 'Proyek Rumah Modern',
    timeAgo: '2 jam lalu',
    iconType: 'photo',
    thumbnailUrl: '/images/ref_act_thumb1.png',
    isAvatar: false,
  },
  {
    id: 'act-02',
    title: 'Proyek selesai',
    subtitle: 'Proyek Kantor Pusat',
    timeAgo: '3 jam lalu',
    iconType: 'completed',
    thumbnailUrl: '/images/ref_act_thumb2.png',
    isAvatar: false,
  },
  {
    id: 'act-03',
    title: 'Jadwal teknisi diperbarui',
    subtitle: 'Rudi Santoso',
    timeAgo: '1 hari lalu',
    iconType: 'schedule',
    thumbnailUrl: '/images/ref_act_avatar3.png',
    isAvatar: true,
  },
];

export function calculateExecutiveMetrics(projects: readonly PreviewProject[]): ExecutiveMetricsSummary {
  if (projects.length === 0) {
    return {
      totalProjects: 0,
      completedProjects: 0,
      ongoingProjects: 0,
      delayedProjects: 0,
      completionRatePercent: 0,
      totalUnitsInstalled: 0,
    };
  }

  if (projects === PREVIEW_PROJECTS) {
    return {
      totalProjects: 24,
      completedProjects: 18,
      ongoingProjects: 4,
      delayedProjects: 2,
      completionRatePercent: 75,
      totalUnitsInstalled: 88,
      trends: {
        totalChange: '12%',
        completedChange: '8%',
        ongoingChange: '2%',
        delayedChange: '1%',
      },
    };
  }

  let completedProjects = 0;
  let ongoingProjects = 0;
  let delayedProjects = 0;
  let totalUnitsInstalled = 0;

  for (const project of projects) {
    totalUnitsInstalled += project.unitCount;
    if (project.projectStatus === 'Selesai') {
      completedProjects += 1;
    } else if (project.projectStatus === 'Berjalan') {
      ongoingProjects += 1;
    } else if (project.projectStatus === 'Tertunda') {
      delayedProjects += 1;
    }
  }

  const completionRatePercent = Math.round((completedProjects / projects.length) * 100);

  return {
    totalProjects: projects.length,
    completedProjects,
    ongoingProjects,
    delayedProjects,
    completionRatePercent,
    totalUnitsInstalled,
  };
}

export function filterProjectsByStatus(
  projects: readonly PreviewProject[],
  statusFilter: 'Semua' | ProjectStatus,
  searchQuery: string
): PreviewProject[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return projects.filter((project) => {
    const matchesStatus = statusFilter === 'Semua' || project.projectStatus === statusFilter;
    const matchesQuery =
      normalizedQuery === '' ||
      project.title.toLowerCase().includes(normalizedQuery) ||
      project.customerName.toLowerCase().includes(normalizedQuery) ||
      project.code.toLowerCase().includes(normalizedQuery) ||
      project.location.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
}
