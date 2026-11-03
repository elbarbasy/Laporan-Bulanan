import {
  type OperationalActivityRecord,
} from './zipblind-operational';
import {
  buildOfficialMonthlyReport,
  ensureUniqueMonthlyReportArchive,
  formatIndonesianPeriodMonth,
  type MonthlyReportActivityBreakdown,
  type MonthlyReportArchiveEntry,
  type MonthlyReportPhotoItem,
  type MonthlyReportProductItem,
  type MonthlyReportProjectItem,
  type MonthlyReportTechnicianItem,
  type OfficialMonthlyReportData,
  type PreviousMonthComparisonData,
} from './zipblind-monthly-report';
import { normalizeToMonitoringCondition } from './zipblind-monitoring-rekap';
import { authorizeRoleAccess } from './zipblind-auth';

export interface ExecutivePeriodSummary {
  periodMonth: string;
  periodLabel: string;
  reportDocumentNumber: string;
  officialGeneratedDate: string;
  officialGeneratedDateLabel: string;
  lastSynchronizedAt: string;
  totalActivitiesInPeriod: number;
  completedActivitiesInPeriod: number;
  totalSetsInPeriod: number;
  completedSetsInPeriod: number;
  completionRatePercent: number;
}

export interface ExecutiveWorkTrendPoint {
  periodMonth: string;
  shortLabel: string;
  fullLabel: string;
  totalActivities: number;
  completedActivities: number;
  ongoingActivities: number;
  totalSets: number;
  completedSets: number;
}

export interface ExecutiveProductRecapItem extends MonthlyReportProductItem {
  sharePercent: number;
  colorHex: string;
}

export interface ExecutiveTechnicianProductivityItem extends MonthlyReportTechnicianItem {
  completionScorePercent: number;
}

export interface ExecutiveDashboardPayload {
  readOnly: true;
  role: 'executive';
  allowedCapabilities: readonly [
    'view_work_summary',
    'view_charts',
    'view_technician_productivity',
    'view_project_documentation',
    'view_monthly_reports',
    'download_pdf_excel',
  ];
  forbiddenCapabilities: readonly [
    'add_data',
    'update_data',
    'delete_data',
    'update_schedule',
    'manage_technicians',
    'access_admin_settings',
  ];
  selectedPeriod: string;
  availablePeriods: Array<{
    periodMonth: string;
    periodLabel: string;
    officialGeneratedDateLabel: string;
  }>;
  // 1. Ringkasan periode laporan
  periodSummary: ExecutivePeriodSummary;
  // 2. Total proyek
  totalProjects: number;
  newProjectsCount: number;
  continuingProjectsCount: number;
  // 3. Proyek selesai
  completedProjects: number;
  // 4. Proyek berjalan
  ongoingProjects: number;
  // 5. Proyek tertunda
  delayedProjects: number;
  // 6. Grafik perkembangan pekerjaan
  workTrendSeries: ExecutiveWorkTrendPoint[];
  // 7. Rekap jenis aktivitas
  activityTypeRecap: MonthlyReportActivityBreakdown[];
  // 8. Rekap produk
  productRecap: ExecutiveProductRecapItem[];
  // 9. Produktivitas teknisi
  technicianProductivity: ExecutiveTechnicianProductivityItem[];
  // 10. Riwayat proyek
  projectHistory: MonthlyReportProjectItem[];
  // 11. Dokumentasi proyek
  projectDocumentation: MonthlyReportPhotoItem[];
  // 12. Arsip laporan bulanan
  monthlyReportArchives: MonthlyReportArchiveEntry[];
  reportsByPeriod: Record<string, OfficialMonthlyReportData>;
  // 13. Perbandingan bulan sebelumnya
  previousMonthComparison: PreviousMonthComparisonData;
}

const PRODUCT_COLOR_MAP: Record<string, string> = {
  'Roller Blind': '#1A64E0',
  Zipblind: '#0D3B82',
  'Vertical Blind': '#15B8A6',
  'Venetian Blind': '#67C6F3',
};

const SHORT_INDONESIAN_MONTHS: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'Mei',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Agu',
  '09': 'Sep',
  '10': 'Okt',
  '11': 'Nov',
  '12': 'Des',
};

function isActivityInMonth(
  act: Pick<OperationalActivityRecord, 'startDate' | 'endDate'>,
  periodMonth: string
): boolean {
  const startM = (act.startDate || '').slice(0, 7);
  const endM = (act.endDate || act.startDate || '').slice(0, 7);
  if (startM === periodMonth || endM === periodMonth) return true;
  const firstDay = `${periodMonth}-01`;
  const lastDay = `${periodMonth}-31`;
  return act.startDate <= lastDay && (act.endDate || act.startDate) >= firstDay;
}

/**
 * Membangun seluruh 13 komponen wajib Dashboard Pimpinan berdasarkan data aktual database.
 */
export function buildExecutiveDashboardPayload(params: {
  requestedPeriod?: string;
  activities: OperationalActivityRecord[];
  projects: Array<{
    id: string;
    projectCode: string;
    title: string;
    customerId: string;
    customerName: string;
    installationAddress: string;
    status: 'Dijadwalkan' | 'Sedang Berjalan' | 'Selesai' | 'Tertunda' | 'Dibatalkan';
    startDate: string | null;
  }>;
  technicians: Array<{
    id: string;
    technicianCode: string;
    fullName: string;
    specialization: string | null;
    avatarUrl: string;
    isActive: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
  }>;
  photos: Array<{
    id: string;
    projectId: string;
    projectCode: string;
    projectTitle: string;
    activityId: string | null;
    activityType: string;
    activityDate?: string | null;
    documentationCategory: string;
    caption: string;
    uploadedAt: string;
    imageUrl: string;
  }>;
  exportLogs?: Array<{
    reportPeriodMonth: string;
    exportFormat: string;
    exportedAt: string;
  }>;
  synchronizedAtIso?: string;
}): ExecutiveDashboardPayload {
  const {
    requestedPeriod,
    activities,
    projects,
    technicians,
    products,
    photos,
    exportLogs = [],
    synchronizedAtIso = new Date().toISOString(),
  } = params;

  // Kumpulkan periode laporan resmi (minimal Oktober, November, Desember 2026 + bulan aktivitas aktual)
  const periodSet = new Set<string>(['2026-10', '2026-11', '2026-12']);
  for (const act of activities) {
    if (act.startDate && act.startDate.length >= 7) {
      periodSet.add(act.startDate.slice(0, 7));
    }
    if (act.endDate && act.endDate.length >= 7) {
      periodSet.add(act.endDate.slice(0, 7));
    }
  }

  const sortedPeriodsDesc = Array.from(periodSet).sort((a, b) => b.localeCompare(a));

  const reportsByPeriod: Record<string, OfficialMonthlyReportData> = {};
  let archives: MonthlyReportArchiveEntry[] = [];

  for (const period of sortedPeriodsDesc) {
    const report = buildOfficialMonthlyReport({
      periodMonth: period,
      activities,
      projects,
      technicians,
      products,
      photos,
    });
    reportsByPeriod[period] = report;

    const periodExports = exportLogs.filter(
      (e) => e.reportPeriodMonth.slice(0, 7) === period
    );
    const pdfCount = periodExports.filter((e) => e.exportFormat === 'PDF').length;
    const excelCount = periodExports.filter((e) => e.exportFormat === 'EXCEL').length;
    const latestExport = periodExports[0]?.exportedAt || null;

    const candidateEntry: MonthlyReportArchiveEntry = {
      id: `archive-${period}`,
      periodMonth: period,
      periodLabel: report.periodLabel,
      reportTitle: `Laporan Operasional Bulanan — ${report.periodLabel}`,
      reportDocumentNumber: report.reportDocumentNumber,
      officialGeneratedDate: report.officialGeneratedDate,
      officialGeneratedDateLabel: report.officialGeneratedDateLabel,
      isAutoGenerated: true,
      totalProjects: report.totalProjects,
      newProjectsCount: report.newProjectsCount,
      continuingProjectsCount: report.continuingProjectsCount,
      completedProjects: report.completedProjects,
      ongoingProjects: report.ongoingProjects,
      delayedProjects: report.delayedProjects,
      totalActivities: report.totalActivitiesInPeriod,
      totalSets: report.totalSets,
      completedSets: report.completedSets,
      photosCount: report.photoDocumentation.length,
      pdfExportCount: pdfCount,
      excelExportCount: excelCount,
      lastExportedAt: latestExport,
    };

    const dedup = ensureUniqueMonthlyReportArchive(archives, candidateEntry);
    archives = dedup.archives;
  }

  const selectedPeriod =
    requestedPeriod && reportsByPeriod[requestedPeriod]
      ? requestedPeriod
      : reportsByPeriod['2026-11']
        ? '2026-11'
        : sortedPeriodsDesc[0];

  const activeReport = reportsByPeriod[selectedPeriod];

  // 1. Ringkasan Periode Laporan
  const completionRatePercent =
    activeReport.totalSets > 0
      ? Math.round((activeReport.completedSets / activeReport.totalSets) * 100)
      : activeReport.totalActivitiesInPeriod > 0
        ? Math.round(
            (activeReport.completedActivitiesInPeriod /
              activeReport.totalActivitiesInPeriod) *
              100
          )
        : 0;

  const periodSummary: ExecutivePeriodSummary = {
    periodMonth: activeReport.periodMonth,
    periodLabel: activeReport.periodLabel,
    reportDocumentNumber: activeReport.reportDocumentNumber,
    officialGeneratedDate: activeReport.officialGeneratedDate,
    officialGeneratedDateLabel: activeReport.officialGeneratedDateLabel,
    lastSynchronizedAt: synchronizedAtIso,
    totalActivitiesInPeriod: activeReport.totalActivitiesInPeriod,
    completedActivitiesInPeriod: activeReport.completedActivitiesInPeriod,
    totalSetsInPeriod: activeReport.totalSets,
    completedSetsInPeriod: activeReport.completedSets,
    completionRatePercent,
  };

  // 6. Grafik Perkembangan Pekerjaan (6 Bulan: Jul 2026 - Des 2026 dari data aktual database)
  const chartMonths = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
  const workTrendSeries: ExecutiveWorkTrendPoint[] = chartMonths.map((m) => {
    const [yr, mo] = m.split('-');
    const shortLabel = `${SHORT_INDONESIAN_MONTHS[mo] || mo} ${yr.slice(2)}`;
    const fullLabel = formatIndonesianPeriodMonth(m);

    const monthActs = activities.filter((act) => isActivityInMonth(act, m));
    let totalActivities = 0;
    let completedActivities = 0;
    let ongoingActivities = 0;
    let totalSets = 0;
    let completedSets = 0;

    for (const act of monthActs) {
      const cond = normalizeToMonitoringCondition(act.status);
      if (cond === 'Dibatalkan') continue;
      const sets = Number(act.quantitySets || 0);
      totalActivities += 1;
      totalSets += sets;
      if (cond === 'Selesai') {
        completedActivities += 1;
        completedSets += sets;
      } else if (cond === 'Sedang berjalan') {
        ongoingActivities += 1;
      }
    }

    return {
      periodMonth: m,
      shortLabel,
      fullLabel,
      totalActivities,
      completedActivities,
      ongoingActivities,
      totalSets,
      completedSets,
    };
  });

  // 7. Rekap Jenis Aktivitas
  const activityTypeRecap: MonthlyReportActivityBreakdown[] = [
    activeReport.measurementActivity,
    activeReport.installationActivity,
    activeReport.surveyActivity,
    activeReport.serviceActivity,
    activeReport.repairActivity,
    ...activeReport.otherActivities,
  ];

  // 8. Rekap Produk (Persentase distribusi dari data aktual periode terpilih)
  const totalProductSets = activeReport.productRecap.reduce(
    (sum, item) => sum + item.totalSets,
    0
  );
  const productRecap: ExecutiveProductRecapItem[] = activeReport.productRecap.map(
    (item) => ({
      ...item,
      sharePercent:
        totalProductSets > 0
          ? Math.round((item.totalSets / totalProductSets) * 100)
          : 0,
      colorHex: PRODUCT_COLOR_MAP[item.productName] || '#2368B5',
    })
  );

  // 9. Produktivitas Teknisi
  const technicianProductivity: ExecutiveTechnicianProductivityItem[] =
    activeReport.technicianProductivity.map((tech) => {
      const completionScorePercent =
        tech.totalSetsHandled > 0
          ? Math.round((tech.completedSetsHandled / tech.totalSetsHandled) * 100)
          : tech.totalActivities > 0
            ? Math.round((tech.completedActivities / tech.totalActivities) * 100)
            : 0;
      return {
        ...tech,
        completionScorePercent,
      };
    });

  return {
    readOnly: true,
    role: 'executive',
    allowedCapabilities: [
      'view_work_summary',
      'view_charts',
      'view_technician_productivity',
      'view_project_documentation',
      'view_monthly_reports',
      'download_pdf_excel',
    ],
    forbiddenCapabilities: [
      'add_data',
      'update_data',
      'delete_data',
      'update_schedule',
      'manage_technicians',
      'access_admin_settings',
    ],
    selectedPeriod,
    availablePeriods: archives.map((a) => ({
      periodMonth: a.periodMonth,
      periodLabel: a.periodLabel,
      officialGeneratedDateLabel: a.officialGeneratedDateLabel,
    })),
    periodSummary,
    totalProjects: activeReport.totalProjects,
    newProjectsCount: activeReport.newProjectsCount,
    continuingProjectsCount: activeReport.continuingProjectsCount,
    completedProjects: activeReport.completedProjects,
    ongoingProjects: activeReport.ongoingProjects,
    delayedProjects: activeReport.delayedProjects,
    workTrendSeries,
    activityTypeRecap,
    productRecap,
    technicianProductivity,
    projectHistory: activeReport.projectDetails,
    projectDocumentation: activeReport.photoDocumentation,
    monthlyReportArchives: archives,
    reportsByPeriod,
    previousMonthComparison: activeReport.previousMonthComparison,
  };
}

/**
 * Memastikan tidak ada kredensial atau data internal Admin yang bocor pada payload Pimpinan.
 */
export function verifyNoAdminSecretsLeaked(payload: unknown): {
  safe: boolean;
  leakedKeys: string[];
} {
  const FORBIDDEN_INTERNAL_KEYS = new Set([
    'passwordHash',
    'password_hash',
    'tokenHash',
    'token_hash',
    'service_role',
    'serviceRoleKey',
    'adminEmail',
    'admin_users',
    'admin_activity_logs',
    'createdByAdminId',
    'revokedByAdminId',
    'sessionSignature',
  ]);

  const leaked: string[] = [];

  function walk(node: unknown, pathPrefix: string) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((child, idx) => walk(child, `${pathPrefix}[${idx}]`));
      return;
    }
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_INTERNAL_KEYS.has(key)) {
        leaked.push(`${pathPrefix}.${key}`);
      }
      walk(val, `${pathPrefix}.${key}`);
    }
  }

  walk(payload, 'root');
  return {
    safe: leaked.length === 0,
    leakedKeys: leaked,
  };
}

/**
 * Penjaga keamanan Read-Only Pimpinan: menolak semua operasi tambah/ubah/hapus data,
 * ubah jadwal, kelola teknisi, maupun akses pengaturan admin.
 */
export function enforceExecutiveReadOnlyGuard(params: {
  httpMethod: string;
  attemptedOperation?:
    | 'view_dashboard'
    | 'download_pdf'
    | 'download_excel'
    | 'add_data'
    | 'update_data'
    | 'delete_data'
    | 'update_schedule'
    | 'manage_technicians'
    | 'access_admin_settings';
  canDownloadReports?: boolean;
}): {
  allowed: boolean;
  status: number;
  code: string;
  message: string;
} {
  const {
    httpMethod,
    attemptedOperation = 'view_dashboard',
    canDownloadReports = true,
  } = params;

  const upperMethod = httpMethod.toUpperCase();

  // Tolak eksplisit seluruh operasi terlarang pimpinan sesuai spesifikasi PROMPT 8
  const forbiddenOps = new Set([
    'add_data',
    'update_data',
    'delete_data',
    'update_schedule',
    'manage_technicians',
    'access_admin_settings',
  ]);

  if (forbiddenOps.has(attemptedOperation)) {
    return {
      allowed: false,
      status: 403,
      code: 'FORBIDDEN_EXECUTIVE_READ_ONLY',
      message:
        'Akses ditolak: Dashboard Pimpinan bersifat Read-Only. Pimpinan tidak diizinkan menambah, mengubah, menghapus data, mengubah jadwal, mengelola teknisi, atau mengakses pengaturan admin.',
    };
  }

  const isDownload =
    attemptedOperation === 'download_pdf' || attemptedOperation === 'download_excel';

  const rbac = authorizeRoleAccess({
    role: 'executive',
    httpMethod: upperMethod,
    targetScope: 'executive',
    canDownloadReports,
    isReportDownloadRequest: isDownload,
  });

  return {
    allowed: rbac.allowed,
    status: rbac.status,
    code: rbac.code,
    message: rbac.message,
  };
}
