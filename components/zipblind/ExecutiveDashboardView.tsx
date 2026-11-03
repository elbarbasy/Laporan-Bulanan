'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  RefreshCw,
  ShieldCheck,
  Download,
  TrendingUp,
  Package,
  Folder,
  Check,
  RotateCw,
  AlertCircle,
  Users,
  Briefcase,
  Camera,
  FileText,
  FileSpreadsheet,
  Inbox,
  Layers,
  Eye,
  X,
  ArrowUpRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import AnimatedKpiNumber from './AnimatedKpiNumber';
import ResilientImage from './ResilientAvatar';
import {
  ExecutivePerformanceLineChart,
  ExecutiveProductDonutChart,
} from './ZipblindCharts';
import type { UIPreviewStateMode } from '@/lib/zipblind-ui-data';
import type { ExecutiveDashboardPayload } from '@/lib/zipblind-executive';
import type {
  MonthlyReportPhotoItem,
  OfficialMonthlyReportData,
} from '@/lib/zipblind-monthly-report';

interface ExecutiveDashboardViewProps {
  previewMode: UIPreviewStateMode;
  isStandaloneMode?: boolean;
  onExitStandalone?: () => void;
  canDownloadReports?: boolean;
  onReportDownloadAction?: (label: string) => void;
  secretToken?: string;
}

function ExecMiniSparkline({
  color,
  gradientId,
  pathData,
  areaData,
  endX,
  endY,
}: {
  color: string;
  gradientId: string;
  pathData: string;
  areaData: string;
  endX: number;
  endY: number;
}) {
  return (
    <svg
      viewBox="0 0 130 34"
      className="w-[115px] h-8 overflow-visible shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaData} fill={`url(#${gradientId})`} />
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx={endX} cy={endY} r="3" fill={color} />
    </svg>
  );
}

export default function ExecutiveDashboardView({
  previewMode,
  isStandaloneMode = false,
  onExitStandalone,
  canDownloadReports = true,
  onReportDownloadAction,
  secretToken = '',
}: ExecutiveDashboardViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');
  const [dashboardData, setDashboardData] = useState<ExecutiveDashboardPayload | null>(
    null
  );
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [selectedPhotoLightbox, setSelectedPhotoLightbox] =
    useState<MonthlyReportPhotoItem | null>(null);
  const [inspectingReportPeriod, setInspectingReportPeriod] = useState<string | null>(
    null
  );

  const loadExecutiveDashboard = useCallback(
    async (periodToLoad: string) => {
      setLoadingData(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({ period: periodToLoad });
        if (secretToken.trim()) {
          params.set('token', secretToken.trim());
        }
        const res = await fetch(`/api/executive/dashboard?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: secretToken.trim()
            ? { 'x-executive-token': secretToken.trim() }
            : undefined,
        });
        const data = await res.json();
        if (res.ok && data.valid && data.dashboard) {
          setDashboardData(data.dashboard);
          if (data.dashboard.selectedPeriod) {
            setSelectedPeriod(data.dashboard.selectedPeriod);
          }
        } else {
          setErrorMessage(
            data.message || 'Gagal memuat data aktual Dashboard Pimpinan.'
          );
        }
      } catch {
        setErrorMessage('Tidak dapat terhubung ke server Dashboard Pimpinan.');
      } finally {
        setLoadingData(false);
      }
    },
    [secretToken]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams({ period: '2026-11' });
        if (secretToken.trim()) {
          params.set('token', secretToken.trim());
        }
        const res = await fetch(`/api/executive/dashboard?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: secretToken.trim()
            ? { 'x-executive-token': secretToken.trim() }
            : undefined,
        });
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.valid && data.dashboard) {
          setDashboardData(data.dashboard);
          if (data.dashboard.selectedPeriod) {
            setSelectedPeriod(data.dashboard.selectedPeriod);
          }
        } else {
          setErrorMessage(
            data.message || 'Gagal memuat data aktual Dashboard Pimpinan.'
          );
        }
      } catch {
        if (!active) return;
        setErrorMessage('Tidak dapat terhubung ke server Dashboard Pimpinan.');
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [secretToken]);

  const handlePeriodChange = async (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    await loadExecutiveDashboard(newPeriod);
  };

  const handleDownloadExecutiveFile = async (
    periodMonth: string,
    format: 'PDF' | 'EXCEL',
    label: string
  ) => {
    if (!canDownloadReports) {
      setDownloadNotice({
        type: 'error',
        text: 'Akses ditolak: Token secret link pimpinan ini tidak memiliki izin untuk mengunduh laporan.',
      });
      return;
    }

    const key = `${periodMonth}-${format}`;
    setDownloadingKey(key);
    setDownloadNotice(null);

    try {
      const params = new URLSearchParams({
        period: periodMonth,
        format,
      });
      if (secretToken.trim()) {
        params.set('token', secretToken.trim());
      }

      const res = await fetch(`/api/executive/export?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: secretToken.trim()
          ? { 'x-executive-token': secretToken.trim() }
          : undefined,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setDownloadNotice({
          type: 'error',
          text:
            errData.message ||
            `Gagal mengunduh dokumen ${format} untuk ${label}.`,
        });
        return;
      }

      const blob = await res.blob();
      const ext = format === 'PDF' ? 'pdf' : 'xls';
      const fileName = `Laporan-Eksekutif-ZIPBLIND-${periodMonth}.${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      onReportDownloadAction?.(`${label} (${format})`);
      setDownloadNotice({
        type: 'success',
        text: `Berhasil mengunduh dokumen resmi "${fileName}" (${format}) pada mode Akses Read-Only Pimpinan.`,
      });
    } catch {
      setDownloadNotice({
        type: 'error',
        text: `Terjadi kendala saat mengunduh dokumen ${format}.`,
      });
    } finally {
      setDownloadingKey(null);
    }
  };

  const isEmpty = previewMode === 'empty';
  const isLoading = previewMode === 'loading' || (loadingData && !dashboardData);

  if (isLoading) {
    return (
      <div
        className="space-y-4 p-4 lg:p-6"
        aria-busy="true"
        aria-label="Memuat Portal Pimpinan"
      >
        <div className="h-14 rounded-2xl bg-slate-200/70 animate-pulse" />
        <div className="h-52 rounded-3xl bg-slate-200/70 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          <div className="lg:col-span-6 h-64 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="lg:col-span-3 h-64 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="lg:col-span-3 h-64 rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  if (errorMessage && !dashboardData) {
    return (
      <div className="p-6 lg:p-8 bg-[#EEF4FC]">
        <div className="bg-white rounded-2xl p-6 border border-[#FECACA] text-[#991B1B] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-[#DC2626] shrink-0" />
            <div>
              <h3 className="text-[16px] font-bold">
                Gagal Memuat Data Dashboard Pimpinan
              </h3>
              <p className="text-[14px] font-normal mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadExecutiveDashboard(selectedPeriod)}
            className="px-4 py-2 rounded-xl bg-[#991B1B] text-white text-[13.5px] font-bold cursor-pointer shrink-0"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  const periodSummary = dashboardData?.periodSummary;
  const execMetrics = isEmpty
    ? {
        performancePercent: 0,
        totalProjects: 0,
        newProjectsCount: 0,
        continuingProjectsCount: 0,
        completedProjects: 0,
        ongoingProjects: 0,
        delayedProjects: 0,
        totalSets: 0,
        completedSets: 0,
      }
    : {
        performancePercent: periodSummary?.completionRatePercent ?? 0,
        totalProjects: dashboardData?.totalProjects ?? 0,
        newProjectsCount: dashboardData?.newProjectsCount ?? 0,
        continuingProjectsCount: dashboardData?.continuingProjectsCount ?? 0,
        completedProjects: dashboardData?.completedProjects ?? 0,
        ongoingProjects: dashboardData?.ongoingProjects ?? 0,
        delayedProjects: dashboardData?.delayedProjects ?? 0,
        totalSets: periodSummary?.totalSetsInPeriod ?? 0,
        completedSets: periodSummary?.completedSetsInPeriod ?? 0,
      };

  const workTrendSeries = isEmpty ? [] : dashboardData?.workTrendSeries || [];
  const activityTypeRecap = isEmpty ? [] : dashboardData?.activityTypeRecap || [];
  const productRecap = isEmpty ? [] : dashboardData?.productRecap || [];
  const technicianProductivity = isEmpty
    ? []
    : dashboardData?.technicianProductivity || [];
  const projectHistory = isEmpty ? [] : dashboardData?.projectHistory || [];
  const projectDocumentation = isEmpty
    ? []
    : dashboardData?.projectDocumentation || [];
  const monthlyReportArchives = isEmpty
    ? []
    : dashboardData?.monthlyReportArchives || [];
  const previousComparison = dashboardData?.previousMonthComparison;
  const inspectedReport: OfficialMonthlyReportData | undefined =
    inspectingReportPeriod && dashboardData?.reportsByPeriod
      ? dashboardData.reportsByPeriod[inspectingReportPeriod]
      : undefined;

  return (
    <div
      data-testid="executive-dashboard-root"
      className="bg-[#EEF4FC] text-[#0D2346] pb-6"
    >
      {/* 1. TOPBAR PORTAL PIMPINAN (RINGKASAN PERIODE LAPORAN & INDIKATOR READ-ONLY) */}
      <header className="w-full px-4 sm:px-6 lg:px-7 xl:px-8 pt-3 pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE7F6]/80 bg-[#EEF4FC]/90 backdrop-blur-xs">
        {/* Kiri: Brand ZIPBLIND Executive Portal + Pemilih Periode Laporan Aktual */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div
            onClick={isStandaloneMode && onExitStandalone ? onExitStandalone : undefined}
            role={isStandaloneMode && onExitStandalone ? 'button' : undefined}
            tabIndex={isStandaloneMode && onExitStandalone ? 0 : undefined}
            onKeyDown={(e) => {
              if (
                isStandaloneMode &&
                onExitStandalone &&
                (e.key === 'Enter' || e.key === ' ')
              ) {
                onExitStandalone();
              }
            }}
            title={
              isStandaloneMode && onExitStandalone
                ? 'Klik untuk kembali ke Workspace Admin'
                : 'ZIPBLIND Executive Portal'
            }
            className={`flex items-center gap-2.5 ${
              isStandaloneMode && onExitStandalone ? 'cursor-pointer hover:opacity-90' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
              <ResilientImage
                src="/images/ref_exec_logo_z.png"
                alt="Logo ZIPBLIND"
                fallbackLabel="Z"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="text-[19px] font-extrabold tracking-tight text-[#0D2346] leading-none">
                ZIPBLIND
              </div>
              <div className="text-[12.5px] font-medium text-[#475E7A] leading-tight mt-0.5">
                Executive Portal
              </div>
            </div>
          </div>

          <span className="h-6 w-[1px] bg-[#CBD5E1] hidden sm:block" aria-hidden="true" />

          {/* Pemilih Periode Laporan Aktual Database */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E1ECFA] text-[13px] text-[#1E3A5F]">
            <Calendar className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
            <label htmlFor="exec-period-select" className="font-medium">
              Periode Laporan:
            </label>
            <select
              id="exec-period-select"
              data-testid="exec-period-select"
              value={selectedPeriod}
              onChange={(e) => void handlePeriodChange(e.target.value)}
              className="font-bold text-[#0D2346] bg-transparent focus:outline-none cursor-pointer"
            >
              {(dashboardData?.availablePeriods || []).map((p) => (
                <option key={p.periodMonth} value={p.periodMonth}>
                  {p.periodLabel} (Rilis {p.officialGeneratedDateLabel})
                </option>
              ))}
            </select>
          </div>

          {/* Info Dokumen Resmi & Sinkronisasi Database */}
          <div className="hidden xl:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E1ECFA] text-[13px] text-[#1E3A5F]">
            <RefreshCw className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
            <span>
              Dokumen:{' '}
              <strong className="font-bold text-[#0D2346]">
                {periodSummary?.reportDocumentNumber || 'RPT-ZB-202611-01'}
              </strong>{' '}
              • Rilis Resmi:{' '}
              <strong className="font-bold text-[#0D2346]">
                {periodSummary?.officialGeneratedDateLabel || '1 Desember 2026'}
              </strong>
            </span>
          </div>
        </div>

        {/* Kanan: Badge Akses Read-Only + Tombol Unduh Cepat PDF & Excel */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            data-testid="badge-exec-readonly"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#DCE7F6] shadow-2xs text-[13px] font-semibold text-[#0D2346]"
          >
            <span className="w-4 h-4 rounded-full bg-[#22C58B] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
            </span>
            <span>Akses Read-Only</span>
          </div>

          <button
            type="button"
            data-testid="btn-exec-top-pdf"
            disabled={downloadingKey === `${selectedPeriod}-PDF`}
            onClick={() =>
              void handleDownloadExecutiveFile(
                selectedPeriod,
                'PDF',
                `Laporan ${periodSummary?.periodLabel || selectedPeriod}`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0D2346] hover:bg-[#16376B] text-white text-[13px] font-bold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {downloadingKey === `${selectedPeriod}-PDF` ? 'PDF...' : 'Unduh PDF'}
            </span>
          </button>

          <button
            type="button"
            data-testid="btn-exec-top-excel"
            disabled={downloadingKey === `${selectedPeriod}-EXCEL`}
            onClick={() =>
              void handleDownloadExecutiveFile(
                selectedPeriod,
                'EXCEL',
                `Laporan ${periodSummary?.periodLabel || selectedPeriod}`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0D8A72] hover:bg-[#0A6E5B] text-white text-[13px] font-bold transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>
              {downloadingKey === `${selectedPeriod}-EXCEL`
                ? 'Excel...'
                : 'Unduh Excel'}
            </span>
          </button>
        </div>
      </header>

      {/* Banner Notifikasi Unduhan (Jika tombol unduh diklik) */}
      {downloadNotice && (
        <div
          data-testid="exec-download-notice"
          className="w-full px-4 sm:px-6 lg:px-7 xl:px-8 mt-3"
        >
          <div
            className={`px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-[13.5px] font-medium shadow-xs border ${
              downloadNotice.type === 'error'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                : 'bg-white border-[#2563EB]/30 text-[#0D2346]'
            }`}
          >
            <span>{downloadNotice.text}</span>
            <button
              type="button"
              onClick={() => setDownloadNotice(null)}
              className="text-[13px] font-bold text-[#2563EB] hover:underline shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 lg:px-7 xl:px-8 pt-4 space-y-4">
        {/* 2. HERO BANNER EKSEKUTIF (POIN 1: RINGKASAN PERIODE LAPORAN + MASKOT PIMPINAN 3D BERANIMASI) */}
        <section
          aria-label="Executive Overview Performa Operasional ZIPBLIND"
          className="relative rounded-[22px] bg-gradient-to-r from-[#0B224B] via-[#133F84] to-[#2373D6] text-white shadow-[0_10px_30px_rgba(11,34,75,0.14)] lg:overflow-visible overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center lg:min-h-[212px]">
            {/* Kiri: Teks Ringkasan Periode Laporan */}
            <div className="lg:col-span-6 px-6 sm:px-7 pt-5 pb-5 z-10">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2674DC] text-white text-[12.5px] font-semibold shadow-2xs">
                  <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>1. Ringkasan Periode Laporan</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-[12.5px] font-semibold">
                  <span>{periodSummary?.reportDocumentNumber || 'RPT-ZB-202611-01'}</span>
                </span>
              </div>

              <h1 className="text-[28px] sm:text-[32px] xl:text-[34px] font-bold text-white leading-[1.15] tracking-[-0.02em] mt-2">
                Performa Operasional — {periodSummary?.periodLabel || 'November 2026'}
              </h1>

              <p className="text-[14px] xl:text-[15px] font-normal text-white/90 mt-1.5 max-w-xl leading-[1.45]">
                Ringkasan eksekutif kinerja proyek, aktivitas teknisi, dan pemasangan produk
                ZIPBLIND berdasarkan data operasional aktual di database.
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-3.5 text-[13.5px] font-semibold text-white">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/85" />
                  <span>
                    Periode: {periodSummary?.periodLabel || 'November 2026'}
                  </span>
                </span>
                <span className="text-white/40" aria-hidden="true">
                  |
                </span>
                <span className="inline-flex items-center gap-2">
                  <Layers className="w-4 h-4 text-white/85" />
                  <span className="tabular-nums">
                    Total Aktivitas: {periodSummary?.totalActivitiesInPeriod ?? 0} (
                    {periodSummary?.completedActivitiesInPeriod ?? 0} Selesai)
                  </span>
                </span>
                <span className="text-white/40" aria-hidden="true">
                  |
                </span>
                <span className="inline-flex items-center gap-2">
                  <Package className="w-4 h-4 text-white/85" />
                  <span className="tabular-nums">
                    Total Jumlah Set: {execMetrics.totalSets} Set (
                    {execMetrics.completedSets} Selesai)
                  </span>
                </span>
              </div>
            </div>

            {/* Kanan: Ilustrasi Maskot Pimpinan 3D Kartun dengan Animasi Halus & Bersahabat */}
            <div className="lg:col-span-6 relative flex justify-center lg:justify-end items-end h-[242px] lg:h-[212px]">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 4.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="w-full flex justify-center lg:justify-end items-end h-full"
              >
                <ResilientImage
                  src="/images/ref_exec_mascot_seamless.png"
                  alt="Maskot Pimpinan 3D Kartun ZIPBLIND"
                  fallbackLabel="Maskot Pimpinan 3D"
                  variant="mascot"
                  className="w-full max-w-[820px] 2xl:max-w-[900px] h-[235px] lg:h-[262px] lg:-mt-[50px] object-cover object-right rounded-r-[22px] select-none pointer-events-none"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* 3. BARIS 5 KARTU KPI UTAMA PIMPINAN (POIN 2, 3, 4, 5 + TINGKAT PENYELESAIAN SET) */}
        <section aria-label="Indikator Utama Pimpinan">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* KPI 1: Tingkat Penyelesaian Set Periode Ini */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl pt-3.5 px-4 pb-2.5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1D63DC] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] xl:text-[14.5px] font-semibold text-[#0D2346] leading-snug whitespace-nowrap">
                    Capaian Set Selesai
                  </h2>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      data-testid="exec-kpi-performance"
                      className="text-[30px] xl:text-[33px] font-bold text-[#0D2346] leading-none tabular-nums"
                    >
                      <AnimatedKpiNumber value={execMetrics.performancePercent} suffix="%" />
                    </span>
                    <span className="text-[12.5px] font-bold text-[#10B981] whitespace-nowrap tabular-nums">
                      {execMetrics.completedSets}/{execMetrics.totalSets} Set
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1 flex items-end justify-between gap-1">
                <span className="text-[12px] font-normal text-[#475E7A] whitespace-nowrap pb-0.5">
                  Realisasi pemasangan
                </span>
                <ExecMiniSparkline
                  color="#2563EB"
                  gradientId="exec-spark-1"
                  pathData="M 4 28 Q 28 24, 52 25 T 92 16 T 126 8"
                  areaData="M 4 28 Q 28 24, 52 25 T 92 16 T 126 8 L 126 34 L 4 34 Z"
                  endX={126}
                  endY={8}
                />
              </div>
            </motion.div>

            {/* KPI 2 (POIN 2): Total Proyek */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl pt-3.5 px-4 pb-2.5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1D63DC] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Folder className="w-5 h-5 fill-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] xl:text-[14.5px] font-semibold text-[#0D2346] leading-snug whitespace-nowrap">
                    2. Total Proyek
                  </h2>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      data-testid="exec-kpi-total-projects"
                      className="text-[30px] xl:text-[33px] font-bold text-[#0D2346] leading-none tabular-nums"
                    >
                      <AnimatedKpiNumber value={execMetrics.totalProjects} />
                    </span>
                    <span className="text-[12px] font-bold text-[#2368B5] whitespace-nowrap">
                      {execMetrics.newProjectsCount} Baru • {execMetrics.continuingProjectsCount} Lanjutan
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1 flex items-end justify-between gap-1">
                <span className="text-[12px] font-normal text-[#475E7A] whitespace-nowrap pb-0.5">
                  Dalam periode ini
                </span>
                <ExecMiniSparkline
                  color="#10B981"
                  gradientId="exec-spark-2"
                  pathData="M 4 28 Q 30 24, 56 25 T 96 16 T 126 9"
                  areaData="M 4 28 Q 30 24, 56 25 T 96 16 T 126 9 L 126 34 L 4 34 Z"
                  endX={126}
                  endY={9}
                />
              </div>
            </motion.div>

            {/* KPI 3 (POIN 3): Proyek Selesai */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl pt-3.5 px-4 pb-2.5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#22C58B] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] xl:text-[14.5px] font-semibold text-[#0D2346] leading-snug whitespace-nowrap">
                    3. Proyek Selesai
                  </h2>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      data-testid="exec-kpi-completed-projects"
                      className="text-[30px] xl:text-[33px] font-bold text-[#0D2346] leading-none tabular-nums"
                    >
                      <AnimatedKpiNumber value={execMetrics.completedProjects} />
                    </span>
                    <span className="text-[12.5px] font-bold text-[#10B981] whitespace-nowrap">
                      Tuntas 100%
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1 flex items-end justify-between gap-1">
                <span className="text-[12px] font-normal text-[#475E7A] whitespace-nowrap pb-0.5">
                  Seluruh tahapan selesai
                </span>
                <ExecMiniSparkline
                  color="#10B981"
                  gradientId="exec-spark-3"
                  pathData="M 4 28 Q 28 24, 54 25 T 94 15 T 126 8"
                  areaData="M 4 28 Q 28 24, 54 25 T 94 15 T 126 8 L 126 34 L 4 34 Z"
                  endX={126}
                  endY={8}
                />
              </div>
            </motion.div>

            {/* KPI 4 (POIN 4): Proyek Berjalan */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl pt-3.5 px-4 pb-2.5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1D63DC] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCw className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] xl:text-[14.5px] font-semibold text-[#0D2346] leading-snug whitespace-nowrap">
                    4. Proyek Berjalan
                  </h2>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      data-testid="exec-kpi-ongoing-projects"
                      className="text-[30px] xl:text-[33px] font-bold text-[#0D2346] leading-none tabular-nums"
                    >
                      <AnimatedKpiNumber value={execMetrics.ongoingProjects} />
                    </span>
                    <span className="text-[12.5px] font-bold text-[#2563EB] whitespace-nowrap">
                      Aktif
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1 flex items-end justify-between gap-1">
                <span className="text-[12px] font-normal text-[#475E7A] whitespace-nowrap pb-0.5">
                  Termasuk lintas bulan
                </span>
                <ExecMiniSparkline
                  color="#2563EB"
                  gradientId="exec-spark-4"
                  pathData="M 4 28 Q 30 24, 56 25 T 96 17 T 126 9"
                  areaData="M 4 28 Q 30 24, 56 25 T 96 17 T 126 9 L 126 34 L 4 34 Z"
                  endX={126}
                  endY={9}
                />
              </div>
            </motion.div>

            {/* KPI 5 (POIN 5): Proyek Tertunda */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl pt-3.5 px-4 pb-2.5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F59E0B] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] xl:text-[14.5px] font-semibold text-[#0D2346] leading-snug whitespace-nowrap">
                    5. Proyek Tertunda
                  </h2>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      data-testid="exec-kpi-delayed-projects"
                      className="text-[30px] xl:text-[33px] font-bold text-[#0D2346] leading-none tabular-nums"
                    >
                      <AnimatedKpiNumber value={execMetrics.delayedProjects} />
                    </span>
                    <span className="text-[12.5px] font-bold text-[#D97706] whitespace-nowrap">
                      Menunggu Lokasi
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1 flex items-end justify-between gap-1">
                <span className="text-[12px] font-normal text-[#475E7A] whitespace-nowrap pb-0.5">
                  Menunggu kesiapan
                </span>
                <ExecMiniSparkline
                  color="#F59E0B"
                  gradientId="exec-spark-5"
                  pathData="M 4 28 Q 30 24, 56 25 T 96 15 T 126 7"
                  areaData="M 4 28 Q 30 24, 56 25 T 96 15 T 126 7 L 126 34 L 4 34 Z"
                  endX={126}
                  endY={7}
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* 4. BARIS VISUALISASI UTAMA: GRAFIK PERKEMBANGAN PEKERJAAN (POIN 6), REKAP PRODUK (POIN 8), PRODUKTIVITAS TEKNISI (POIN 9) */}
        <section
          aria-label="Visualisasi Kinerja, Produk, dan Produktivitas Teknisi"
          className="grid grid-cols-1 lg:grid-cols-[1.65fr_1.15fr_1.2fr] gap-3.5"
        >
          {/* Kolom 1 (POIN 6): Grafik Perkembangan Pekerjaan */}
          <div className="bg-white rounded-2xl p-5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#1A64E0] flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-[17px] xl:text-[18px] font-bold text-[#0D2346] tracking-[-0.015em]">
                      6. Grafik Perkembangan Pekerjaan
                    </h3>
                    <p className="text-[12.5px] font-normal text-[#475E7A]">
                      Tren bulanan jumlah set pekerjaan &amp; penyelesaian aktual (Jul – Des 2026)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-5 mt-2 mb-1 text-[13px] font-semibold text-[#1E293B]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1A64E0]" />
                  <span>Total Set Pekerjaan</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#15B8A6]" />
                  <span>Set Selesai Terpasang</span>
                </span>
              </div>
            </div>

            {isEmpty || workTrendSeries.length === 0 ? (
              <div className="h-[185px] flex flex-col items-center justify-center text-center p-4 bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                <Inbox className="w-7 h-7 text-[#475E7A] mb-1" />
                <p className="text-[14.5px] font-semibold text-[#0D2346]">
                  Belum Ada Data Perkembangan
                </p>
              </div>
            ) : (
              <ExecutivePerformanceLineChart
                labels={workTrendSeries.map((pt) => pt.shortLabel)}
                totalSetsSeries={workTrendSeries.map((pt) => pt.totalSets)}
                completedSetsSeries={workTrendSeries.map((pt) => pt.completedSets)}
              />
            )}
          </div>

          {/* Kolom 2 (POIN 8): Rekap Produk */}
          <div className="bg-white rounded-2xl p-5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between">
            <div>
              <h3 className="text-[17px] xl:text-[18px] font-bold text-[#0D2346] tracking-[-0.015em]">
                8. Rekap Produk
              </h3>
              <p className="text-[12.5px] font-normal text-[#475E7A] mt-0.5 mb-2">
                Distribusi set produk pada periode {periodSummary?.periodLabel || 'November 2026'}
              </p>
            </div>

            {isEmpty || productRecap.length === 0 ? (
              <div className="h-[185px] flex flex-col items-center justify-center text-center p-4 bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                <Inbox className="w-7 h-7 text-[#475E7A] mb-1" />
                <p className="text-[14.5px] font-semibold text-[#0D2346]">
                  Data Rekap Produk Kosong
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-auto py-1">
                <ExecutiveProductDonutChart
                  labels={productRecap.map((p) => p.productName)}
                  values={productRecap.map((p) => p.totalSets)}
                  colors={productRecap.map((p) => p.colorHex)}
                  totalSetsLabel={execMetrics.totalSets}
                />

                <div className="flex-1 w-full space-y-2.5 pr-1">
                  {productRecap.map((item) => (
                    <div
                      key={item.productName}
                      className="flex items-center justify-between gap-2 text-[13.5px]"
                    >
                      <span className="inline-flex items-center gap-2 font-medium text-[#1E293B] whitespace-nowrap">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        <span>{item.productName}</span>
                      </span>
                      <span className="font-bold text-[#0D2346] tabular-nums whitespace-nowrap">
                        {item.totalSets} Set ({item.sharePercent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Kolom 3 (POIN 9): Produktivitas Teknisi */}
          <div className="bg-white rounded-2xl border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#0E2956] to-[#1A4B8C] text-white px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white/90 shrink-0" />
                <h3 className="text-[16px] xl:text-[17px] font-bold text-white tracking-[-0.01em] whitespace-nowrap">
                  9. Produktivitas Teknisi
                </h3>
              </div>
              <span className="text-[12px] font-semibold text-white/85 whitespace-nowrap">
                {technicianProductivity.length} Teknisi Aktif
              </span>
            </div>

            {isEmpty || technicianProductivity.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <p className="text-[14px] font-semibold text-[#0D2346]">
                  Belum Ada Data Produktivitas
                </p>
              </div>
            ) : (
              <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-around">
                {technicianProductivity.map((tech) => (
                  <div key={tech.technicianId} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#DCE7F6] shrink-0 bg-[#EEF4FC]">
                      <ResilientImage
                        src={tech.avatarUrl}
                        alt={tech.fullName}
                        fallbackLabel={tech.fullName.slice(0, 2).toUpperCase()}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="text-[14px] font-bold text-[#0D2346] truncate leading-tight">
                          {tech.fullName}
                        </h4>
                        <span className="text-[12.5px] font-bold text-[#1D63DC] tabular-nums shrink-0">
                          {tech.totalSetsHandled} Set ({tech.completedSetsHandled} Selesai)
                        </span>
                      </div>
                      <p className="text-[12px] font-normal text-[#475E7A] leading-tight mt-0.5">
                        {tech.projectsCount} Proyek • {tech.totalActivities} Aktivitas (
                        {tech.completedActivities} Selesai)
                      </p>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <div className="flex-1 h-2 rounded-full bg-[#E2EBF5] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#1D63DC] to-[#15B897]"
                            style={{ width: `${tech.completionScorePercent}%` }}
                          />
                        </div>
                        <span className="text-[12.5px] font-bold text-[#0D2346] tabular-nums shrink-0">
                          {tech.completionScorePercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 5. REKAP JENIS AKTIVITAS (POIN 7) & PERBANDINGAN BULAN SEBELUMNYA (POIN 13) */}
        <section
          aria-label="Rekap Jenis Aktivitas dan Perbandingan Bulan Sebelumnya"
          className="grid grid-cols-1 lg:grid-cols-12 gap-3.5"
        >
          {/* Kolom Kiri (POIN 7): Rekap Jenis Aktivitas */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#1A64E0] flex items-center justify-center">
                  <Layers className="w-4 h-4 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-[#0D2346]">
                    7. Rekap Jenis Aktivitas ({periodSummary?.periodLabel || 'November 2026'})
                  </h3>
                  <p className="text-[12.5px] font-normal text-[#475E7A]">
                    Rincian tahapan pekerjaan beserta jadwal lintas bulan yang belum dilaksanakan
                  </p>
                </div>
              </div>
            </div>

            {isEmpty ? (
              <div className="p-6 text-center text-[14px] text-[#475E7A] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                Belum ada rekap jenis aktivitas
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E4EDF8]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F9FF] border-b border-[#E4EDF8] text-[13px] font-bold text-[#0D2346]">
                      <th className="py-2.5 px-3.5">Jenis Aktivitas</th>
                      <th className="py-2.5 px-3 text-right">Dilaksanakan</th>
                      <th className="py-2.5 px-3 text-right">Selesai</th>
                      <th className="py-2.5 px-3 text-right">Berjalan/Tertunda</th>
                      <th className="py-2.5 px-3 text-right">Jadwal Lintas Bulan</th>
                      <th className="py-2.5 px-3.5 text-right">Total Set</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F9] text-[13.5px]">
                    {activityTypeRecap.map((act) => (
                      <tr key={act.activityType} className="hover:bg-[#F8FBFF]">
                        <td className="py-2.5 px-3.5 font-bold text-[#0D2346]">
                          Aktivitas {act.activityType}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#0D2346] tabular-nums">
                          {act.executedInPeriodCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#0D9488] tabular-nums">
                          {act.completedCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#2368B5] tabular-nums">
                          {act.ongoingCount + act.delayedOrNotStartedCount}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {act.unexecutedFutureCrossMonthCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] text-[12px] font-bold">
                              {act.unexecutedFutureCrossMonthCount} Belum Dilaksanakan (
                              {act.unexecutedFutureCrossMonthSets} Set)
                            </span>
                          ) : (
                            <span className="text-[#64748B]">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-[#0D2346] tabular-nums">
                          {act.totalSetsInPeriod} Set
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Kolom Kanan (POIN 13): Perbandingan Bulan Sebelumnya */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#1A64E0] flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-[#0D2346]">
                    13. Perbandingan Bulan Sebelumnya
                  </h3>
                  <p className="text-[12.5px] font-normal text-[#475E7A]">
                    Komparasi terhadap periode{' '}
                    <strong>{previousComparison?.previousPeriodLabel || 'Oktober 2026'}</strong>
                  </p>
                </div>
              </div>

              {previousComparison && !isEmpty && (
                <p className="text-[13px] font-medium text-[#1E3A5F] bg-[#F5F9FF] border border-[#DCE7F6] rounded-xl px-3.5 py-2 mt-3">
                  {previousComparison.summaryNarrative}
                </p>
              )}
            </div>

            {isEmpty || !previousComparison ? (
              <div className="p-6 text-center text-[14px] text-[#475E7A] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                Belum ada data perbandingan bulan sebelumnya
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E4EDF8]">
                <table className="w-full text-left border-collapse text-[13.5px]">
                  <thead>
                    <tr className="bg-[#F5F9FF] border-b border-[#E4EDF8] font-bold text-[#0D2346]">
                      <th className="py-2.5 px-3">Indikator</th>
                      <th className="py-2.5 px-2.5 text-right">
                        {previousComparison.previousPeriodLabel}
                      </th>
                      <th className="py-2.5 px-2.5 text-right">
                        {periodSummary?.periodLabel}
                      </th>
                      <th className="py-2.5 px-3 text-right">Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F9]">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-[#0D2346]">
                        Total Proyek
                      </td>
                      <td className="py-2 px-2.5 text-right text-[#475E7A] tabular-nums">
                        {previousComparison.previousTotalProjects}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-[#0D2346] tabular-nums">
                        {execMetrics.totalProjects}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#2368B5] tabular-nums">
                        {previousComparison.deltaTotalProjects >= 0
                          ? `+${previousComparison.deltaTotalProjects}`
                          : previousComparison.deltaTotalProjects}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-[#0D2346]">
                        Proyek Selesai
                      </td>
                      <td className="py-2 px-2.5 text-right text-[#475E7A] tabular-nums">
                        {previousComparison.previousCompletedProjects}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-[#0D9488] tabular-nums">
                        {execMetrics.completedProjects}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#0D9488] tabular-nums">
                        {previousComparison.deltaCompletedProjects >= 0
                          ? `+${previousComparison.deltaCompletedProjects}`
                          : previousComparison.deltaCompletedProjects}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-[#0D2346]">
                        Total Aktivitas
                      </td>
                      <td className="py-2 px-2.5 text-right text-[#475E7A] tabular-nums">
                        {previousComparison.previousTotalActivities}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-[#0D2346] tabular-nums">
                        {periodSummary?.totalActivitiesInPeriod ?? 0}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#2368B5] tabular-nums">
                        {previousComparison.deltaTotalActivities >= 0
                          ? `+${previousComparison.deltaTotalActivities}`
                          : previousComparison.deltaTotalActivities}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-[#0D2346]">
                        Total Jumlah Set
                      </td>
                      <td className="py-2 px-2.5 text-right text-[#475E7A] tabular-nums">
                        {previousComparison.previousTotalSets} Set
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-[#0D2346] tabular-nums">
                        {execMetrics.totalSets} Set
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#2368B5] tabular-nums">
                        {previousComparison.deltaTotalSets >= 0
                          ? `+${previousComparison.deltaTotalSets} Set`
                          : `${previousComparison.deltaTotalSets} Set`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* 6. RIWAYAT PROYEK (POIN 10), DOKUMENTASI PROYEK (POIN 11), & ARSIP LAPORAN BULANAN (POIN 12) */}
        <section
          aria-label="Riwayat Proyek, Dokumentasi Proyek, dan Arsip Laporan Bulanan"
          className="grid grid-cols-1 lg:grid-cols-12 gap-3.5"
        >
          {/* POIN 10: Riwayat Proyek (5 Kolom) */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#1A64E0] flex items-center justify-center">
                  <Briefcase className="w-4 h-4 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-[16.5px] font-bold text-[#0D2346]">
                    10. Riwayat Proyek ({projectHistory.length})
                  </h3>
                  <p className="text-[12.5px] font-normal text-[#475E7A]">
                    Status proyek &amp; tahapan lintas bulan pada {periodSummary?.periodLabel}
                  </p>
                </div>
              </div>
            </div>

            {isEmpty || projectHistory.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-[13.5px] text-[#475E7A] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                Belum ada riwayat proyek pada periode ini
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {projectHistory.map((proj) => (
                  <div
                    key={proj.projectId}
                    className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#E1ECFA] space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-bold text-[#2368B5]">
                            {proj.projectCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11.5px] font-bold ${
                              proj.isContinuingFromPreviousMonth
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'bg-[#EBF5FF] text-[#1D63DC]'
                            }`}
                          >
                            {proj.isContinuingFromPreviousMonth
                              ? `Proyek Lanjutan (${proj.projectOriginMonth})`
                              : 'Proyek Baru'}
                          </span>
                        </div>
                        <h4 className="text-[14.5px] font-bold text-[#0D2346] mt-0.5">
                          {proj.projectTitle}
                        </h4>
                        <p className="text-[12px] font-normal text-[#475E7A] truncate">
                          {proj.customerName}
                        </p>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[12px] font-bold shrink-0 ${
                          proj.statusInPeriod === 'Selesai'
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : proj.statusInPeriod === 'Tertunda'
                              ? 'bg-[#FEF3C7] text-[#B45309]'
                              : 'bg-[#DBEAFE] text-[#1D4ED8]'
                        }`}
                      >
                        {proj.statusInPeriod === 'Selesai'
                          ? 'Proyek Selesai'
                          : proj.statusInPeriod === 'Tertunda'
                            ? 'Proyek Tertunda'
                            : 'Proyek Berjalan'}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-[#E4EDF8]">
                      {proj.activitiesInPeriod.map((act) => (
                        <div
                          key={act.activityCode}
                          className="flex items-center justify-between gap-2 text-[12.5px]"
                        >
                          <span className="text-[#1E293B] font-medium">
                            <strong>{act.activityType}</strong> ({act.startDate}) •{' '}
                            {act.productName} ({act.quantitySets} Set)
                          </span>
                          <span className="font-bold text-[#0D9488]">
                            {act.condition}
                          </span>
                        </div>
                      ))}

                      {proj.unexecutedFollowUpActivities.map((fAct) => (
                        <div
                          key={fAct.activityCode}
                          className="flex items-center justify-between gap-2 text-[12px] bg-[#FFFBEB] px-2.5 py-1 rounded-lg border border-[#FDE68A] text-[#92400E]"
                        >
                          <span className="font-semibold">
                            {fAct.activityType} • {fAct.productName} ({fAct.quantitySets} Set)
                          </span>
                          <span className="font-bold">{fAct.statusLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* POIN 11: Dokumentasi Proyek (3 Kolom) */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#1A64E0] flex items-center justify-center">
                    <Camera className="w-4 h-4 stroke-[2.3]" />
                  </div>
                  <div>
                    <h3 className="text-[16.5px] font-bold text-[#0D2346]">
                      11. Dokumentasi Proyek
                    </h3>
                    <p className="text-[12.5px] font-normal text-[#475E7A]">
                      {projectDocumentation.length} Foto Tersedia di Database
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isEmpty || projectDocumentation.length === 0 ? (
              <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center text-center p-4 bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                <Camera className="w-7 h-7 text-[#64748B] mb-1.5" />
                <p className="text-[13.5px] font-semibold text-[#0D2346]">
                  Belum Ada Foto Dokumentasi pada Periode Ini
                </p>
                <p className="text-[12px] font-normal text-[#475E7A] mt-0.5">
                  Foto dokumentasi yang diunggah pada Galeri Proyek otomatis tampil di sini secara Read-Only.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 my-auto">
                {projectDocumentation.slice(0, 4).map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedPhotoLightbox(photo)}
                    className="group relative h-28 rounded-xl overflow-hidden border border-[#DCE7F6] text-left cursor-pointer"
                  >
                    <ResilientImage
                      src={photo.imageUrl}
                      alt={photo.caption || photo.projectTitle}
                      fallbackLabel="Foto"
                      variant="gallery"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B224B]/90 via-[#0B224B]/50 to-transparent p-2 text-white">
                      <span className="block text-[11px] font-bold truncate">
                        {photo.documentationCategory}
                      </span>
                      <span className="block text-[10.5px] text-white/85 truncate">
                        {photo.projectTitle}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* POIN 12: Arsip Laporan Bulanan (4 Kolom) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-[#E4EDF8] shadow-[0_4px_18px_rgba(13,35,70,0.04)] flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#1A64E0] flex items-center justify-center">
                  <FileText className="w-4 h-4 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-[16.5px] font-bold text-[#0D2346]">
                    12. Arsip Laporan Bulanan
                  </h3>
                  <p className="text-[12.5px] font-normal text-[#475E7A]">
                    Lihat laporan resmi &amp; unduh PDF / Excel (Read-Only)
                  </p>
                </div>
              </div>
            </div>

            {isEmpty || monthlyReportArchives.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-[13.5px] text-[#475E7A] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                Belum ada arsip laporan bulanan
              </div>
            ) : (
              <div className="space-y-2.5">
                {monthlyReportArchives.map((arc) => (
                  <div
                    key={arc.periodMonth}
                    className={`rounded-xl px-3.5 py-3 border transition-colors ${
                      arc.periodMonth === selectedPeriod
                        ? 'bg-[#F0F7FF] border-[#2563EB]'
                        : 'bg-[#F8FBFF] border-[#E1ECFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-bold text-[#0D2346] truncate">
                            Laporan {arc.periodLabel}
                          </h4>
                          <span className="text-[11.5px] font-semibold text-[#2368B5]">
                            {arc.reportDocumentNumber}
                          </span>
                        </div>
                        <p className="text-[12px] font-normal text-[#475E7A] mt-0.5">
                          Dibuat Otomatis: <strong>{arc.officialGeneratedDateLabel}</strong> •{' '}
                          {arc.totalProjects} Proyek • {arc.totalSets} Set
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DCE7F6]/70">
                      <button
                        type="button"
                        data-testid={`btn-exec-inspect-${arc.periodMonth}`}
                        onClick={() => {
                          setInspectingReportPeriod(arc.periodMonth);
                          if (arc.periodMonth !== selectedPeriod) {
                            void handlePeriodChange(arc.periodMonth);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#EBF3FF] border border-[#DCE7F6] text-[#0D2346] text-[12.5px] font-bold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#1D63DC]" />
                        <span>Lihat Laporan</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`btn-exec-pdf-${arc.periodMonth}`}
                          disabled={downloadingKey === `${arc.periodMonth}-PDF`}
                          onClick={() =>
                            void handleDownloadExecutiveFile(
                              arc.periodMonth,
                              'PDF',
                              `Laporan ${arc.periodLabel}`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0D2346] hover:bg-[#1B3F70] text-white text-[12px] font-bold transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`btn-exec-excel-${arc.periodMonth}`}
                          disabled={downloadingKey === `${arc.periodMonth}-EXCEL`}
                          onClick={() =>
                            void handleDownloadExecutiveFile(
                              arc.periodMonth,
                              'EXCEL',
                              `Laporan ${arc.periodLabel}`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0D8A72] hover:bg-[#0A6E5B] text-white text-[12px] font-bold transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Excel</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* MODAL READ-ONLY: PRATINJAU DOKUMEN LAPORAN BULANAN RESMI UNTUK PIMPINAN */}
      {inspectedReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Dokumen Laporan Bulanan ${inspectedReport.periodLabel}`}
          className="fixed inset-0 z-50 bg-[#0B224B]/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl border border-[#DCE7F6] shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-[#0B224B] to-[#1A4B8C] text-white px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-white/85">
                  <ShieldCheck className="w-4 h-4 text-[#22C58B]" />
                  <span>
                    Dokumen Resmi Pimpinan (Read-Only) • {inspectedReport.reportDocumentNumber}
                  </span>
                </div>
                <h3 className="text-[20px] font-bold text-white mt-0.5">
                  Laporan Operasional Bulanan — {inspectedReport.periodLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingReportPeriod(null)}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
                aria-label="Tutup Pratinjau Laporan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-[#0D2346]">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-[#F5F9FF] border border-[#DCE7F6]">
                  <span className="text-[12px] font-semibold text-[#475E7A] block">
                    Total Proyek
                  </span>
                  <strong className="text-[24px] font-bold text-[#0D2346]">
                    {inspectedReport.totalProjects}
                  </strong>
                  <span className="text-[11.5px] text-[#2368B5] block font-semibold">
                    {inspectedReport.newProjectsCount} Baru •{' '}
                    {inspectedReport.continuingProjectsCount} Lanjutan
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0]">
                  <span className="text-[12px] font-semibold text-[#065F46] block">
                    Proyek Selesai
                  </span>
                  <strong className="text-[24px] font-bold text-[#065F46]">
                    {inspectedReport.completedProjects}
                  </strong>
                </div>
                <div className="p-3.5 rounded-xl bg-[#EBF5FF] border border-[#BFDBFE]">
                  <span className="text-[12px] font-semibold text-[#1E40AF] block">
                    Proyek Berjalan
                  </span>
                  <strong className="text-[24px] font-bold text-[#1E40AF]">
                    {inspectedReport.ongoingProjects}
                  </strong>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
                  <span className="text-[12px] font-semibold text-[#92400E] block">
                    Proyek Tertunda
                  </span>
                  <strong className="text-[24px] font-bold text-[#92400E]">
                    {inspectedReport.delayedProjects}
                  </strong>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F5F9FF] border border-[#DCE7F6]">
                  <span className="text-[12px] font-semibold text-[#475E7A] block">
                    Total Jumlah Set
                  </span>
                  <strong className="text-[24px] font-bold text-[#0D2346]">
                    {inspectedReport.totalSets} Set
                  </strong>
                  <span className="text-[11.5px] text-[#0D9488] block font-semibold">
                    {inspectedReport.completedSets} Set Selesai
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FBFF] border border-[#DCE7F6] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E3A5F]">
                    <Clock className="w-4 h-4 text-[#2368B5]" />
                    <span>
                      Jadwal Pembuatan Otomatis:{' '}
                      <strong>{inspectedReport.officialGeneratedDateLabel}</strong>
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#065F46]">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                    <span>Data Terverifikasi Database PostgreSQL</span>
                  </span>
                </div>
                <p className="text-[13.5px] text-[#475E7A]">
                  {inspectedReport.previousMonthComparison.summaryNarrative}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[#475E7A]">
                Mode Pimpinan Read-Only: Anda dapat melihat dan mengunduh dokumen resmi.
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    void handleDownloadExecutiveFile(
                      inspectedReport.periodMonth,
                      'PDF',
                      `Laporan ${inspectedReport.periodLabel}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D2346] hover:bg-[#1B3F70] text-white text-[13.5px] font-bold cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleDownloadExecutiveFile(
                      inspectedReport.periodMonth,
                      'EXCEL',
                      `Laporan ${inspectedReport.periodLabel}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D8A72] hover:bg-[#0A6E5B] text-white text-[13.5px] font-bold cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Unduh Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingReportPeriod(null)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0D2346] text-[13.5px] font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL READ-ONLY: LIGHTBOX FOTO DOKUMENTASI PROYEK */}
      {selectedPhotoLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau Dokumentasi Proyek"
          className="fixed inset-0 z-50 bg-[#0B224B]/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden border border-[#DCE7F6] shadow-2xl">
            <div className="px-5 py-3.5 bg-[#0B224B] text-white flex items-center justify-between">
              <div>
                <span className="text-[12px] font-bold text-[#67C6F3] block">
                  {selectedPhotoLightbox.documentationCategory} •{' '}
                  {selectedPhotoLightbox.projectCode}
                </span>
                <h4 className="text-[16px] font-bold">
                  {selectedPhotoLightbox.projectTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoLightbox(null)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative h-80 bg-[#0F172A]">
              <ResilientImage
                src={selectedPhotoLightbox.imageUrl}
                alt={selectedPhotoLightbox.caption}
                fallbackLabel="Foto Dokumentasi"
                variant="gallery"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-4 bg-[#F8FAFC] flex items-center justify-between gap-3">
              <p className="text-[13.5px] font-medium text-[#0D2346]">
                {selectedPhotoLightbox.caption}
              </p>
              <span className="text-[12px] font-semibold text-[#475E7A] shrink-0">
                Mode Read-Only Pimpinan
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
