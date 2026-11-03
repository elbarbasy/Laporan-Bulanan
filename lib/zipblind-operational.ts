/**
 * Modul Logika Bisnis Operasional ZIPBLIND (Tahap 4 — PROMPT 4)
 * Mencakup aturan bisnis murni untuk:
 * 1. Jadwal Teknisi (Kalender Harian, Mingguan, Bulanan & 1 Kolom Teknisi Gabungan)
 * 2. Data Teknisi (Avatar masing-masing teknisi & status aktif/nonaktif)
 * 3. Data Pelanggan (Riwayat proyek per pelanggan)
 * 4. Data Project (Multi-aktivitas lintas tanggal & lintas bulan pada 1 proyek yang sama)
 */

export type DbActivityType =
  | 'Pemasangan'
  | 'Pengukuran'
  | 'Survey'
  | 'Perbaikan'
  | 'Service'
  | 'Pengiriman'
  | 'Pengambilan'
  | 'Lainnya';

export type OperationalActivityType =
  | 'Pengukuran'
  | 'Persiapan'
  | 'Pemasangan'
  | 'Survey'
  | 'Perbaikan'
  | 'Service'
  | 'Pengiriman'
  | 'Pengambilan'
  | 'Lainnya';

export type OperationalStatus =
  | 'Dijadwalkan'
  | 'Sedang Berjalan'
  | 'Selesai'
  | 'Tertunda'
  | 'Dibatalkan';

export type CalendarViewMode = 'harian' | 'mingguan' | 'bulanan';

export const OPERATIONAL_ACTIVITY_TYPES: OperationalActivityType[] = [
  'Pengukuran',
  'Persiapan',
  'Pemasangan',
  'Survey',
  'Perbaikan',
  'Service',
  'Pengiriman',
  'Pengambilan',
  'Lainnya',
];

export const OPERATIONAL_STATUS_LIST: OperationalStatus[] = [
  'Dijadwalkan',
  'Sedang Berjalan',
  'Selesai',
  'Tertunda',
  'Dibatalkan',
];

export const TECHNICIAN_AVATAR_PRESETS: Array<{ label: string; url: string }> = [
  { label: 'Avatar Teknisi 3D #1 (Budi)', url: '/images/ref_exec_tech1.png' },
  { label: 'Avatar Teknisi 3D #2 (Andi)', url: '/images/ref_exec_tech2.png' },
  { label: 'Avatar Teknisi 3D #3 (Dedi)', url: '/images/ref_exec_tech3.png' },
  { label: 'Avatar Teknisi 3D #4 (Hendra)', url: '/images/ref_act_avatar3.png' },
  { label: 'Avatar Teknisi Lapangan #5', url: '/images/avatar_tech_1.jpg' },
  { label: 'Avatar Teknisi Lapangan #6', url: '/images/avatar_tech_2.jpg' },
];

export interface AssignedTechnicianSummary {
  id: string;
  technicianCode: string;
  fullName: string;
  avatarUrl: string;
  specialization: string | null;
  isActive: boolean;
}

export interface OperationalActivityRecord {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  projectStatus: OperationalStatus;
  projectStartDate: string | null;
  customerId: string;
  customerName: string;
  installationAddress: string;
  activityCode: string;
  activityType: OperationalActivityType;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  scheduledTimeSlot: string;
  status: OperationalStatus;
  notes: string | null;
  productId: string | null;
  productName: string;
  quantitySets: number;
  technicians: AssignedTechnicianSummary[];
  isCrossMonth: boolean;
}

/**
 * Memetakan jenis aktivitas UI (termasuk 'Persiapan') ke tipe ENUM database PostgreSQL
 * tanpa mengubah struktur skema PROMPT 2.
 */
export function mapToDbActivityType(uiType: OperationalActivityType): DbActivityType {
  if (uiType === 'Persiapan') {
    return 'Lainnya';
  }
  return uiType;
}

/**
 * Menyematkan penanda tahap 'Persiapan' secara transparan pada judul aktivitas
 * apabila jenis aktivitas adalah 'Persiapan'.
 */
export function encodeActivityTitleWithType(
  uiType: OperationalActivityType,
  rawTitle: string
): string {
  const cleanTitle = rawTitle.replace(/^\[Persiapan\]\s*/i, '').trim();
  if (uiType === 'Persiapan') {
    return `[Persiapan] ${cleanTitle || 'Persiapan Material & Komponen'}`;
  }
  return cleanTitle;
}

/**
 * Mengekstrak jenis aktivitas tampilan dan judul bersih dari baris database.
 */
export function decodeActivityTypeAndTitle(
  dbType: DbActivityType,
  storedTitle: string
): { activityType: OperationalActivityType; cleanTitle: string } {
  if (dbType === 'Lainnya' && /^\[Persiapan\]/i.test(storedTitle.trim())) {
    return {
      activityType: 'Persiapan',
      cleanTitle: storedTitle.replace(/^\[Persiapan\]\s*/i, '').trim(),
    };
  }
  return {
    activityType: dbType,
    cleanTitle: storedTitle,
  };
}

/**
 * ATURAN BISNIS:
 * Jika beberapa teknisi ditugaskan, tampilkan seluruh nama teknisi dalam satu kolom.
 * Jangan menampilkan kolom jenis penugasan (Mandiri / Tim).
 */
export function formatAssignedTechniciansColumn(
  technicians: Array<{ fullName: string }>
): string {
  if (!technicians || technicians.length === 0) {
    return 'Belum Ditugaskan';
  }
  return technicians
    .map((t) => t.fullName.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * ATURAN BISNIS:
 * Mendeteksi apakah suatu aktivitas lintas bulan terhadap tanggal mulai proyek
 * atau antar rentang tanggal pelaksanaan aktivitas itu sendiri.
 */
export function isCrossMonthActivity(
  projectStartDate: string | null | undefined,
  activityStartDate: string,
  activityEndDate?: string | null
): boolean {
  const actStartMonth = activityStartDate ? activityStartDate.slice(0, 7) : '';
  const actEndMonth = activityEndDate ? activityEndDate.slice(0, 7) : actStartMonth;

  if (actStartMonth && actEndMonth && actStartMonth !== actEndMonth) {
    return true;
  }

  if (projectStartDate) {
    const projMonth = projectStartDate.slice(0, 7);
    if (projMonth && actStartMonth && projMonth !== actStartMonth) {
      return true;
    }
  }

  return false;
}

/**
 * ATURAN BISNIS:
 * - Pisahkan status proyek dan status aktivitas.
 * - Aktivitas yang belum selesai (status !== 'Selesai') tidak boleh dianggap selesai.
 * - Proyek tidak boleh ditandai 'Selesai' apabila masih ada aktivitas yang belum 'Selesai'
 *   (kecuali aktivitas tersebut 'Dibatalkan' dan minimal ada 1 aktivitas 'Selesai').
 */
export function validateProjectStatusTransition(
  targetProjectStatus: OperationalStatus,
  activities: Array<{ status: OperationalStatus; title?: string; activityType?: string }>
): {
  allowed: boolean;
  reason?: string;
  totalActivities: number;
  completedActivities: number;
  incompleteActivities: number;
} {
  const activeActivities = activities.filter((a) => a.status !== 'Dibatalkan');
  const completedActivities = activeActivities.filter((a) => a.status === 'Selesai').length;
  const incompleteActivities = activeActivities.filter((a) => a.status !== 'Selesai').length;

  if (targetProjectStatus === 'Selesai') {
    if (activeActivities.length === 0) {
      return {
        allowed: false,
        reason:
          'Proyek belum memiliki aktivitas pekerjaan yang selesai. Tambahkan dan selesaikan aktivitas terlebih dahulu.',
        totalActivities: 0,
        completedActivities: 0,
        incompleteActivities: 0,
      };
    }

    if (incompleteActivities > 0) {
      return {
        allowed: false,
        reason: `Terdapat ${incompleteActivities} aktivitas pada proyek ini yang belum selesai. Aktivitas yang belum selesai tidak boleh dianggap selesai.`,
        totalActivities: activeActivities.length,
        completedActivities,
        incompleteActivities,
      };
    }
  }

  return {
    allowed: true,
    totalActivities: activeActivities.length,
    completedActivities,
    incompleteActivities,
  };
}

/**
 * ATURAN BISNIS:
 * - Aktivitas lintas bulan tetap terhubung ke proyek awal (projectId).
 * - Jangan menghitung proyek lama sebagai proyek baru pada bulan berikutnya.
 * - Rekap pekerjaan dihitung berdasarkan tanggal pelaksanaan (startDate) dan status.
 */
export function summarizeActivitiesByPeriodAndStatus(
  activities: Array<{
    id: string;
    projectId: string;
    projectStartDate: string | null;
    startDate: string;
    status: OperationalStatus;
    quantitySets: number;
  }>,
  periodMonthPrefix?: string // Format YYYY-MM, contoh: '2026-11' atau '2026-12'
): {
  filteredActivitiesCount: number;
  completedActivitiesCount: number;
  ongoingActivitiesCount: number;
  scheduledActivitiesCount: number;
  delayedActivitiesCount: number;
  completedSetsCount: number;
  totalPlannedSetsCount: number;
  distinctProjectsInPeriod: number;
  newProjectsStartedInPeriod: number;
  continuingCrossMonthProjectsInPeriod: number;
} {
  const matching = periodMonthPrefix
    ? activities.filter((a) => a.startDate.startsWith(periodMonthPrefix))
    : activities;

  const distinctProjectIds = new Set<string>();
  const newProjectIds = new Set<string>();
  const continuingCrossMonthProjectIds = new Set<string>();

  let completedActivitiesCount = 0;
  let ongoingActivitiesCount = 0;
  let scheduledActivitiesCount = 0;
  let delayedActivitiesCount = 0;
  let completedSetsCount = 0;
  let totalPlannedSetsCount = 0;

  for (const act of matching) {
    distinctProjectIds.add(act.projectId);
    totalPlannedSetsCount += Number(act.quantitySets || 0);

    // Hanya aktivitas dengan status === 'Selesai' yang dihitung sebagai selesai
    if (act.status === 'Selesai') {
      completedActivitiesCount += 1;
      completedSetsCount += Number(act.quantitySets || 0);
    } else if (act.status === 'Sedang Berjalan') {
      ongoingActivitiesCount += 1;
    } else if (act.status === 'Dijadwalkan') {
      scheduledActivitiesCount += 1;
    } else if (act.status === 'Tertunda') {
      delayedActivitiesCount += 1;
    }

    if (periodMonthPrefix) {
      const projStartMonth = (act.projectStartDate || act.startDate).slice(0, 7);
      if (projStartMonth === periodMonthPrefix) {
        newProjectIds.add(act.projectId);
      } else {
        // Proyek dimulai pada bulan sebelumnya dan berlanjut ke bulan ini:
        // TIDAK boleh dihitung sebagai proyek baru!
        continuingCrossMonthProjectIds.add(act.projectId);
      }
    } else {
      newProjectIds.add(act.projectId);
    }
  }

  return {
    filteredActivitiesCount: matching.length,
    completedActivitiesCount,
    ongoingActivitiesCount,
    scheduledActivitiesCount,
    delayedActivitiesCount,
    completedSetsCount,
    totalPlannedSetsCount,
    distinctProjectsInPeriod: distinctProjectIds.size,
    newProjectsStartedInPeriod: newProjectIds.size,
    continuingCrossMonthProjectsInPeriod: continuingCrossMonthProjectIds.size,
  };
}

/**
 * Memfilter daftar jadwal teknisi berdasarkan mode kalender:
 * - 'harian': Tanggal aktivitas mencakup anchorDate (startDate <= anchorDate <= endDate)
 * - 'mingguan': Tanggal aktivitas berada dalam rentang 7 hari dari minggu anchorDate (Senin–Minggu)
 * - 'bulanan': Tanggal aktivitas berada pada bulan YYYY-MM yang sama dengan anchorDate
 */
export function filterSchedulesByCalendarMode<
  T extends { startDate: string; endDate?: string; status?: OperationalStatus }
>(
  schedules: T[],
  mode: CalendarViewMode,
  anchorDate: string, // YYYY-MM-DD
  statusFilter: 'Semua' | OperationalStatus = 'Semua'
): T[] {
  const statusMatched =
    statusFilter === 'Semua'
      ? schedules
      : schedules.filter((s) => s.status === statusFilter);

  if (!anchorDate || anchorDate.length < 7) {
    return statusMatched;
  }

  if (mode === 'harian') {
    return statusMatched.filter((s) => {
      const start = s.startDate;
      const end = s.endDate || s.startDate;
      return start <= anchorDate && end >= anchorDate;
    });
  }

  if (mode === 'bulanan') {
    const monthPrefix = anchorDate.slice(0, 7);
    return statusMatched.filter((s) => {
      const startMonth = s.startDate.slice(0, 7);
      const endMonth = (s.endDate || s.startDate).slice(0, 7);
      return startMonth === monthPrefix || endMonth === monthPrefix;
    });
  }

  // Mode 'mingguan': Hitung hari Senin s/d Minggu pada minggu anchorDate
  const parsed = new Date(`${anchorDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return statusMatched;
  }
  const dayOfWeek = parsed.getUTCDay(); // 0 = Minggu, 1 = Senin, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(parsed);
  monday.setUTCDate(parsed.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  return statusMatched.filter((s) => {
    const start = s.startDate;
    const end = s.endDate || s.startDate;
    return start <= sundayStr && end >= mondayStr;
  });
}
