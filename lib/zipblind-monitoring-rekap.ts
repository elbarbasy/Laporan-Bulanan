/**
 * Modul Logika Perhitungan Monitoring & Rekap Pekerjaan ZIPBLIND (Tahap 6 — PROMPT 6)
 *
 * Mencakup aturan perhitungan resmi:
 * 1. Hitung pekerjaan berdasarkan aktivitas yang tercatat.
 * 2. Jangan menganggap seluruh proyek selesai jika masih ada aktivitas yang belum selesai.
 * 3. Aktivitas yang belum selesai tetap ditampilkan sebagai pekerjaan tertunda atau berjalan sesuai statusnya.
 * 4. Aktivitas lintas bulan harus dihitung pada periode pelaksanaan yang sesuai.
 * 5. Aktivitas lanjutan tidak boleh dihitung sebagai proyek baru.
 * 6. Jumlah set harus mengikuti detail pekerjaan, bukan jumlah proyek.
 */

import {
  OPERATIONAL_ACTIVITY_TYPES,
  type OperationalActivityRecord,
  type OperationalActivityType,
  type OperationalStatus,
} from './zipblind-operational';

/**
 * 5 Kondisi Pekerjaan Resmi pada Halaman Monitoring (PROMPT 6):
 * - Belum dimulai (mencakup status DB 'Belum Dimulai' dan 'Dijadwalkan')
 * - Sedang berjalan (mencakup status DB 'Sedang Berjalan')
 * - Selesai (mencakup status DB 'Selesai')
 * - Tertunda (mencakup status DB 'Tertunda')
 * - Dibatalkan (mencakup status DB 'Dibatalkan')
 */
export type MonitoringWorkCondition =
  | 'Belum dimulai'
  | 'Sedang berjalan'
  | 'Selesai'
  | 'Tertunda'
  | 'Dibatalkan';

export const MONITORING_WORK_CONDITIONS: MonitoringWorkCondition[] = [
  'Belum dimulai',
  'Sedang berjalan',
  'Selesai',
  'Tertunda',
  'Dibatalkan',
];

export interface MonitoringFilterCriteria {
  /** Filter periode bulan format YYYY-MM (contoh: '2026-11', '2026-12', atau 'Semua') */
  periodMonth?: string;
  /** Filter rentang tanggal mulai (YYYY-MM-DD) */
  dateFrom?: string;
  /** Filter rentang tanggal akhir (YYYY-MM-DD) */
  dateTo?: string;
  /** Filter ID proyek atau 'Semua' */
  projectId?: string;
  /** Filter ID pelanggan atau 'Semua' */
  customerId?: string;
  /** Filter ID teknisi atau 'Semua' */
  technicianId?: string;
  /** Filter jenis aktivitas atau 'Semua' */
  activityType?: string;
  /** Filter nama produk atau 'Semua' */
  productName?: string;
  /** Filter kondisi/status pekerjaan ('Semua' atau salah satu dari MonitoringWorkCondition / OperationalStatus) */
  status?: string;
  /** Kata kunci pencarian opsional */
  searchQuery?: string;
}

export interface MonitoringProjectSummary {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  customerId: string;
  customerName: string;
  installationAddress: string;
  storedProjectStatus: OperationalStatus | 'Belum Dimulai';
  /**
   * Status efektif proyek sesuai Aturan 2:
   * Proyek TIDAK BOLEH dianggap 'Selesai' apabila masih ada aktivitas yang belum 'Selesai'.
   */
  effectiveProjectCondition: MonitoringWorkCondition;
  isFullyCompleted: boolean;
  hasCrossMonthActivities: boolean;
  projectStartDate: string | null;
  totalRecordedActivities: number;
  completedActivitiesCount: number;
  ongoingActivitiesCount: number;
  pendingActivitiesCount: number;
  notStartedActivitiesCount: number;
  cancelledActivitiesCount: number;
  totalWorkDetailSets: number;
  activities: Array<
    OperationalActivityRecord & {
      monitoringCondition: MonitoringWorkCondition;
      isFollowUpActivity: boolean;
    }
  >;
}

export interface ActivityTypeRecapItem {
  activityType: OperationalActivityType;
  totalActivities: number;
  completedActivities: number;
  ongoingActivities: number;
  pendingActivities: number;
  notStartedActivities: number;
  cancelledActivities: number;
  totalSets: number;
}

export interface ProductRecapItem {
  productName: string;
  totalActivities: number;
  completedActivities: number;
  ongoingActivities: number;
  pendingActivities: number;
  distinctProjectsCount: number;
  totalSets: number;
  completedSets: number;
}

export interface TechnicianProductivityRecapItem {
  technicianId: string;
  technicianCode: string;
  fullName: string;
  specialization: string;
  avatarUrl: string;
  isActive: boolean;
  totalAssignedActivities: number;
  completedActivities: number;
  ongoingActivities: number;
  pendingActivities: number;
  notStartedActivities: number;
  cancelledActivities: number;
  distinctProjectsCount: number;
  totalSetsHandled: number;
  completedSetsHandled: number;
}

export interface WorkRecapComputationResult {
  /** 1. Total proyek (mengikuti Aturan 5: aktivitas lanjutan tidak dihitung sebagai proyek baru) */
  totalProjects: number;
  /** Proyek unik yang memiliki aktivitas pada filter saat ini */
  distinctProjectsWithActivities: number;
  /** Proyek baru yang dimulai pada periode terpilih */
  newProjectsInPeriod: number;
  /** Proyek lanjutan lintas bulan yang dimulai sebelum periode terpilih */
  followUpContinuingProjectsInPeriod: number;
  /** Proyek yang benar-benar telah menyelesaikan SELURUH aktivitasnya (Aturan 2) */
  fullyCompletedProjectsCount: number;
  /** 2. Total aktivitas */
  totalActivities: number;
  /** 3. Total pekerjaan selesai (aktivitas berstatus Selesai) */
  totalCompletedWork: number;
  /** 4. Total pekerjaan berjalan (aktivitas berstatus Sedang berjalan) */
  totalOngoingWork: number;
  /**
   * 5. Total pekerjaan tertunda
   * Sesuai Aturan 3: Aktivitas yang belum selesai tetap ditampilkan sebagai pekerjaan tertunda
   * atau berjalan sesuai statusnya (mencakup Tertunda + Belum dimulai/Dijadwalkan yang menunggu pelaksanaan).
   */
  totalPendingWork: number;
  /** Rincian eksplisit status Tertunda murni */
  strictDelayedWorkCount: number;
  /** Rincian eksplisit status Belum dimulai / Dijadwalkan */
  notStartedWorkCount: number;
  /** Rincian eksplisit status Dibatalkan */
  cancelledWorkCount: number;
  /** 6. Total jumlah set (mengikuti detail pekerjaan per aktivitas sesuai Aturan 6, bukan jumlah proyek) */
  totalSets: number;
  /** Jumlah set dari pekerjaan yang sudah selesai */
  completedSets: number;
  /** Ringkasan 5 kondisi Monitoring */
  monitoringConditionsCount: Record<MonitoringWorkCondition, number>;
  /** 7. Total berdasarkan jenis aktivitas */
  byActivityType: ActivityTypeRecapItem[];
  /** 8. Total berdasarkan produk */
  byProduct: ProductRecapItem[];
  /** 9. Produktivitas masing-masing teknisi */
  technicianProductivity: TechnicianProductivityRecapItem[];
  /** Daftar aktivitas hasil filter yang sudah diperkaya dengan kondisi monitoring */
  filteredActivities: Array<
    OperationalActivityRecord & {
      monitoringCondition: MonitoringWorkCondition;
      isFollowUpActivity: boolean;
      effectiveProjectCondition: MonitoringWorkCondition;
    }
  >;
  /** Daftar ringkasan proyek hasil evaluasi Aturan 2 */
  projectSummaries: MonitoringProjectSummary[];
}

/**
 * Memetakan status database ('Belum Dimulai', 'Dijadwalkan', 'Sedang Berjalan', 'Selesai', 'Tertunda', 'Dibatalkan')
 * ke dalam 5 kondisi pekerjaan Monitoring resmi PROMPT 6.
 */
export function normalizeToMonitoringCondition(
  rawStatus: string | null | undefined
): MonitoringWorkCondition {
  const cleaned = String(rawStatus || '').trim().toLowerCase();
  if (cleaned === 'selesai') return 'Selesai';
  if (cleaned === 'sedang berjalan') return 'Sedang berjalan';
  if (cleaned === 'tertunda') return 'Tertunda';
  if (cleaned === 'dibatalkan') return 'Dibatalkan';
  // 'Belum Dimulai' dan 'Dijadwalkan' merupakan pekerjaan yang belum dimulai
  return 'Belum dimulai';
}

/**
 * Memetakan pilihan kondisi Monitoring UI kembali ke nilai ENUM status database PostgreSQL.
 */
export function mapMonitoringConditionToDbStatus(
  condition: MonitoringWorkCondition | OperationalStatus | string
): OperationalStatus {
  const cleaned = String(condition || '').trim().toLowerCase();
  if (cleaned === 'selesai') return 'Selesai';
  if (cleaned === 'sedang berjalan') return 'Sedang Berjalan';
  if (cleaned === 'tertunda') return 'Tertunda';
  if (cleaned === 'dibatalkan') return 'Dibatalkan';
  return 'Dijadwalkan';
}

/**
 * Mengevaluasi apakah sebuah aktivitas berada dalam periode pelaksanaan yang difilter (Aturan 4).
 * Aktivitas lintas bulan dihitung pada periode pelaksanaan (startDate s/d endDate) yang sesuai.
 */
export function doesActivityMatchExecutionPeriod(
  activity: Pick<OperationalActivityRecord, 'startDate' | 'endDate'>,
  periodMonth?: string,
  dateFrom?: string,
  dateTo?: string
): boolean {
  const actStart = activity.startDate || '';
  const actEnd = activity.endDate || actStart;

  if (periodMonth && periodMonth !== 'Semua') {
    const startMonth = actStart.slice(0, 7);
    const endMonth = actEnd.slice(0, 7);
    if (startMonth !== periodMonth && endMonth !== periodMonth) {
      // Cek apabila rentang tanggal aktivitas membentang melewati bulan tersebut
      const monthFirstDay = `${periodMonth}-01`;
      const monthLastDay = `${periodMonth}-31`;
      if (!(actStart <= monthLastDay && actEnd >= monthFirstDay)) {
        return false;
      }
    }
  }

  if (dateFrom && dateFrom.trim() !== '') {
    if (actEnd < dateFrom.trim()) {
      return false;
    }
  }

  if (dateTo && dateTo.trim() !== '') {
    if (actStart > dateTo.trim()) {
      return false;
    }
  }

  return true;
}

/**
 * ATURAN 2:
 * Jangan menganggap seluruh proyek selesai jika masih ada aktivitas yang belum selesai.
 * Menghitung kondisi efektif proyek dari seluruh aktivitas yang tercatat pada proyek tersebut.
 */
export function evaluateEffectiveProjectCondition(
  storedProjectStatus: string,
  allProjectActivities: Array<{ status: string }>
): {
  effectiveCondition: MonitoringWorkCondition;
  isFullyCompleted: boolean;
} {
  const activeActs = allProjectActivities.filter(
    (a) => normalizeToMonitoringCondition(a.status) !== 'Dibatalkan'
  );

  if (allProjectActivities.length > 0 && activeActs.length === 0) {
    return {
      effectiveCondition: 'Dibatalkan',
      isFullyCompleted: false,
    };
  }

  if (activeActs.length === 0) {
    const fallback = normalizeToMonitoringCondition(storedProjectStatus);
    return {
      effectiveCondition: fallback === 'Selesai' ? 'Belum dimulai' : fallback,
      isFullyCompleted: false,
    };
  }

  const conditions = activeActs.map((a) => normalizeToMonitoringCondition(a.status));
  const allCompleted = conditions.every((c) => c === 'Selesai');

  if (allCompleted) {
    return {
      effectiveCondition: 'Selesai',
      isFullyCompleted: true,
    };
  }

  // Jika masih ada aktivitas yang belum selesai, proyek TIDAK BOLEH dianggap Selesai!
  const hasOngoing = conditions.some((c) => c === 'Sedang berjalan');
  const hasCompleted = conditions.some((c) => c === 'Selesai');
  const hasDelayed = conditions.some((c) => c === 'Tertunda');

  if (hasOngoing || hasCompleted) {
    // Proyek yang sebagian aktivitasnya sudah selesai namun masih ada aktivitas lanjutan yang belum selesai
    // tetap berstatus Sedang berjalan (belum selesai penuh)
    return {
      effectiveCondition: 'Sedang berjalan',
      isFullyCompleted: false,
    };
  }

  if (hasDelayed) {
    return {
      effectiveCondition: 'Tertunda',
      isFullyCompleted: false,
    };
  }

  return {
    effectiveCondition: 'Belum dimulai',
    isFullyCompleted: false,
  };
}

/**
 * Fungsi Utama Perhitungan Monitoring & Rekap Pekerjaan (PROMPT 6).
 * Menerima daftar aktivitas nyata, proyek, teknisi, dan katalog produk dari database PostgreSQL.
 */
export function calculateMonitoringAndWorkRecap(params: {
  activities: OperationalActivityRecord[];
  projects?: Array<{
    id: string;
    projectCode: string;
    title: string;
    customerId: string;
    customerName: string;
    installationAddress: string;
    status: OperationalStatus;
    startDate: string | null;
  }>;
  technicians?: Array<{
    id: string;
    technicianCode: string;
    fullName: string;
    specialization: string | null;
    avatarUrl: string;
    isActive: boolean;
  }>;
  products?: Array<{
    id: string;
    name: string;
  }>;
  filters?: MonitoringFilterCriteria;
}): WorkRecapComputationResult {
  const {
    activities,
    projects = [],
    technicians = [],
    products = [],
    filters = {},
  } = params;

  // 1. Urutkan aktivitas per proyek berdasarkan tanggal untuk mendeteksi aktivitas pertama vs aktivitas lanjutan (Aturan 5)
  const allActivitiesByProject = new Map<string, OperationalActivityRecord[]>();
  for (const act of activities) {
    const list = allActivitiesByProject.get(act.projectId) || [];
    list.push(act);
    allActivitiesByProject.set(act.projectId, list);
  }

  const firstActivityIdByProject = new Map<string, string>();
  const earliestStartDateByProject = new Map<string, string>();

  for (const [projId, projActs] of allActivitiesByProject.entries()) {
    const sorted = [...projActs].sort((a, b) => {
      const dateCmp = a.startDate.localeCompare(b.startDate);
      if (dateCmp !== 0) return dateCmp;
      return a.activityCode.localeCompare(b.activityCode);
    });
    if (sorted.length > 0) {
      firstActivityIdByProject.set(projId, sorted[0].id);
      earliestStartDateByProject.set(
        projId,
        sorted[0].projectStartDate || sorted[0].startDate
      );
    }
  }

  for (const prj of projects) {
    if (prj.startDate && !earliestStartDateByProject.has(prj.id)) {
      earliestStartDateByProject.set(prj.id, prj.startDate);
    }
  }

  // Hitung kondisi efektif untuk setiap proyek dari SELURUH aktivitas proyek tersebut (Aturan 2)
  const effectiveConditionByProject = new Map<
    string,
    { effectiveCondition: MonitoringWorkCondition; isFullyCompleted: boolean }
  >();

  for (const [projId, projActs] of allActivitiesByProject.entries()) {
    const storedStatus = projActs[0]?.projectStatus || 'Dijadwalkan';
    effectiveConditionByProject.set(
      projId,
      evaluateEffectiveProjectCondition(storedStatus, projActs)
    );
  }
  for (const prj of projects) {
    if (!effectiveConditionByProject.has(prj.id)) {
      effectiveConditionByProject.set(
        prj.id,
        evaluateEffectiveProjectCondition(prj.status, [])
      );
    }
  }

  // 2. Filter aktivitas berdasarkan kriteria Monitoring / Rekap Pekerjaan
  const periodMonth =
    filters.periodMonth && filters.periodMonth !== 'Semua'
      ? filters.periodMonth.trim()
      : undefined;
  const dateFrom = filters.dateFrom?.trim() || undefined;
  const dateTo = filters.dateTo?.trim() || undefined;
  const projectIdFilter =
    filters.projectId && filters.projectId !== 'Semua' ? filters.projectId : undefined;
  const customerIdFilter =
    filters.customerId && filters.customerId !== 'Semua' ? filters.customerId : undefined;
  const technicianIdFilter =
    filters.technicianId && filters.technicianId !== 'Semua'
      ? filters.technicianId
      : undefined;
  const activityTypeFilter =
    filters.activityType && filters.activityType !== 'Semua'
      ? filters.activityType
      : undefined;
  const productNameFilter =
    filters.productName && filters.productName !== 'Semua'
      ? filters.productName
      : undefined;
  const statusFilter =
    filters.status && filters.status !== 'Semua' ? filters.status.trim() : undefined;
  const searchQuery = filters.searchQuery?.trim().toLowerCase() || '';

  const filteredActivities = activities
    .filter((act) => {
      // Filter Periode / Rentang Tanggal Pelaksanaan (Aturan 4)
      if (!doesActivityMatchExecutionPeriod(act, periodMonth, dateFrom, dateTo)) {
        return false;
      }

      // Filter Proyek
      if (
        projectIdFilter &&
        act.projectId !== projectIdFilter &&
        act.projectCode !== projectIdFilter
      ) {
        return false;
      }

      // Filter Pelanggan
      if (
        customerIdFilter &&
        act.customerId !== customerIdFilter &&
        act.customerName.toLowerCase() !== customerIdFilter.toLowerCase()
      ) {
        return false;
      }

      // Filter Teknisi
      if (technicianIdFilter) {
        const hasTech = act.technicians.some(
          (t) =>
            t.id === technicianIdFilter ||
            t.technicianCode === technicianIdFilter ||
            t.fullName.toLowerCase() === technicianIdFilter.toLowerCase()
        );
        if (!hasTech) return false;
      }

      // Filter Jenis Aktivitas
      if (
        activityTypeFilter &&
        act.activityType.toLowerCase() !== activityTypeFilter.toLowerCase()
      ) {
        return false;
      }

      // Filter Produk
      if (
        productNameFilter &&
        act.productName.toLowerCase() !== productNameFilter.toLowerCase() &&
        act.productId !== productNameFilter
      ) {
        return false;
      }

      // Filter Status / Kondisi Pekerjaan
      if (statusFilter) {
        const condition = normalizeToMonitoringCondition(act.status);
        const matchesCondition =
          condition.toLowerCase() === statusFilter.toLowerCase() ||
          act.status.toLowerCase() === statusFilter.toLowerCase();
        if (!matchesCondition) return false;
      }

      // Filter Kata Kunci Pencarian
      if (searchQuery) {
        const haystack = [
          act.projectCode,
          act.projectTitle,
          act.customerName,
          act.installationAddress,
          act.activityCode,
          act.activityType,
          act.title,
          act.productName,
          ...act.technicians.map((t) => t.fullName),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }

      return true;
    })
    .map((act) => {
      const monitoringCondition = normalizeToMonitoringCondition(act.status);
      const isFollowUpActivity = firstActivityIdByProject.get(act.projectId) !== act.id;
      const effectiveProject = effectiveConditionByProject.get(act.projectId) || {
        effectiveCondition: monitoringCondition,
        isFullyCompleted: false,
      };
      return {
        ...act,
        monitoringCondition,
        isFollowUpActivity,
        effectiveProjectCondition: effectiveProject.effectiveCondition,
      };
    });

  // 3. Hitung 5 Kondisi Pekerjaan Monitoring & Metrik Aktivitas Rekap Pekerjaan
  const monitoringConditionsCount: Record<MonitoringWorkCondition, number> = {
    'Belum dimulai': 0,
    'Sedang berjalan': 0,
    Selesai: 0,
    Tertunda: 0,
    Dibatalkan: 0,
  };

  let totalSets = 0;
  let completedSets = 0;

  const distinctProjectIdsInFiltered = new Set<string>();
  const newProjectIdsInPeriod = new Set<string>();
  const followUpProjectIdsInPeriod = new Set<string>();

  for (const act of filteredActivities) {
    monitoringConditionsCount[act.monitoringCondition] += 1;
    const sets = Math.max(0, Number(act.quantitySets || 0));
    if (act.monitoringCondition !== 'Dibatalkan') {
      totalSets += sets;
    }
    if (act.monitoringCondition === 'Selesai') {
      completedSets += sets;
    }

    distinctProjectIdsInFiltered.add(act.projectId);

    const projOriginDate =
      earliestStartDateByProject.get(act.projectId) ||
      act.projectStartDate ||
      act.startDate;

    if (periodMonth) {
      const originMonth = projOriginDate.slice(0, 7);
      if (originMonth === periodMonth) {
        newProjectIdsInPeriod.add(act.projectId);
      } else {
        // Aturan 5: Aktivitas lanjutan lintas bulan TIDAK BOLEH dihitung sebagai proyek baru!
        followUpProjectIdsInPeriod.add(act.projectId);
      }
    } else if (dateFrom) {
      if (projOriginDate >= dateFrom) {
        newProjectIdsInPeriod.add(act.projectId);
      } else {
        followUpProjectIdsInPeriod.add(act.projectId);
      }
    } else {
      newProjectIdsInPeriod.add(act.projectId);
    }
  }

  // Hitung Total Proyek (Aturan 5):
  // - Tidak pernah menduplikasi proyek karena memiliki beberapa aktivitas lanjutan.
  // - Apabila filter periode/tanggal aktif, proyek lanjutan yang dimulai pada bulan sebelumnya
  //   tetap tercatat dalam distinctProjectsWithActivities, dan totalProjects merepresentasikan
  //   jumlah proyek unik yang relevan tanpa menghitung aktivitas lanjutan sebagai proyek baru.
  const hasActiveFilter = Boolean(
    periodMonth ||
      dateFrom ||
      dateTo ||
      projectIdFilter ||
      customerIdFilter ||
      technicianIdFilter ||
      activityTypeFilter ||
      productNameFilter ||
      statusFilter ||
      searchQuery
  );

  const totalProjects = hasActiveFilter
    ? distinctProjectIdsInFiltered.size
    : projects.length > 0
      ? new Set([...projects.map((p) => p.id), ...distinctProjectIdsInFiltered]).size
      : distinctProjectIdsInFiltered.size;

  const totalActivities = filteredActivities.length;
  const totalCompletedWork = monitoringConditionsCount['Selesai'];
  const totalOngoingWork = monitoringConditionsCount['Sedang berjalan'];
  const strictDelayedWorkCount = monitoringConditionsCount['Tertunda'];
  const notStartedWorkCount = monitoringConditionsCount['Belum dimulai'];
  const cancelledWorkCount = monitoringConditionsCount['Dibatalkan'];

  // Sesuai Aturan 3: Aktivitas yang belum selesai tetap ditampilkan sebagai pekerjaan tertunda
  // atau berjalan sesuai statusnya.
  const totalPendingWork = strictDelayedWorkCount + notStartedWorkCount;

  // 4. Hitung Ringkasan per Proyek (Project Summaries) sesuai Aturan 2
  const projectIdsToSummarize = hasActiveFilter
    ? Array.from(distinctProjectIdsInFiltered)
    : Array.from(
        new Set([...projects.map((p) => p.id), ...allActivitiesByProject.keys()])
      );

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const projectSummaries: MonitoringProjectSummary[] = projectIdsToSummarize.map(
    (projId) => {
      const prjMeta = projectMap.get(projId);
      const allProjActs = allActivitiesByProject.get(projId) || [];
      const matchingProjActs = filteredActivities.filter((a) => a.projectId === projId);
      const firstAct = allProjActs[0] || matchingProjActs[0];

      const effectiveEval = effectiveConditionByProject.get(projId) || {
        effectiveCondition: 'Belum dimulai' as MonitoringWorkCondition,
        isFullyCompleted: false,
      };

      const completedCount = allProjActs.filter(
        (a) => normalizeToMonitoringCondition(a.status) === 'Selesai'
      ).length;
      const ongoingCount = allProjActs.filter(
        (a) => normalizeToMonitoringCondition(a.status) === 'Sedang berjalan'
      ).length;
      const delayedCount = allProjActs.filter(
        (a) => normalizeToMonitoringCondition(a.status) === 'Tertunda'
      ).length;
      const notStartedCount = allProjActs.filter(
        (a) => normalizeToMonitoringCondition(a.status) === 'Belum dimulai'
      ).length;
      const cancelledCount = allProjActs.filter(
        (a) => normalizeToMonitoringCondition(a.status) === 'Dibatalkan'
      ).length;

      const totalWorkDetailSets = matchingProjActs
        .filter((a) => a.monitoringCondition !== 'Dibatalkan')
        .reduce((sum, a) => sum + Number(a.quantitySets || 0), 0);

      return {
        projectId: projId,
        projectCode: prjMeta?.projectCode || firstAct?.projectCode || '-',
        projectTitle: prjMeta?.title || firstAct?.projectTitle || 'Proyek ZIPBLIND',
        customerId: prjMeta?.customerId || firstAct?.customerId || '',
        customerName: prjMeta?.customerName || firstAct?.customerName || '-',
        installationAddress:
          prjMeta?.installationAddress || firstAct?.installationAddress || '-',
        storedProjectStatus: prjMeta?.status || firstAct?.projectStatus || 'Dijadwalkan',
        effectiveProjectCondition: effectiveEval.effectiveCondition,
        isFullyCompleted: effectiveEval.isFullyCompleted,
        hasCrossMonthActivities: allProjActs.some((a) => a.isCrossMonth),
        projectStartDate:
          earliestStartDateByProject.get(projId) ||
          prjMeta?.startDate ||
          firstAct?.projectStartDate ||
          null,
        totalRecordedActivities: allProjActs.length,
        completedActivitiesCount: completedCount,
        ongoingActivitiesCount: ongoingCount,
        pendingActivitiesCount: delayedCount + notStartedCount,
        notStartedActivitiesCount: notStartedCount,
        cancelledActivitiesCount: cancelledCount,
        totalWorkDetailSets,
        activities: matchingProjActs,
      };
    }
  );

  const fullyCompletedProjectsCount = projectSummaries.filter(
    (p) => p.isFullyCompleted
  ).length;

  // 5. Hitung Total Berdasarkan Jenis Aktivitas (Aturan 1 & 6)
  const activityTypeMap = new Map<OperationalActivityType, ActivityTypeRecapItem>();
  for (const actType of OPERATIONAL_ACTIVITY_TYPES) {
    activityTypeMap.set(actType, {
      activityType: actType,
      totalActivities: 0,
      completedActivities: 0,
      ongoingActivities: 0,
      pendingActivities: 0,
      notStartedActivities: 0,
      cancelledActivities: 0,
      totalSets: 0,
    });
  }

  for (const act of filteredActivities) {
    const existing = activityTypeMap.get(act.activityType) || {
      activityType: act.activityType,
      totalActivities: 0,
      completedActivities: 0,
      ongoingActivities: 0,
      pendingActivities: 0,
      notStartedActivities: 0,
      cancelledActivities: 0,
      totalSets: 0,
    };

    existing.totalActivities += 1;
    if (act.monitoringCondition === 'Selesai') {
      existing.completedActivities += 1;
    } else if (act.monitoringCondition === 'Sedang berjalan') {
      existing.ongoingActivities += 1;
    } else if (act.monitoringCondition === 'Tertunda') {
      existing.pendingActivities += 1;
    } else if (act.monitoringCondition === 'Belum dimulai') {
      existing.notStartedActivities += 1;
      existing.pendingActivities += 1;
    } else if (act.monitoringCondition === 'Dibatalkan') {
      existing.cancelledActivities += 1;
    }

    if (act.monitoringCondition !== 'Dibatalkan') {
      existing.totalSets += Number(act.quantitySets || 0);
    }

    activityTypeMap.set(act.activityType, existing);
  }

  const byActivityType = Array.from(activityTypeMap.values()).filter(
    (item) =>
      item.totalActivities > 0 ||
      ['Survey', 'Pengukuran', 'Persiapan', 'Pemasangan', 'Service', 'Pengiriman'].includes(
        item.activityType
      )
  );

  // 6. Hitung Total Berdasarkan Produk (Aturan 6: Jumlah set mengikuti detail pekerjaan)
  const productAccumMap = new Map<
    string,
    {
      productName: string;
      totalActivities: number;
      completedActivities: number;
      ongoingActivities: number;
      pendingActivities: number;
      projectIds: Set<string>;
      totalSets: number;
      completedSets: number;
    }
  >();

  for (const prod of products) {
    productAccumMap.set(prod.name, {
      productName: prod.name,
      totalActivities: 0,
      completedActivities: 0,
      ongoingActivities: 0,
      pendingActivities: 0,
      projectIds: new Set<string>(),
      totalSets: 0,
      completedSets: 0,
    });
  }

  for (const act of filteredActivities) {
    const prodName = act.productName || 'Zipblind';
    const entry = productAccumMap.get(prodName) || {
      productName: prodName,
      totalActivities: 0,
      completedActivities: 0,
      ongoingActivities: 0,
      pendingActivities: 0,
      projectIds: new Set<string>(),
      totalSets: 0,
      completedSets: 0,
    };

    entry.totalActivities += 1;
    entry.projectIds.add(act.projectId);

    const sets = Number(act.quantitySets || 0);
    if (act.monitoringCondition !== 'Dibatalkan') {
      entry.totalSets += sets;
    }

    if (act.monitoringCondition === 'Selesai') {
      entry.completedActivities += 1;
      entry.completedSets += sets;
    } else if (act.monitoringCondition === 'Sedang berjalan') {
      entry.ongoingActivities += 1;
    } else if (
      act.monitoringCondition === 'Tertunda' ||
      act.monitoringCondition === 'Belum dimulai'
    ) {
      entry.pendingActivities += 1;
    }

    productAccumMap.set(prodName, entry);
  }

  const byProduct: ProductRecapItem[] = Array.from(productAccumMap.values()).map(
    (entry) => ({
      productName: entry.productName,
      totalActivities: entry.totalActivities,
      completedActivities: entry.completedActivities,
      ongoingActivities: entry.ongoingActivities,
      pendingActivities: entry.pendingActivities,
      distinctProjectsCount: entry.projectIds.size,
      totalSets: entry.totalSets,
      completedSets: entry.completedSets,
    })
  );

  // 7. Hitung Produktivitas Masing-Masing Teknisi
  const techAccumMap = new Map<
    string,
    {
      technicianId: string;
      technicianCode: string;
      fullName: string;
      specialization: string;
      avatarUrl: string;
      isActive: boolean;
      totalAssignedActivities: number;
      completedActivities: number;
      ongoingActivities: number;
      pendingActivities: number;
      notStartedActivities: number;
      cancelledActivities: number;
      projectIds: Set<string>;
      totalSetsHandled: number;
      completedSetsHandled: number;
    }
  >();

  for (const tech of technicians) {
    techAccumMap.set(tech.id, {
      technicianId: tech.id,
      technicianCode: tech.technicianCode,
      fullName: tech.fullName,
      specialization: tech.specialization || 'Teknisi Instalasi & Pengukuran',
      avatarUrl: tech.avatarUrl || '/images/ref_exec_tech1.png',
      isActive: tech.isActive,
      totalAssignedActivities: 0,
      completedActivities: 0,
      ongoingActivities: 0,
      pendingActivities: 0,
      notStartedActivities: 0,
      cancelledActivities: 0,
      projectIds: new Set<string>(),
      totalSetsHandled: 0,
      completedSetsHandled: 0,
    });
  }

  for (const act of filteredActivities) {
    for (const assigned of act.technicians) {
      const existing = techAccumMap.get(assigned.id) || {
        technicianId: assigned.id,
        technicianCode: assigned.technicianCode,
        fullName: assigned.fullName,
        specialization: assigned.specialization || 'Teknisi Instalasi & Pengukuran',
        avatarUrl: assigned.avatarUrl || '/images/ref_exec_tech1.png',
        isActive: assigned.isActive,
        totalAssignedActivities: 0,
        completedActivities: 0,
        ongoingActivities: 0,
        pendingActivities: 0,
        notStartedActivities: 0,
        cancelledActivities: 0,
        projectIds: new Set<string>(),
        totalSetsHandled: 0,
        completedSetsHandled: 0,
      };

      existing.totalAssignedActivities += 1;
      existing.projectIds.add(act.projectId);

      const sets = Number(act.quantitySets || 0);
      if (act.monitoringCondition !== 'Dibatalkan') {
        existing.totalSetsHandled += sets;
      }

      if (act.monitoringCondition === 'Selesai') {
        existing.completedActivities += 1;
        existing.completedSetsHandled += sets;
      } else if (act.monitoringCondition === 'Sedang berjalan') {
        existing.ongoingActivities += 1;
      } else if (act.monitoringCondition === 'Tertunda') {
        existing.pendingActivities += 1;
      } else if (act.monitoringCondition === 'Belum dimulai') {
        existing.notStartedActivities += 1;
        existing.pendingActivities += 1;
      } else if (act.monitoringCondition === 'Dibatalkan') {
        existing.cancelledActivities += 1;
      }

      techAccumMap.set(assigned.id, existing);
    }
  }

  const technicianProductivity: TechnicianProductivityRecapItem[] = Array.from(
    techAccumMap.values()
  )
    .filter((t) => !technicianIdFilter || t.technicianId === technicianIdFilter)
    .map((t) => ({
      technicianId: t.technicianId,
      technicianCode: t.technicianCode,
      fullName: t.fullName,
      specialization: t.specialization,
      avatarUrl: t.avatarUrl,
      isActive: t.isActive,
      totalAssignedActivities: t.totalAssignedActivities,
      completedActivities: t.completedActivities,
      ongoingActivities: t.ongoingActivities,
      pendingActivities: t.pendingActivities,
      notStartedActivities: t.notStartedActivities,
      cancelledActivities: t.cancelledActivities,
      distinctProjectsCount: t.projectIds.size,
      totalSetsHandled: t.totalSetsHandled,
      completedSetsHandled: t.completedSetsHandled,
    }));

  return {
    totalProjects,
    distinctProjectsWithActivities: distinctProjectIdsInFiltered.size,
    newProjectsInPeriod: newProjectIdsInPeriod.size,
    followUpContinuingProjectsInPeriod: followUpProjectIdsInPeriod.size,
    fullyCompletedProjectsCount,
    totalActivities,
    totalCompletedWork,
    totalOngoingWork,
    totalPendingWork,
    strictDelayedWorkCount,
    notStartedWorkCount,
    cancelledWorkCount,
    totalSets,
    completedSets,
    monitoringConditionsCount,
    byActivityType,
    byProduct,
    technicianProductivity,
    filteredActivities,
    projectSummaries,
  };
}
