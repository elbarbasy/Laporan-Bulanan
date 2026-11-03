/**
 * Modul Sistem Laporan Bulanan Otomatis ZIPBLIND (Tahap 7 — PROMPT 7)
 *
 * Ketentuan Spesifikasi:
 * 1. Waktu Pembuatan:
 *    - Laporan bulanan resmi dibuat otomatis pada tanggal 1 bulan berikutnya.
 *      (Contoh: Laporan November dibuat pada 1 Desember; Laporan Desember dibuat pada 1 Januari).
 *    - Bebas duplikasi: Tidak menghasilkan laporan ganda untuk periode yang sama.
 * 2. Isi Laporan (14 Bagian Resmi):
 *    1) Total proyek
 *    2) Proyek selesai
 *    3) Proyek berjalan
 *    4) Proyek tertunda
 *    5) Aktivitas pengukuran
 *    6) Aktivitas pemasangan
 *    7) Aktivitas survey
 *    8) Aktivitas service
 *    9) Aktivitas perbaikan
 *    10) Total jumlah set
 *    11) Rekap berdasarkan produk
 *    12) Produktivitas teknisi
 *    13) Dokumentasi foto jika tersedia
 *    14) Perbandingan dengan bulan sebelumnya
 * 3. Pekerjaan Lintas Bulan:
 *    - Contoh Proyek Rumah A: Pengukuran selesai pada November, Pemasangan dilakukan pada Desember.
 *    - Laporan November menampilkan pengukuran sebagai selesai dan pemasangan sebagai pekerjaan yang belum dilaksanakan.
 *    - Laporan Desember menampilkan aktivitas pemasangan sesuai pelaksanaannya.
 *    - Aktivitas Desember TIDAK dihitung sebagai proyek baru jika masih merupakan bagian Proyek Rumah A.
 */

import {
  formatAssignedTechniciansColumn,
  type OperationalActivityRecord,
  type OperationalActivityType,
  type OperationalStatus,
} from './zipblind-operational';
import { normalizeToMonitoringCondition, type MonitoringWorkCondition } from './zipblind-monitoring-rekap';

export interface MonthlyReportActivityBreakdown {
  activityType: 'Pengukuran' | 'Pemasangan' | 'Survey' | 'Service' | 'Perbaikan' | 'Persiapan' | 'Pengiriman' | 'Lainnya';
  /** Jumlah aktivitas yang dijadwalkan/dilaksanakan pada bulan laporan ini */
  executedInPeriodCount: number;
  completedCount: number;
  ongoingCount: number;
  delayedOrNotStartedCount: number;
  /**
   * Khusus penanganan lintas bulan (contoh: Proyek Rumah A dimulai November, namun Pemasangan dijadwalkan Desember):
   * Jumlah tahapan aktivitas dari proyek bulan ini yang belum dilaksanakan karena dijadwalkan pada bulan berikutnya.
   */
  unexecutedFutureCrossMonthCount: number;
  totalSetsInPeriod: number;
  completedSetsInPeriod: number;
  unexecutedFutureCrossMonthSets: number;
}

export interface MonthlyReportProjectItem {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  customerName: string;
  installationAddress: string;
  projectOriginMonth: string; // YYYY-MM
  /** Apakah proyek ini baru dimulai pada bulan laporan? (False jika merupakan proyek lanjutan dari bulan sebelumnya) */
  isNewProjectInPeriod: boolean;
  /** Apakah proyek ini merupakan kelanjutan dari bulan sebelumnya? */
  isContinuingFromPreviousMonth: boolean;
  /** Status efektif proyek pada akhir periode bulan laporan */
  statusInPeriod: 'Selesai' | 'Berjalan' | 'Tertunda';
  /** Daftar aktivitas proyek yang dilaksanakan pada bulan laporan */
  activitiesInPeriod: Array<{
    id: string;
    activityCode: string;
    activityType: OperationalActivityType;
    title: string;
    startDate: string;
    endDate: string;
    condition: MonitoringWorkCondition;
    productName: string;
    quantitySets: number;
    techniciansText: string;
  }>;
  /**
   * Daftar aktivitas lanjutan dari proyek ini yang belum dilaksanakan pada bulan laporan
   * (misal: Pemasangan Rumah A pada 15 Desember saat melihat Laporan November)
   */
  unexecutedFollowUpActivities: Array<{
    id: string;
    activityCode: string;
    activityType: OperationalActivityType;
    title: string;
    scheduledDate: string;
    productName: string;
    quantitySets: number;
    statusLabel: string;
  }>;
}

export interface MonthlyReportProductItem {
  productName: string;
  projectsCount: number;
  activitiesCount: number;
  completedActivitiesCount: number;
  incompleteActivitiesCount: number;
  totalSets: number;
  completedSets: number;
}

export interface MonthlyReportTechnicianItem {
  technicianId: string;
  technicianCode: string;
  fullName: string;
  specialization: string;
  avatarUrl: string;
  projectsCount: number;
  totalActivities: number;
  completedActivities: number;
  ongoingActivities: number;
  pendingActivities: number;
  totalSetsHandled: number;
  completedSetsHandled: number;
}

export interface MonthlyReportPhotoItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  activityType: string;
  documentationCategory: string;
  caption: string;
  uploadedAt: string;
  imageUrl: string;
}

export interface PreviousMonthComparisonData {
  previousPeriodMonth: string;
  previousPeriodLabel: string;
  previousTotalProjects: number;
  previousNewProjects: number;
  previousCompletedProjects: number;
  previousOngoingProjects: number;
  previousDelayedProjects: number;
  previousTotalActivities: number;
  previousCompletedActivities: number;
  previousTotalSets: number;
  previousCompletedSets: number;
  deltaTotalProjects: number;
  deltaCompletedProjects: number;
  deltaTotalActivities: number;
  deltaTotalSets: number;
  summaryNarrative: string;
}

export interface OfficialMonthlyReportData {
  /** Format YYYY-MM, contoh: '2026-11' */
  periodMonth: string;
  /** Label bulan bahasa Indonesia, contoh: 'November 2026' */
  periodLabel: string;
  /** Tanggal pembuatan otomatis resmi (Tanggal 1 bulan berikutnya, contoh: '2026-12-01') */
  officialGeneratedDate: string;
  /** Label tanggal pembuatan resmi, contoh: '1 Desember 2026' */
  officialGeneratedDateLabel: string;
  /** Nomor dokumen resmi */
  reportDocumentNumber: string;

  // 1–4. Ringkasan Proyek
  /** 1. Total proyek yang terlibat pada bulan laporan (Proyek Baru + Proyek Lanjutan) */
  totalProjects: number;
  /** Proyek baru yang dimulai pada bulan laporan (Aktivitas bulan berikutnya TIDAK dihitung sebagai proyek baru) */
  newProjectsCount: number;
  /** Proyek lanjutan dari bulan sebelumnya */
  continuingProjectsCount: number;
  /** 2. Proyek selesai */
  completedProjects: number;
  /** 3. Proyek berjalan */
  ongoingProjects: number;
  /** 4. Proyek tertunda */
  delayedProjects: number;

  // 5–9. Rincian 5 Aktivitas Utama Wajib
  /** 5. Aktivitas pengukuran */
  measurementActivity: MonthlyReportActivityBreakdown;
  /** 6. Aktivitas pemasangan */
  installationActivity: MonthlyReportActivityBreakdown;
  /** 7. Aktivitas survey */
  surveyActivity: MonthlyReportActivityBreakdown;
  /** 8. Aktivitas service */
  serviceActivity: MonthlyReportActivityBreakdown;
  /** 9. Aktivitas perbaikan */
  repairActivity: MonthlyReportActivityBreakdown;
  /** Aktivitas pendukung lainnya (Persiapan / Pengiriman) agar total aktivitas tetap transparan */
  otherActivities: MonthlyReportActivityBreakdown[];
  totalActivitiesInPeriod: number;
  completedActivitiesInPeriod: number;

  // 10. Total Jumlah Set
  /** 10. Total jumlah set dari detail pekerjaan pada periode ini */
  totalSets: number;
  completedSets: number;
  unexecutedCrossMonthSets: number;

  // 11. Rekap Berdasarkan Produk
  productRecap: MonthlyReportProductItem[];

  // 12. Produktivitas Teknisi
  technicianProductivity: MonthlyReportTechnicianItem[];

  // 13. Dokumentasi Foto Jika Tersedia
  photoDocumentation: MonthlyReportPhotoItem[];

  // 14. Perbandingan dengan Bulan Sebelumnya
  previousMonthComparison: PreviousMonthComparisonData;

  // Rincian Proyek & Pekerjaan Lintas Bulan
  projectDetails: MonthlyReportProjectItem[];
}

export interface MonthlyReportArchiveEntry {
  id: string;
  periodMonth: string; // YYYY-MM
  periodLabel: string;
  reportTitle: string;
  reportDocumentNumber: string;
  officialGeneratedDate: string; // YYYY-MM-01 bulan berikutnya
  officialGeneratedDateLabel: string;
  isAutoGenerated: boolean;
  totalProjects: number;
  newProjectsCount: number;
  continuingProjectsCount: number;
  completedProjects: number;
  ongoingProjects: number;
  delayedProjects: number;
  totalActivities: number;
  totalSets: number;
  completedSets: number;
  photosCount: number;
  pdfExportCount: number;
  excelExportCount: number;
  lastExportedAt: string | null;
}

const INDONESIAN_MONTHS: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

/**
 * Mengubah 'YYYY-MM' menjadi label bahasa Indonesia, contoh: '2026-11' -> 'November 2026'
 */
export function formatIndonesianPeriodMonth(periodMonth: string): string {
  const [year, month] = String(periodMonth || '').split('-');
  if (!year || !month) return periodMonth;
  return `${INDONESIAN_MONTHS[month] || month} ${year}`;
}

/**
 * Mengubah 'YYYY-MM-DD' menjadi label tanggal bahasa Indonesia, contoh: '2026-12-01' -> '1 Desember 2026'
 */
export function formatIndonesianDateLabel(dateStr: string): string {
  const [year, month, day] = String(dateStr || '').split('-');
  if (!year || !month || !day) return dateStr;
  return `${Number(day)} ${INDONESIAN_MONTHS[month] || month} ${year}`;
}

/**
 * ATURAN WAKTU PEMBUATAN (PROMPT 7):
 * Laporan bulanan resmi dibuat otomatis pada tanggal 1 bulan berikutnya.
 * Contoh:
 * - Laporan November ('2026-11') dibuat pada 1 Desember ('2026-12-01').
 * - Laporan Desember ('2026-12') dibuat pada 1 Januari ('2027-01-01').
 */
export function getOfficialReportCreationDate(periodMonth: string): {
  isoDate: string;
  label: string;
} {
  const [yearStr, monthStr] = String(periodMonth || '2026-11').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return { isoDate: '2026-12-01', label: '1 Desember 2026' };
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthPadded = String(nextMonth).padStart(2, '0');
  const isoDate = `${nextYear}-${nextMonthPadded}-01`;

  return {
    isoDate,
    label: formatIndonesianDateLabel(isoDate),
  };
}

/**
 * Menghitung periode bulan sebelumnya ('YYYY-MM') untuk fitur Perbandingan dengan Bulan Sebelumnya.
 */
export function getPreviousPeriodMonth(periodMonth: string): string {
  const [yearStr, monthStr] = String(periodMonth || '2026-11').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return '2026-10';
  }

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

/**
 * ATURAN ANTI-DUPLIKASI (PROMPT 7):
 * Memastikan proses pembuatan laporan otomatis maupun manual TIDAK menghasilkan
 * laporan ganda untuk periode bulan yang sama.
 */
export function ensureUniqueMonthlyReportArchive<
  T extends { periodMonth: string }
>(
  existingArchives: T[],
  candidateReport: T
): {
  archives: T[];
  duplicatePrevented: boolean;
  existingReport: T;
} {
  const normalizedTarget = candidateReport.periodMonth.slice(0, 7);
  const found = existingArchives.find(
    (item) => item.periodMonth.slice(0, 7) === normalizedTarget
  );

  if (found) {
    return {
      archives: existingArchives,
      duplicatePrevented: true,
      existingReport: found,
    };
  }

  const updated = [...existingArchives, candidateReport].sort((a, b) =>
    b.periodMonth.localeCompare(a.periodMonth)
  );

  return {
    archives: updated,
    duplicatePrevented: false,
    existingReport: candidateReport,
  };
}

/**
 * Mengecek apakah sebuah aktivitas jatuh pada bulan pelaksanaan tertentu (YYYY-MM).
 */
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
 * Fungsi inti untuk menghitung 13 bagian internal dari satu periode bulan (tanpa rekursi bulan sebelumnya).
 */
function computeSingleMonthCore(params: {
  periodMonth: string;
  activities: OperationalActivityRecord[];
  projects: Array<{
    id: string;
    projectCode: string;
    title: string;
    customerId: string;
    customerName: string;
    installationAddress: string;
    status: OperationalStatus;
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
}) {
  const { periodMonth, activities, projects, technicians, products, photos } = params;
  const monthEndDay = `${periodMonth}-31`;

  // Kelompokkan seluruh aktivitas per projectId
  const allActsByProject = new Map<string, OperationalActivityRecord[]>();
  for (const act of activities) {
    const list = allActsByProject.get(act.projectId) || [];
    list.push(act);
    allActsByProject.set(act.projectId, list);
  }

  // Tentukan bulan awal (origin month) setiap proyek berdasarkan tanggal mulai proyek atau aktivitas paling awal
  const originMonthByProject = new Map<string, string>();
  for (const prj of projects) {
    if (prj.startDate && prj.startDate.length >= 7) {
      originMonthByProject.set(prj.id, prj.startDate.slice(0, 7));
    }
  }
  for (const [projId, projActs] of allActsByProject.entries()) {
    const sorted = [...projActs].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (sorted.length > 0) {
      const earliestActMonth = sorted[0].startDate.slice(0, 7);
      const currentOrigin = originMonthByProject.get(projId);
      if (!currentOrigin || earliestActMonth < currentOrigin) {
        originMonthByProject.set(projId, earliestActMonth);
      }
    }
  }

  // Filter aktivitas yang dilaksanakan pada periode bulan ini
  const periodActivities = activities.filter((act) =>
    isActivityInMonth(act, periodMonth)
  );

  // Proyek yang memiliki aktivitas pada periode bulan ini
  const involvedProjectIds = new Set<string>();
  for (const act of periodActivities) {
    involvedProjectIds.add(act.projectId);
  }

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  let newProjectsCount = 0;
  let continuingProjectsCount = 0;
  let completedProjects = 0;
  let ongoingProjects = 0;
  let delayedProjects = 0;

  // Lacak aktivitas lintas bulan yang belum dilaksanakan pada bulan ini (contoh: Pemasangan Desember saat melihat laporan November)
  const unexecutedFutureActivities: OperationalActivityRecord[] = [];
  const projectDetails: MonthlyReportProjectItem[] = [];

  for (const projId of involvedProjectIds) {
    const prjMeta = projectMap.get(projId);
    const allProjActs = (allActsByProject.get(projId) || []).sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    );
    const actsInThisMonth = allProjActs.filter((a) => isActivityInMonth(a, periodMonth));

    // Aktivitas lanjutan dari proyek ini yang dijadwalkan pada bulan setelah periodMonth (belum dilaksanakan pada bulan ini)
    const futureFollowUpActs = allProjActs.filter(
      (a) =>
        a.startDate.slice(0, 7) > periodMonth &&
        normalizeToMonitoringCondition(a.status) !== 'Dibatalkan'
    );

    // Aktivitas pada atau sebelum bulan ini yang belum selesai pada akhir bulan ini
    const actsUpToThisMonth = allProjActs.filter(
      (a) =>
        a.startDate <= monthEndDay &&
        normalizeToMonitoringCondition(a.status) !== 'Dibatalkan'
    );

    for (const fut of futureFollowUpActs) {
      unexecutedFutureActivities.push(fut);
    }

    const originMonth =
      originMonthByProject.get(projId) ||
      actsInThisMonth[0]?.projectStartDate?.slice(0, 7) ||
      periodMonth;

    const isNewProjectInPeriod = originMonth === periodMonth;
    const isContinuingFromPreviousMonth = originMonth < periodMonth;

    if (isNewProjectInPeriod) {
      newProjectsCount += 1;
    } else {
      continuingProjectsCount += 1;
    }

    // Evaluasi status proyek pada periode bulan ini:
    // - Apabila masih ada futureFollowUpActs (contoh: Pemasangan pada Desember), maka pada bulan November
    //   proyek ini BELUM selesai penuh -> dihitung sebagai Proyek Berjalan!
    // - Apabila seluruh aktivitas proyek (hingga akhir bulan ini & tidak ada aktivitas masa depan yang belum terlaksana)
    //   berstatus 'Selesai', barulah dihitung sebagai Proyek Selesai.
    const allActiveProjActs = allProjActs.filter(
      (a) => normalizeToMonitoringCondition(a.status) !== 'Dibatalkan'
    );

    const hasFutureUnexecuted = futureFollowUpActs.length > 0;
    const allUpToMonthCompleted =
      actsUpToThisMonth.length > 0 &&
      actsUpToThisMonth.every(
        (a) => normalizeToMonitoringCondition(a.status) === 'Selesai'
      );

    // Khusus apabila semua aktivitas proyek s/d bulan ini sudah selesai dan tidak ada aktivitas lanjutan di bulan depan
    const isProjectCompletedInPeriod =
      allActiveProjActs.length > 0 && !hasFutureUnexecuted && allUpToMonthCompleted;

    let statusInPeriod: 'Selesai' | 'Berjalan' | 'Tertunda' = 'Berjalan';

    if (isProjectCompletedInPeriod) {
      statusInPeriod = 'Selesai';
      completedProjects += 1;
    } else {
      // Cek apakah aktivitas pada bulan ini ada yang selesai atau sedang berjalan
      const hasCompletedOrOngoingInMonth = actsInThisMonth.some((a) => {
        const c = normalizeToMonitoringCondition(a.status);
        return c === 'Selesai' || c === 'Sedang berjalan';
      });
      const allDelayedOrNotStartedInMonth = actsInThisMonth.every((a) => {
        const c = normalizeToMonitoringCondition(a.status);
        return c === 'Tertunda' || c === 'Belum dimulai';
      });

      if (hasCompletedOrOngoingInMonth || isContinuingFromPreviousMonth) {
        statusInPeriod = 'Berjalan';
        ongoingProjects += 1;
      } else if (allDelayedOrNotStartedInMonth) {
        statusInPeriod = 'Tertunda';
        delayedProjects += 1;
      } else {
        statusInPeriod = 'Berjalan';
        ongoingProjects += 1;
      }
    }

    const firstAct = allProjActs[0];
    projectDetails.push({
      projectId: projId,
      projectCode: prjMeta?.projectCode || firstAct?.projectCode || '-',
      projectTitle: prjMeta?.title || firstAct?.projectTitle || 'Proyek ZIPBLIND',
      customerName: prjMeta?.customerName || firstAct?.customerName || '-',
      installationAddress:
        prjMeta?.installationAddress || firstAct?.installationAddress || '-',
      projectOriginMonth: originMonth,
      isNewProjectInPeriod,
      isContinuingFromPreviousMonth,
      statusInPeriod,
      activitiesInPeriod: actsInThisMonth.map((a) => ({
        id: a.id,
        activityCode: a.activityCode,
        activityType: a.activityType,
        title: a.title,
        startDate: a.startDate,
        endDate: a.endDate,
        condition: normalizeToMonitoringCondition(a.status),
        productName: a.productName,
        quantitySets: a.quantitySets,
        techniciansText: formatAssignedTechniciansColumn(a.technicians),
      })),
      unexecutedFollowUpActivities: futureFollowUpActs.map((f) => ({
        id: f.id,
        activityCode: f.activityCode,
        activityType: f.activityType,
        title: f.title,
        scheduledDate: f.startDate,
        productName: f.productName,
        quantitySets: f.quantitySets,
        statusLabel: `Belum Dilaksanakan (Terjadwal ${formatIndonesianDateLabel(
          f.startDate
        )})`,
      })),
    });
  }

  // Helper membuat rincian per jenis aktivitas
  const buildBreakdownForType = (
    targetType: MonthlyReportActivityBreakdown['activityType']
  ): MonthlyReportActivityBreakdown => {
    const matchingInMonth = periodActivities.filter(
      (a) => a.activityType.toLowerCase() === targetType.toLowerCase()
    );
    const matchingFuture = unexecutedFutureActivities.filter(
      (a) => a.activityType.toLowerCase() === targetType.toLowerCase()
    );

    let completedCount = 0;
    let ongoingCount = 0;
    let delayedOrNotStartedCount = 0;
    let totalSetsInPeriod = 0;
    let completedSetsInPeriod = 0;

    for (const act of matchingInMonth) {
      const cond = normalizeToMonitoringCondition(act.status);
      const sets = Number(act.quantitySets || 0);
      if (cond !== 'Dibatalkan') {
        totalSetsInPeriod += sets;
      }
      if (cond === 'Selesai') {
        completedCount += 1;
        completedSetsInPeriod += sets;
      } else if (cond === 'Sedang berjalan') {
        ongoingCount += 1;
      } else if (cond === 'Tertunda' || cond === 'Belum dimulai') {
        delayedOrNotStartedCount += 1;
      }
    }

    const unexecutedFutureCrossMonthSets = matchingFuture.reduce(
      (sum, item) => sum + Number(item.quantitySets || 0),
      0
    );

    return {
      activityType: targetType,
      executedInPeriodCount: matchingInMonth.length,
      completedCount,
      ongoingCount,
      delayedOrNotStartedCount,
      unexecutedFutureCrossMonthCount: matchingFuture.length,
      totalSetsInPeriod,
      completedSetsInPeriod,
      unexecutedFutureCrossMonthSets,
    };
  };

  const measurementActivity = buildBreakdownForType('Pengukuran');
  const installationActivity = buildBreakdownForType('Pemasangan');
  const surveyActivity = buildBreakdownForType('Survey');
  const serviceActivity = buildBreakdownForType('Service');
  const repairActivity = buildBreakdownForType('Perbaikan');
  const otherActivities: MonthlyReportActivityBreakdown[] = [
    buildBreakdownForType('Persiapan'),
    buildBreakdownForType('Pengiriman'),
  ].filter((x) => x.executedInPeriodCount > 0 || x.unexecutedFutureCrossMonthCount > 0);

  let totalSets = 0;
  let completedSets = 0;
  let completedActivitiesInPeriod = 0;

  for (const act of periodActivities) {
    const cond = normalizeToMonitoringCondition(act.status);
    const sets = Number(act.quantitySets || 0);
    if (cond !== 'Dibatalkan') {
      totalSets += sets;
    }
    if (cond === 'Selesai') {
      completedActivitiesInPeriod += 1;
      completedSets += sets;
    }
  }

  const unexecutedCrossMonthSets = unexecutedFutureActivities.reduce(
    (sum, a) => sum + Number(a.quantitySets || 0),
    0
  );

  // 11. Rekap Berdasarkan Produk
  const prodMap = new Map<
    string,
    {
      productName: string;
      projectIds: Set<string>;
      activitiesCount: number;
      completedActivitiesCount: number;
      incompleteActivitiesCount: number;
      totalSets: number;
      completedSets: number;
    }
  >();

  for (const p of products) {
    prodMap.set(p.name, {
      productName: p.name,
      projectIds: new Set<string>(),
      activitiesCount: 0,
      completedActivitiesCount: 0,
      incompleteActivitiesCount: 0,
      totalSets: 0,
      completedSets: 0,
    });
  }

  for (const act of periodActivities) {
    const pName = act.productName || 'Zipblind';
    const entry = prodMap.get(pName) || {
      productName: pName,
      projectIds: new Set<string>(),
      activitiesCount: 0,
      completedActivitiesCount: 0,
      incompleteActivitiesCount: 0,
      totalSets: 0,
      completedSets: 0,
    };
    const cond = normalizeToMonitoringCondition(act.status);
    const sets = Number(act.quantitySets || 0);

    entry.projectIds.add(act.projectId);
    entry.activitiesCount += 1;
    if (cond !== 'Dibatalkan') {
      entry.totalSets += sets;
    }
    if (cond === 'Selesai') {
      entry.completedActivitiesCount += 1;
      entry.completedSets += sets;
    } else if (cond !== 'Dibatalkan') {
      entry.incompleteActivitiesCount += 1;
    }

    prodMap.set(pName, entry);
  }

  const productRecap: MonthlyReportProductItem[] = Array.from(prodMap.values()).map(
    (item) => ({
      productName: item.productName,
      projectsCount: item.projectIds.size,
      activitiesCount: item.activitiesCount,
      completedActivitiesCount: item.completedActivitiesCount,
      incompleteActivitiesCount: item.incompleteActivitiesCount,
      totalSets: item.totalSets,
      completedSets: item.completedSets,
    })
  );

  // 12. Produktivitas Teknisi
  const techMap = new Map<
    string,
    {
      technicianId: string;
      technicianCode: string;
      fullName: string;
      specialization: string;
      avatarUrl: string;
      projectIds: Set<string>;
      totalActivities: number;
      completedActivities: number;
      ongoingActivities: number;
      pendingActivities: number;
      totalSetsHandled: number;
      completedSetsHandled: number;
    }
  >();

  for (const t of technicians) {
    techMap.set(t.id, {
      technicianId: t.id,
      technicianCode: t.technicianCode,
      fullName: t.fullName,
      specialization: t.specialization || 'Teknisi Instalasi & Pengukuran',
      avatarUrl: t.avatarUrl || '/images/ref_exec_tech1.png',
      projectIds: new Set<string>(),
      totalActivities: 0,
      completedActivities: 0,
      ongoingActivities: 0,
      pendingActivities: 0,
      totalSetsHandled: 0,
      completedSetsHandled: 0,
    });
  }

  for (const act of periodActivities) {
    const cond = normalizeToMonitoringCondition(act.status);
    const sets = Number(act.quantitySets || 0);
    for (const assigned of act.technicians) {
      const entry = techMap.get(assigned.id) || {
        technicianId: assigned.id,
        technicianCode: assigned.technicianCode,
        fullName: assigned.fullName,
        specialization: assigned.specialization || 'Teknisi Instalasi & Pengukuran',
        avatarUrl: assigned.avatarUrl || '/images/ref_exec_tech1.png',
        projectIds: new Set<string>(),
        totalActivities: 0,
        completedActivities: 0,
        ongoingActivities: 0,
        pendingActivities: 0,
        totalSetsHandled: 0,
        completedSetsHandled: 0,
      };

      entry.projectIds.add(act.projectId);
      entry.totalActivities += 1;
      if (cond !== 'Dibatalkan') {
        entry.totalSetsHandled += sets;
      }
      if (cond === 'Selesai') {
        entry.completedActivities += 1;
        entry.completedSetsHandled += sets;
      } else if (cond === 'Sedang berjalan') {
        entry.ongoingActivities += 1;
      } else if (cond === 'Tertunda' || cond === 'Belum dimulai') {
        entry.pendingActivities += 1;
      }

      techMap.set(assigned.id, entry);
    }
  }

  const technicianProductivity: MonthlyReportTechnicianItem[] = Array.from(
    techMap.values()
  ).map((t) => ({
    technicianId: t.technicianId,
    technicianCode: t.technicianCode,
    fullName: t.fullName,
    specialization: t.specialization,
    avatarUrl: t.avatarUrl,
    projectsCount: t.projectIds.size,
    totalActivities: t.totalActivities,
    completedActivities: t.completedActivities,
    ongoingActivities: t.ongoingActivities,
    pendingActivities: t.pendingActivities,
    totalSetsHandled: t.totalSetsHandled,
    completedSetsHandled: t.completedSetsHandled,
  }));

  // 13. Dokumentasi Foto jika tersedia pada periode atau proyek periode ini
  const periodActIds = new Set(periodActivities.map((a) => a.id));
  const matchingPhotos = photos.filter((ph) => {
    if (ph.activityId && periodActIds.has(ph.activityId)) return true;
    if (ph.activityDate && ph.activityDate.slice(0, 7) === periodMonth) return true;
    const uploadedMonth = (ph.uploadedAt || '').slice(0, 7);
    if (uploadedMonth === periodMonth && involvedProjectIds.has(ph.projectId)) return true;
    // Jika tidak ada activityId spesifik namun milik proyek pada periode ini
    if (!ph.activityId && involvedProjectIds.has(ph.projectId)) return true;
    return false;
  });

  const photoDocumentation: MonthlyReportPhotoItem[] = matchingPhotos.map((ph) => ({
    id: ph.id,
    projectId: ph.projectId,
    projectCode: ph.projectCode,
    projectTitle: ph.projectTitle,
    activityType: ph.activityType,
    documentationCategory: ph.documentationCategory,
    caption: ph.caption,
    uploadedAt: ph.uploadedAt,
    imageUrl: ph.imageUrl,
  }));

  return {
    totalProjects: involvedProjectIds.size,
    newProjectsCount,
    continuingProjectsCount,
    completedProjects,
    ongoingProjects,
    delayedProjects,
    measurementActivity,
    installationActivity,
    surveyActivity,
    serviceActivity,
    repairActivity,
    otherActivities,
    totalActivitiesInPeriod: periodActivities.length,
    completedActivitiesInPeriod,
    totalSets,
    completedSets,
    unexecutedCrossMonthSets,
    productRecap,
    technicianProductivity,
    photoDocumentation,
    projectDetails,
  };
}

/**
 * Membangun Laporan Bulanan Resmi lengkap (14 bagian wajib PROMPT 7) beserta
 * perbandingan otomatis dengan bulan sebelumnya.
 */
export function buildOfficialMonthlyReport(params: {
  periodMonth: string; // YYYY-MM
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
  photos?: Array<{
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
}): OfficialMonthlyReportData {
  const {
    periodMonth,
    activities,
    projects = [],
    technicians = [],
    products = [],
    photos = [],
  } = params;

  const currentCore = computeSingleMonthCore({
    periodMonth,
    activities,
    projects,
    technicians,
    products,
    photos,
  });

  const prevPeriodMonth = getPreviousPeriodMonth(periodMonth);
  const prevCore = computeSingleMonthCore({
    periodMonth: prevPeriodMonth,
    activities,
    projects,
    technicians,
    products,
    photos,
  });

  const periodLabel = formatIndonesianPeriodMonth(periodMonth);
  const prevPeriodLabel = formatIndonesianPeriodMonth(prevPeriodMonth);
  const creationSchedule = getOfficialReportCreationDate(periodMonth);

  const deltaTotalProjects = currentCore.totalProjects - prevCore.totalProjects;
  const deltaCompletedProjects =
    currentCore.completedProjects - prevCore.completedProjects;
  const deltaTotalActivities =
    currentCore.totalActivitiesInPeriod - prevCore.totalActivitiesInPeriod;
  const deltaTotalSets = currentCore.totalSets - prevCore.totalSets;

  const formatDelta = (n: number, unit: string) =>
    n > 0 ? `+${n} ${unit}` : n < 0 ? `${n} ${unit}` : `0 ${unit} (Tetap)`;

  const summaryNarrative =
    prevCore.totalActivitiesInPeriod === 0
      ? `Periode ${periodLabel} mencatat ${currentCore.totalProjects} proyek (${currentCore.newProjectsCount} proyek baru, ${currentCore.continuingProjectsCount} proyek lanjutan) dengan ${currentCore.totalActivitiesInPeriod} aktivitas (${currentCore.totalSets} Set) dibandingkan ${prevPeriodLabel} (0 aktivitas).`
      : `Dibandingkan ${prevPeriodLabel}, periode ${periodLabel} mengalami perubahan ${formatDelta(
          deltaTotalProjects,
          'Proyek'
        )}, ${formatDelta(deltaTotalActivities, 'Aktivitas')}, dan ${formatDelta(
          deltaTotalSets,
          'Set'
        )} (${currentCore.newProjectsCount} proyek baru & ${
          currentCore.continuingProjectsCount
        } proyek lanjutan lintas bulan).`;

  const previousMonthComparison: PreviousMonthComparisonData = {
    previousPeriodMonth: prevPeriodMonth,
    previousPeriodLabel: prevPeriodLabel,
    previousTotalProjects: prevCore.totalProjects,
    previousNewProjects: prevCore.newProjectsCount,
    previousCompletedProjects: prevCore.completedProjects,
    previousOngoingProjects: prevCore.ongoingProjects,
    previousDelayedProjects: prevCore.delayedProjects,
    previousTotalActivities: prevCore.totalActivitiesInPeriod,
    previousCompletedActivities: prevCore.completedActivitiesInPeriod,
    previousTotalSets: prevCore.totalSets,
    previousCompletedSets: prevCore.completedSets,
    deltaTotalProjects,
    deltaCompletedProjects,
    deltaTotalActivities,
    deltaTotalSets,
    summaryNarrative,
  };

  return {
    periodMonth,
    periodLabel,
    officialGeneratedDate: creationSchedule.isoDate,
    officialGeneratedDateLabel: creationSchedule.label,
    reportDocumentNumber: `RPT-ZB-${periodMonth.replace('-', '')}-01`,
    totalProjects: currentCore.totalProjects,
    newProjectsCount: currentCore.newProjectsCount,
    continuingProjectsCount: currentCore.continuingProjectsCount,
    completedProjects: currentCore.completedProjects,
    ongoingProjects: currentCore.ongoingProjects,
    delayedProjects: currentCore.delayedProjects,
    measurementActivity: currentCore.measurementActivity,
    installationActivity: currentCore.installationActivity,
    surveyActivity: currentCore.surveyActivity,
    serviceActivity: currentCore.serviceActivity,
    repairActivity: currentCore.repairActivity,
    otherActivities: currentCore.otherActivities,
    totalActivitiesInPeriod: currentCore.totalActivitiesInPeriod,
    completedActivitiesInPeriod: currentCore.completedActivitiesInPeriod,
    totalSets: currentCore.totalSets,
    completedSets: currentCore.completedSets,
    unexecutedCrossMonthSets: currentCore.unexecutedCrossMonthSets,
    productRecap: currentCore.productRecap,
    technicianProductivity: currentCore.technicianProductivity,
    photoDocumentation: currentCore.photoDocumentation,
    previousMonthComparison,
    projectDetails: currentCore.projectDetails,
  };
}

/**
 * Menghasilkan file PDF biner yang valid (%PDF-1.4) dan siap cetak untuk Laporan Bulanan ZIPBLIND.
 */
export function generateMonthlyReportPdfBuffer(
  report: OfficialMonthlyReportData
): Buffer {
  const escapePdfText = (input: string) =>
    input
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, ' ');

  const lines: Array<{ text: string; bold?: boolean; size?: number }> = [
    {
      text: `LAPORAN OPERASIONAL BULANAN RESMI - PT ZIPBLIND INDONESIA`,
      bold: true,
      size: 13,
    },
    {
      text: `Nomor Dokumen: ${report.reportDocumentNumber} | Periode Laporan: ${report.periodLabel}`,
      bold: true,
      size: 10,
    },
    {
      text: `Waktu Pembuatan Otomatis Resmi: ${report.officialGeneratedDateLabel} (${report.officialGeneratedDate})`,
      size: 9,
    },
    { text: `----------------------------------------------------------------------------------------`, size: 9 },
    { text: `A. RINGKASAN PROYEK & STATUS PENYELESAIAN (POIN 1 - 4 & PEKERJAAN LINTAS BULAN)`, bold: true, size: 10 },
    {
      text: `1. Total Proyek Aktif Periode Ini : ${report.totalProjects} Proyek (${report.newProjectsCount} Proyek Baru, ${report.continuingProjectsCount} Proyek Lanjutan Lintas Bulan)`,
      size: 9,
    },
    {
      text: `2. Proyek Selesai Penuh           : ${report.completedProjects} Proyek`,
      size: 9,
    },
    {
      text: `3. Proyek Berjalan                : ${report.ongoingProjects} Proyek`,
      size: 9,
    },
    {
      text: `4. Proyek Tertunda                : ${report.delayedProjects} Proyek`,
      size: 9,
    },
    { text: `----------------------------------------------------------------------------------------`, size: 9 },
    { text: `B. RINCIAN AKTIVITAS PEKERJAAN & JUMLAH SET (POIN 5 - 10)`, bold: true, size: 10 },
    {
      text: `5. Aktivitas Pengukuran : ${report.measurementActivity.executedInPeriodCount} Aktivitas (${report.measurementActivity.completedCount} Selesai, ${report.measurementActivity.ongoingCount} Berjalan, ${report.measurementActivity.delayedOrNotStartedCount} Tertunda) - ${report.measurementActivity.totalSetsInPeriod} Set`,
      size: 9,
    },
    {
      text: `6. Aktivitas Pemasangan : ${report.installationActivity.executedInPeriodCount} Dilaksanakan (${report.installationActivity.completedCount} Selesai, ${report.installationActivity.ongoingCount} Berjalan, ${report.installationActivity.delayedOrNotStartedCount} Belum Mulai) | Belum Dilaksanakan (Jadwal Bulan Depan): ${report.installationActivity.unexecutedFutureCrossMonthCount} Aktivitas (${report.installationActivity.unexecutedFutureCrossMonthSets} Set)`,
      size: 9,
    },
    {
      text: `7. Aktivitas Survey     : ${report.surveyActivity.executedInPeriodCount} Aktivitas (${report.surveyActivity.completedCount} Selesai, ${report.surveyActivity.delayedOrNotStartedCount} Tertunda) - ${report.surveyActivity.totalSetsInPeriod} Set`,
      size: 9,
    },
    {
      text: `8. Aktivitas Service    : ${report.serviceActivity.executedInPeriodCount} Aktivitas (${report.serviceActivity.completedCount} Selesai) - ${report.serviceActivity.totalSetsInPeriod} Set`,
      size: 9,
    },
    {
      text: `9. Aktivitas Perbaikan  : ${report.repairActivity.executedInPeriodCount} Aktivitas (${report.repairActivity.completedCount} Selesai) - ${report.repairActivity.totalSetsInPeriod} Set`,
      size: 9,
    },
    {
      text: `10. Total Jumlah Set    : ${report.totalSets} Set (${report.completedSets} Set Selesai pada ${report.periodLabel})`,
      bold: true,
      size: 9,
    },
    { text: `----------------------------------------------------------------------------------------`, size: 9 },
    { text: `C. REKAPITULASI BERDASARKAN PRODUK (POIN 11)`, bold: true, size: 10 },
    ...report.productRecap.map((prod) => ({
      text: `- ${prod.productName.padEnd(16, ' ')}: ${prod.projectsCount} Proyek | ${prod.activitiesCount} Aktivitas (${prod.completedActivitiesCount} Selesai) | ${prod.totalSets} Set (${prod.completedSets} Set Selesai)`,
      size: 9,
    })),
    { text: `----------------------------------------------------------------------------------------`, size: 9 },
    { text: `D. PRODUKTIVITAS TEKNISI (POIN 12)`, bold: true, size: 10 },
    ...report.technicianProductivity.map((tech) => ({
      text: `- ${tech.fullName} (${tech.technicianCode}): ${tech.projectsCount} Proyek | ${tech.totalActivities} Aktivitas (${tech.completedActivities} Selesai, ${tech.ongoingActivities} Berjalan, ${tech.pendingActivities} Tertunda) | ${tech.totalSetsHandled} Set`,
      size: 9,
    })),
    { text: `----------------------------------------------------------------------------------------`, size: 9 },
    {
      text: `E. DOKUMENTASI FOTO PROYEK (POIN 13) - Total ${report.photoDocumentation.length} Foto Tersedia`,
      bold: true,
      size: 10,
    },
    ...(report.photoDocumentation.length === 0
      ? [{ text: `- Tidak ada dokumentasi foto pada periode ini.`, size: 9 }]
      : report.photoDocumentation.slice(0, 6).map((ph) => ({
          text: `- [${ph.projectCode}] ${ph.documentationCategory} (${ph.activityType}): ${ph.caption}`,
          size: 8.5,
        }))),
    { text: `----------------------------------------------------------------------------------------`, size: 9 },
    {
      text: `F. PERBANDINGAN DENGAN BULAN SEBELUMNYA - ${report.previousMonthComparison.previousPeriodLabel.toUpperCase()} (POIN 14)`,
      bold: true,
      size: 10,
    },
    {
      text: `- Total Proyek    : ${report.previousMonthComparison.previousTotalProjects} -> ${report.totalProjects} (Selisih: ${report.previousMonthComparison.deltaTotalProjects >= 0 ? '+' : ''}${report.previousMonthComparison.deltaTotalProjects})`,
      size: 9,
    },
    {
      text: `- Proyek Selesai  : ${report.previousMonthComparison.previousCompletedProjects} -> ${report.completedProjects} (Selisih: ${report.previousMonthComparison.deltaCompletedProjects >= 0 ? '+' : ''}${report.previousMonthComparison.deltaCompletedProjects})`,
      size: 9,
    },
    {
      text: `- Total Aktivitas : ${report.previousMonthComparison.previousTotalActivities} -> ${report.totalActivitiesInPeriod} (Selisih: ${report.previousMonthComparison.deltaTotalActivities >= 0 ? '+' : ''}${report.previousMonthComparison.deltaTotalActivities})`,
      size: 9,
    },
    {
      text: `- Total Jumlah Set: ${report.previousMonthComparison.previousTotalSets} Set -> ${report.totalSets} Set (Selisih: ${report.previousMonthComparison.deltaTotalSets >= 0 ? '+' : ''}${report.previousMonthComparison.deltaTotalSets} Set)`,
      size: 9,
    },
    { text: `----------------------------------------------------------------------------------------`, size: 9 },
    { text: `G. RINCIAN PROYEK & STATUS PEKERJAAN LINTAS BULAN`, bold: true, size: 10 },
    ...report.projectDetails.flatMap((prj) => [
      {
        text: `* [${prj.projectCode}] ${prj.projectTitle} (${prj.customerName}) - Status Periode: ${prj.statusInPeriod} | ${prj.isNewProjectInPeriod ? 'Proyek Baru' : 'Proyek Lanjutan (Bukan Proyek Baru)'}`,
        bold: true,
        size: 8.5,
      },
      ...prj.activitiesInPeriod.map((a) => ({
        text: `   Pelaksanaan Bulan Ini : ${a.startDate} - ${a.activityType} (${a.productName}, ${a.quantitySets} Set) -> Status: ${a.condition}`,
        size: 8.5,
      })),
      ...prj.unexecutedFollowUpActivities.map((f) => ({
        text: `   Belum Dilaksanakan    : ${f.activityType} (${f.productName}, ${f.quantitySets} Set) -> ${f.statusLabel}`,
        size: 8.5,
      })),
    ]),
  ];

  // Bangun stream konten PDF
  let y = 805;
  const contentOps: string[] = ['BT'];
  for (const line of lines) {
    if (y < 40) break;
    const fontKey = line.bold ? '/F2' : '/F1';
    const fontSize = line.size || 9;
    contentOps.push(`${fontKey} ${fontSize} Tf`);
    contentOps.push(`1 0 0 1 36 ${y} Tm`);
    contentOps.push(`(${escapePdfText(line.text)}) Tj`);
    y -= fontSize + 5;
  }
  contentOps.push('ET');
  const streamContent = contentOps.join('\n');
  const streamByteLength = Buffer.byteLength(streamContent, 'utf-8');

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
    `6 0 obj\n<< /Length ${streamByteLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdfBody = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdfBody, 'utf-8'));
    pdfBody += obj;
  }

  const xrefOffset = Buffer.byteLength(pdfBody, 'utf-8');
  pdfBody += `xref\n0 ${objects.length + 1}\n`;
  pdfBody += `0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdfBody += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfBody += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfBody, 'utf-8');
}

/**
 * Menghasilkan file Excel SpreadsheetML (.xls) terformat profesional dan siap cetak
 * yang memuat seluruh 14 bagian Laporan Bulanan ZIPBLIND.
 */
export function generateMonthlyReportExcelBuffer(
  report: OfficialMonthlyReportData
): Buffer {
  const esc = (val: string | number | null | undefined) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const htmlWorkbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Plus Jakarta Sans" ss:Size="10" ss:Color="#102B50"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Plus Jakarta Sans" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#102B50" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SectionHeader">
   <Font ss:FontName="Plus Jakarta Sans" ss:Size="11" ss:Bold="1" ss:Color="#102B50"/>
   <Interior ss:Color="#E6F0FA" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Plus Jakarta Sans" ss:Size="10" ss:Bold="1" ss:Color="#102B50"/>
   <Interior ss:Color="#F5F9FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell">
   <Font ss:FontName="Plus Jakarta Sans" ss:Size="10" ss:Color="#102B50"/>
  </Style>
  <Style ss:ID="BoldCell">
   <Font ss:FontName="Plus Jakarta Sans" ss:Size="10" ss:Bold="1" ss:Color="#102B50"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${esc(report.periodLabel)}">
  <Table>
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">LAPORAN OPERASIONAL BULANAN RESMI ZIPBLIND - ${esc(report.periodLabel.toUpperCase())}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">Nomor Dokumen</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${esc(report.reportDocumentNumber)}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">Waktu Pembuatan Otomatis Resmi</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${esc(report.officialGeneratedDateLabel)} (${esc(report.officialGeneratedDate)})</Data></Cell>
   </Row>
   <Row/>
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">1 - 4. RINGKASAN PROYEK PERIODE ${esc(report.periodLabel.toUpperCase())}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Indikator Proyek</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Jumlah</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Keterangan Aturan Lintas Bulan</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">1. Total Proyek</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.totalProjects}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${report.newProjectsCount} Proyek Baru, ${report.continuingProjectsCount} Proyek Lanjutan (Tidak dihitung sebagai proyek baru)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">2. Proyek Selesai</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.completedProjects}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">Seluruh tahapan aktivitas proyek telah tuntas</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">3. Proyek Berjalan</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.ongoingProjects}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">Sedang berjalan atau masih memiliki aktivitas lanjutan lintas bulan</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">4. Proyek Tertunda</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.delayedProjects}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">Menunggu kesiapan lokasi atau penjadwalan ulang</Data></Cell>
   </Row>
   <Row/>
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">5 - 10. RINCIAN AKTIVITAS PEKERJAAN &amp; TOTAL JUMLAH SET</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Jenis Aktivitas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Dilaksanakan Bulan Ini</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Selesai</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Berjalan</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tertunda / Belum Mulai</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Belum Dilaksanakan (Jadwal Lintas Bulan)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Jumlah Set Periode Ini</Data></Cell>
   </Row>
   ${[
     { label: '5. Aktivitas Pengukuran', data: report.measurementActivity },
     { label: '6. Aktivitas Pemasangan', data: report.installationActivity },
     { label: '7. Aktivitas Survey', data: report.surveyActivity },
     { label: '8. Aktivitas Service', data: report.serviceActivity },
     { label: '9. Aktivitas Perbaikan', data: report.repairActivity },
     ...report.otherActivities.map((o) => ({
       label: `Aktivitas ${o.activityType}`,
       data: o,
     })),
   ]
     .map(
       (row) => `<Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">${esc(row.label)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${row.data.executedInPeriodCount}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${row.data.completedCount}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${row.data.ongoingCount}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${row.data.delayedOrNotStartedCount}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${row.data.unexecutedFutureCrossMonthCount}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${row.data.totalSetsInPeriod}</Data></Cell>
   </Row>`
     )
     .join('\n   ')}
   <Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">10. Total Jumlah Set Periode ${esc(report.periodLabel)}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.totalActivitiesInPeriod}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.completedActivitiesInPeriod}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.unexecutedCrossMonthSets}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.totalSets}</Data></Cell>
   </Row>
   <Row/>
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">11. REKAP BERDASARKAN PRODUK</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nama Produk</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Proyek Terkait</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Total Aktivitas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Aktivitas Selesai</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Total Jumlah Set</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Set Selesai</Data></Cell>
   </Row>
   ${report.productRecap
     .map(
       (prod) => `<Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">${esc(prod.productName)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${prod.projectsCount}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${prod.activitiesCount}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${prod.completedActivitiesCount}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${prod.totalSets}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${prod.completedSets}</Data></Cell>
   </Row>`
     )
     .join('\n   ')}
   <Row/>
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">12. PRODUKTIVITAS TEKNISI</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nama Teknisi</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Kode Teknisi</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Proyek Terlibat</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Total Aktivitas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Pekerjaan Selesai</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Pekerjaan Berjalan</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Pekerjaan Tertunda</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Jumlah Set Dikerjakan</Data></Cell>
   </Row>
   ${report.technicianProductivity
     .map(
       (tech) => `<Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">${esc(tech.fullName)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${esc(tech.technicianCode)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${tech.projectsCount}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${tech.totalActivities}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${tech.completedActivities}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${tech.ongoingActivities}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${tech.pendingActivities}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${tech.totalSetsHandled}</Data></Cell>
   </Row>`
     )
     .join('\n   ')}
   <Row/>
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">13. DOKUMENTASI FOTO PROYEK (${report.photoDocumentation.length} FOTO)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Kode Proyek</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nama Proyek</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Kategori Dokumentasi</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tahap Aktivitas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Keterangan Foto</Data></Cell>
   </Row>
   ${report.photoDocumentation
     .map(
       (ph) => `<Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">${esc(ph.projectCode)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${esc(ph.projectTitle)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${esc(ph.documentationCategory)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${esc(ph.activityType)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${esc(ph.caption)}</Data></Cell>
   </Row>`
     )
     .join('\n   ')}
   <Row/>
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">14. PERBANDINGAN DENGAN BULAN SEBELUMNYA (${esc(report.previousMonthComparison.previousPeriodLabel.toUpperCase())})</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Metrik</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">${esc(report.previousMonthComparison.previousPeriodLabel)}</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">${esc(report.periodLabel)}</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Selisih Perubahan</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">Total Proyek</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.previousMonthComparison.previousTotalProjects}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.totalProjects}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.previousMonthComparison.deltaTotalProjects}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">Proyek Selesai</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.previousMonthComparison.previousCompletedProjects}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.completedProjects}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.previousMonthComparison.deltaCompletedProjects}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">Total Aktivitas</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.previousMonthComparison.previousTotalActivities}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.totalActivitiesInPeriod}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.previousMonthComparison.deltaTotalActivities}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">Total Jumlah Set</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.previousMonthComparison.previousTotalSets}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="Number">${report.totalSets}</Data></Cell>
    <Cell ss:StyleID="BoldCell"><Data ss:Type="Number">${report.previousMonthComparison.deltaTotalSets}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(htmlWorkbook, 'utf-8');
}
