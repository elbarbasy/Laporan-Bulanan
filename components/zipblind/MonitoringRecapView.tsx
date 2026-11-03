'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  FolderKanban,
  Layers,
  Package,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { UIPreviewStateMode } from '@/lib/zipblind-ui-data';
import {
  OPERATIONAL_ACTIVITY_TYPES,
  formatAssignedTechniciansColumn,
  type OperationalActivityRecord,
  type OperationalStatus,
} from '@/lib/zipblind-operational';
import {
  MONITORING_WORK_CONDITIONS,
  calculateMonitoringAndWorkRecap,
  mapMonitoringConditionToDbStatus,
  type MonitoringWorkCondition,
} from '@/lib/zipblind-monitoring-rekap';

interface MonitoringRecapViewProps {
  mode: 'monitoring' | 'rekap-pekerjaan';
  previewMode: UIPreviewStateMode;
}

interface OperationalSnapshotData {
  technicians: Array<{
    id: string;
    technicianCode: string;
    fullName: string;
    phone: string;
    specialization: string | null;
    avatarUrl: string;
    isActive: boolean;
  }>;
  customers: Array<{
    id: string;
    customerCode: string;
    fullName: string;
    city: string;
    address: string;
  }>;
  projects: Array<{
    id: string;
    projectCode: string;
    title: string;
    customerId: string;
    customerName: string;
    installationAddress: string;
    status: OperationalStatus;
    startDate: string;
    targetEndDate: string;
    isCrossMonth: boolean;
  }>;
  activities: OperationalActivityRecord[];
  products: Array<{
    id: string;
    name: string;
    unitLabel: string;
  }>;
}

const CONDITION_BADGE_STYLES: Record<
  MonitoringWorkCondition,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    cardAccent: string;
  }
> = {
  'Belum dimulai': {
    bg: 'bg-[#F0F7FF]',
    text: 'text-[#2368B5]',
    border: 'border-[#BFDBFE]',
    dot: 'bg-[#2368B5]',
    cardAccent: 'border-l-4 border-l-[#2368B5]',
  },
  'Sedang berjalan': {
    bg: 'bg-[#ECFEFF]',
    text: 'text-[#087F8C]',
    border: 'border-[#A5F3FC]',
    dot: 'bg-[#087F8C]',
    cardAccent: 'border-l-4 border-l-[#087F8C]',
  },
  Selesai: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#0D9488]',
    border: 'border-[#99F6E4]',
    dot: 'bg-[#0D9488]',
    cardAccent: 'border-l-4 border-l-[#0D9488]',
  },
  Tertunda: {
    bg: 'bg-[#FFFBEB]',
    text: 'text-[#D97706]',
    border: 'border-[#FDE68A]',
    dot: 'bg-[#D97706]',
    cardAccent: 'border-l-4 border-l-[#D97706]',
  },
  Dibatalkan: {
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#DC2626]',
    border: 'border-[#FECACA]',
    dot: 'bg-[#DC2626]',
    cardAccent: 'border-l-4 border-l-[#DC2626]',
  },
};

export function MonitoringRecapView({
  mode,
  previewMode,
}: MonitoringRecapViewProps) {
  const [snapshot, setSnapshot] = useState<OperationalSnapshotData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // State Filter Sesuai Spesifikasi PROMPT 6
  const [periodMonth, setPeriodMonth] = useState<string>('Semua');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [projectIdFilter, setProjectIdFilter] = useState<string>('Semua');
  const [customerIdFilter, setCustomerIdFilter] = useState<string>('Semua');
  const [technicianIdFilter, setTechnicianIdFilter] = useState<string>('Semua');
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('Semua');
  const [productNameFilter, setProductNameFilter] = useState<string>('Semua');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({
          type: 'error',
          text: data.error || 'Gagal memuat data monitoring dan rekap dari database.',
        });
      } else {
        setSnapshot(data);
      }
    } catch {
      setBannerMessage({
        type: 'error',
        text: 'Tidak dapat terhubung ke server database.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/operational', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setBannerMessage({
            type: 'error',
            text: data.error || 'Gagal memuat data monitoring dan rekap dari database.',
          });
        } else {
          setSnapshot(data);
        }
      } catch {
        if (!active) return;
        setBannerMessage({
          type: 'error',
          text: 'Tidak dapat terhubung ke server database.',
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleResetFilters = () => {
    setPeriodMonth('Semua');
    setDateFrom('');
    setDateTo('');
    setProjectIdFilter('Semua');
    setCustomerIdFilter('Semua');
    setTechnicianIdFilter('Semua');
    setActivityTypeFilter('Semua');
    setProductNameFilter('Semua');
    setStatusFilter('Semua');
    setSearchQuery('');
  };

  // Daftar opsi bulan unik dari aktivitas di database
  const availablePeriodMonths = useMemo(() => {
    const months = new Set<string>(['2026-11', '2026-12']);
    if (snapshot?.activities) {
      for (const act of snapshot.activities) {
        if (act.startDate && act.startDate.length >= 7) {
          months.add(act.startDate.slice(0, 7));
        }
        if (act.endDate && act.endDate.length >= 7) {
          months.add(act.endDate.slice(0, 7));
        }
      }
    }
    return Array.from(months).sort();
  }, [snapshot]);

  const formatPeriodMonthLabel = (yyyyMm: string) => {
    const [year, month] = yyyyMm.split('-');
    const monthNames: Record<string, string> = {
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
    return `${monthNames[month] || month} ${year}`;
  };

  // Hitung Monitoring & Rekap Pekerjaan dari data database asli
  const computation = useMemo(() => {
    if (!snapshot || previewMode === 'empty') {
      return calculateMonitoringAndWorkRecap({
        activities: [],
        projects: [],
        technicians: [],
        products: [],
      });
    }

    return calculateMonitoringAndWorkRecap({
      activities: snapshot.activities,
      projects: snapshot.projects,
      technicians: snapshot.technicians,
      products: snapshot.products,
      filters: {
        periodMonth,
        dateFrom,
        dateTo,
        projectId: projectIdFilter,
        customerId: mode === 'monitoring' ? customerIdFilter : 'Semua',
        technicianId: technicianIdFilter,
        activityType: activityTypeFilter,
        productName: productNameFilter,
        status: statusFilter,
        searchQuery,
      },
    });
  }, [
    snapshot,
    previewMode,
    periodMonth,
    dateFrom,
    dateTo,
    projectIdFilter,
    customerIdFilter,
    technicianIdFilter,
    activityTypeFilter,
    productNameFilter,
    statusFilter,
    searchQuery,
    mode,
  ]);

  // Hitung 5 kondisi Monitoring tanpa filter status agar kartu 5 kondisi selalu menampilkan perbandingan jelas
  const baseConditionSummary = useMemo(() => {
    if (!snapshot || previewMode === 'empty') {
      return {
        'Belum dimulai': 0,
        'Sedang berjalan': 0,
        Selesai: 0,
        Tertunda: 0,
        Dibatalkan: 0,
      } satisfies Record<MonitoringWorkCondition, number>;
    }

    const baseCalc = calculateMonitoringAndWorkRecap({
      activities: snapshot.activities,
      projects: snapshot.projects,
      technicians: snapshot.technicians,
      products: snapshot.products,
      filters: {
        periodMonth,
        dateFrom,
        dateTo,
        projectId: projectIdFilter,
        customerId: mode === 'monitoring' ? customerIdFilter : 'Semua',
        technicianId: technicianIdFilter,
        activityType: activityTypeFilter,
        productName: productNameFilter,
        status: 'Semua',
        searchQuery,
      },
    });
    return baseCalc.monitoringConditionsCount;
  }, [
    snapshot,
    previewMode,
    periodMonth,
    dateFrom,
    dateTo,
    projectIdFilter,
    customerIdFilter,
    technicianIdFilter,
    activityTypeFilter,
    productNameFilter,
    searchQuery,
    mode,
  ]);

  // Handler ubah status aktivitas langsung ke database PostgreSQL
  const handleUpdateActivityCondition = async (
    activityId: string,
    targetCondition: MonitoringWorkCondition
  ) => {
    const dbStatus = mapMonitoringConditionToDbStatus(targetCondition);
    setSubmittingId(activityId);
    setBannerMessage(null);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'activity',
          id: activityId,
          status: dbStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({
          type: 'error',
          text: data.error || 'Gagal memperbarui kondisi pekerjaan.',
        });
      } else {
        setSnapshot(data.snapshot);
        setBannerMessage({
          type: 'success',
          text: `Kondisi aktivitas berhasil diperbarui menjadi "${targetCondition}".`,
        });
      }
    } catch {
      setBannerMessage({
        type: 'error',
        text: 'Terjadi kesalahan jaringan saat memperbarui status aktivitas.',
      });
    } finally {
      setSubmittingId(null);
    }
  };

  // Handler ubah status proyek (memvalidasi Aturan 2 di backend)
  const handleUpdateProjectStatus = async (
    projectId: string,
    targetCondition: MonitoringWorkCondition
  ) => {
    const dbStatus = mapMonitoringConditionToDbStatus(targetCondition);
    setSubmittingId(projectId);
    setBannerMessage(null);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'project',
          id: projectId,
          status: dbStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({
          type: 'error',
          text:
            data.error ||
            'Proyek tidak dapat ditandai selesai karena masih ada aktivitas yang belum selesai.',
        });
      } else {
        setSnapshot(data.snapshot);
        setBannerMessage({
          type: 'success',
          text: data.message || 'Status proyek berhasil diperbarui.',
        });
      }
    } catch {
      setBannerMessage({
        type: 'error',
        text: 'Terjadi kesalahan jaringan saat memperbarui status proyek.',
      });
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading && !snapshot) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-[#DCE6F2] shadow-xs flex items-center justify-center gap-3 text-[#2368B5]">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-[15px] font-semibold">
          Memuat data Monitoring &amp; Rekap Pekerjaan dari database PostgreSQL...
        </span>
      </div>
    );
  }

  // ============================================================================
  // TAMPILAN 1: HALAMAN MONITORING PEKERJAAN
  // ============================================================================
  if (mode === 'monitoring') {
    return (
      <div className="w-full space-y-6">
        {bannerMessage && (
          <div
            role="status"
            className={`px-5 py-4 rounded-xl border flex items-center justify-between gap-4 text-[15px] font-medium ${
              bannerMessage.type === 'error'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                : 'bg-[#ECFDF5] border-[#99F6E4] text-[#065F46]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {bannerMessage.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0D9488]" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-[14px] font-semibold underline cursor-pointer shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* 1. LIMA KARTU KONDISI PEKERJAAN MONITORING (Belum dimulai, Sedang berjalan, Selesai, Tertunda, Dibatalkan) */}
        <section aria-label="Kondisi Pekerjaan Monitoring" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                Kondisi Pekerjaan Lapangan
              </h3>
              <p className="text-[14.5px] font-normal text-[#475E7A]">
                Pemantauan kondisi pekerjaan aktual berdasarkan aktivitas yang tercatat di database. Klik kartu untuk memfilter status.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {statusFilter !== 'Semua' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('Semua')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F0F7FF] text-[#2368B5] text-[14px] font-semibold hover:bg-[#E1EFFE] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Tampilkan Semua Kondisi</span>
                </button>
              )}
              <button
                type="button"
                onClick={fetchSnapshot}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#DCE6F2] text-[#102B50] text-[14px] font-semibold hover:bg-[#F5F9FF] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#2368B5]" />
                <span>Segarkan Data</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {MONITORING_WORK_CONDITIONS.map((condition) => {
              const count = baseConditionSummary[condition] || 0;
              const isSelected = statusFilter === condition;
              const style = CONDITION_BADGE_STYLES[condition];

              const IconComp =
                condition === 'Belum dimulai'
                  ? Clock
                  : condition === 'Sedang berjalan'
                    ? PlayCircle
                    : condition === 'Selesai'
                      ? CheckCircle2
                      : condition === 'Tertunda'
                        ? AlertCircle
                        : XCircle;

              const subtitle =
                condition === 'Belum dimulai'
                  ? 'Dijadwalkan / menunggu mulai'
                  : condition === 'Sedang berjalan'
                    ? 'Progres pengerjaan aktif'
                    : condition === 'Selesai'
                      ? 'Tahapan aktivitas tuntas'
                      : condition === 'Tertunda'
                        ? 'Menunggu kesiapan lokasi'
                        : 'Aktivitas dibatalkan';

              return (
                <button
                  key={condition}
                  type="button"
                  onClick={() =>
                    setStatusFilter((prev) => (prev === condition ? 'Semua' : condition))
                  }
                  className={`text-left bg-white rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    style.cardAccent
                  } ${
                    isSelected
                      ? 'border-[#2368B5] ring-2 ring-[#2368B5]/20 shadow-sm'
                      : 'border-[#DCE6F2] hover:border-[#B8CCE4] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-[#102B50]">
                      {condition}
                    </span>
                    <span
                      className={`w-9 h-9 rounded-xl ${style.bg} ${style.text} flex items-center justify-center shrink-0`}
                    >
                      <IconComp className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[30px] lg:text-[32px] font-extrabold text-[#102B50] tabular-nums leading-none">
                      {count}
                    </span>
                    <span className="text-[13.5px] font-semibold text-[#475E7A] tabular-nums">
                      Aktivitas
                    </span>
                  </div>
                  <p className="text-[13.5px] font-normal text-[#475E7A] leading-snug">
                    {subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. PANEL FILTER MONITORING LENGKAP (Tanggal, Proyek, Pelanggan, Teknisi, Jenis Aktivitas, Produk, Status) */}
        <section
          aria-label="Filter Monitoring Pekerjaan"
          className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Filter className="w-5 h-5 text-[#2368B5]" />
              <h4 className="text-[17px] lg:text-[18px] font-semibold text-[#102B50]">
                Filter Pemantauan Pekerjaan
              </h4>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-medium text-[#475E7A] tabular-nums">
                Menampilkan{' '}
                <strong className="font-bold text-[#102B50]">
                  {computation.filteredActivities.length}
                </strong>{' '}
                aktivitas dari{' '}
                <strong className="font-bold text-[#102B50]">
                  {computation.distinctProjectsWithActivities}
                </strong>{' '}
                proyek
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F5F9FF] hover:bg-[#E6F0FA] text-[#2368B5] text-[14px] font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Filter</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            {/* Filter 1A: Periode Bulan */}
            <div>
              <label
                htmlFor="mon-period-month"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Periode Pelaksanaan (Bulan)
              </label>
              <select
                id="mon-period-month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              >
                <option value="Semua">Semua Periode Bulan</option>
                {availablePeriodMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatPeriodMonthLabel(m)} ({m})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 1B: Rentang Tanggal Mulai & Akhir */}
            <div>
              <label
                htmlFor="mon-date-from"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Dari Tanggal
              </label>
              <input
                id="mon-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              />
            </div>

            <div>
              <label
                htmlFor="mon-date-to"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Sampai Tanggal
              </label>
              <input
                id="mon-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              />
            </div>

            {/* Filter 2: Proyek */}
            <div>
              <label
                htmlFor="mon-project"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Proyek
              </label>
              <select
                id="mon-project"
                value={projectIdFilter}
                onChange={(e) => setProjectIdFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              >
                <option value="Semua">Semua Proyek</option>
                {(snapshot?.projects || []).map((prj) => (
                  <option key={prj.id} value={prj.id}>
                    {prj.projectCode} — {prj.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: Pelanggan */}
            <div>
              <label
                htmlFor="mon-customer"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Pelanggan
              </label>
              <select
                id="mon-customer"
                value={customerIdFilter}
                onChange={(e) => setCustomerIdFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              >
                <option value="Semua">Semua Pelanggan</option>
                {(snapshot?.customers || []).map((cust) => (
                  <option key={cust.id} value={cust.id}>
                    {cust.fullName} ({cust.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4: Teknisi */}
            <div>
              <label
                htmlFor="mon-technician"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Teknisi
              </label>
              <select
                id="mon-technician"
                value={technicianIdFilter}
                onChange={(e) => setTechnicianIdFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              >
                <option value="Semua">Semua Teknisi</option>
                {(snapshot?.technicians || []).map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.fullName} ({tech.technicianCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 5: Jenis Aktivitas */}
            <div>
              <label
                htmlFor="mon-activity-type"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Jenis Aktivitas
              </label>
              <select
                id="mon-activity-type"
                value={activityTypeFilter}
                onChange={(e) => setActivityTypeFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              >
                <option value="Semua">Semua Jenis Aktivitas</option>
                {OPERATIONAL_ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 6: Produk */}
            <div>
              <label
                htmlFor="mon-product"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Produk
              </label>
              <select
                id="mon-product"
                value={productNameFilter}
                onChange={(e) => setProductNameFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              >
                <option value="Semua">Semua Produk</option>
                {(snapshot?.products || []).map((prod) => (
                  <option key={prod.id} value={prod.name}>
                    {prod.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Filter 7: Status Kondisi Pekerjaan */}
            <div>
              <label
                htmlFor="mon-status"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Status / Kondisi Pekerjaan
              </label>
              <select
                id="mon-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
              >
                <option value="Semua">Semua Kondisi Pekerjaan</option>
                {MONITORING_WORK_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>

            {/* Pencarian Cepat */}
            <div className="md:col-span-2">
              <label
                htmlFor="mon-search"
                className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
              >
                Cari Proyek / Pelanggan / Lokasi / Aktivitas
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#475E7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="mon-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik kode proyek, nama pelanggan, teknisi, atau detail pekerjaan..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] placeholder:text-[#7A90AC] focus:outline-none focus:border-[#2368B5]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. RINGKASAN KONDISI PROYEK vs TAHAPAN AKTIVITAS (Penegakan Aturan 2 & 3) */}
        {computation.projectSummaries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-[#DCE6F2] shadow-xs text-center space-y-2">
            <h4 className="text-[18px] font-bold text-[#102B50]">
              Tidak Ada Pekerjaan yang Sesuai Filter
            </h4>
            <p className="text-[15px] font-normal text-[#475E7A]">
              Ubah kriteria filter tanggal, proyek, pelanggan, teknisi, aktivitas, produk, atau status untuk melihat kondisi pekerjaan.
            </p>
          </div>
        ) : (
          <section aria-label="Status Proyek dan Tahapan Aktivitas" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                  Monitoring Kondisi Proyek &amp; Tahapan Aktivitas ({computation.projectSummaries.length} Proyek)
                </h3>
                <p className="text-[14.5px] font-normal text-[#475E7A]">
                  Proyek tidak dianggap selesai selama masih terdapat tahapan aktivitas yang belum selesai.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {computation.projectSummaries.map((prj) => {
                const prjBadge = CONDITION_BADGE_STYLES[prj.effectiveProjectCondition];
                const hasIncomplete =
                  prj.totalRecordedActivities > prj.completedActivitiesCount + prj.cancelledActivitiesCount;

                return (
                  <div
                    key={prj.projectId}
                    className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-[#2368B5] tabular-nums">
                            <span>{prj.projectCode}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#475E7A]">{prj.customerName}</span>
                            {prj.hasCrossMonthActivities && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-[#EBF5FF] text-[#1D4ED8] text-[12.5px] font-bold">
                                Lintas Bulan
                              </span>
                            )}
                          </div>
                          <h4 className="text-[17px] lg:text-[18px] font-bold text-[#102B50] mt-1">
                            {prj.projectTitle}
                          </h4>
                          <p className="text-[14px] font-normal text-[#475E7A] mt-0.5">
                            Lokasi: {prj.installationAddress}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[13px] font-bold ${prjBadge.bg} ${prjBadge.text} ${prjBadge.border}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${prjBadge.dot}`} />
                            <span>Kondisi Proyek: {prj.effectiveProjectCondition}</span>
                          </span>
                          <span className="text-[13px] font-semibold text-[#475E7A] tabular-nums">
                            {prj.completedActivitiesCount} / {prj.totalRecordedActivities} Aktivitas Selesai
                          </span>
                        </div>
                      </div>

                      {hasIncomplete && (
                        <div className="px-3.5 py-2.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[13.5px] font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706]" />
                          <span>
                            Masih ada{' '}
                            <strong className="font-bold">
                              {prj.pendingActivitiesCount + prj.ongoingActivitiesCount}
                            </strong>{' '}
                            aktivitas yang belum selesai ({prj.ongoingActivitiesCount} berjalan,{' '}
                            {prj.pendingActivitiesCount} tertunda/belum dimulai). Proyek belum dianggap selesai.
                          </span>
                        </div>
                      )}

                      {/* Daftar aktivitas proyek yang masuk dalam filter */}
                      <div className="space-y-2 pt-1">
                        {prj.activities.map((act) => {
                          const actBadge = CONDITION_BADGE_STYLES[act.monitoringCondition];
                          return (
                            <div
                              key={act.id}
                              className="p-3.5 rounded-xl bg-[#F8FBFF] border border-[#E2ECF7] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                                  <span className="font-bold text-[#102B50]">
                                    {act.activityType}
                                  </span>
                                  <span className="text-[#475E7A] tabular-nums">
                                    ({act.startDate}
                                    {act.endDate && act.endDate !== act.startDate
                                      ? ` s/d ${act.endDate}`
                                      : ''}
                                    )
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-white border border-[#DCE6F2] text-[#102B50] text-[12.5px] font-semibold tabular-nums">
                                    {act.productName} · {act.quantitySets} Set
                                  </span>
                                  {act.isCrossMonth && (
                                    <span className="px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1] text-[12px] font-semibold">
                                      Tahap Lintas Bulan
                                    </span>
                                  )}
                                </div>
                                <div className="text-[13.5px] font-normal text-[#475E7A]">
                                  Teknisi: {formatAssignedTechniciansColumn(act.technicians)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12.5px] font-bold ${actBadge.bg} ${actBadge.text} ${actBadge.border}`}
                                >
                                  {act.monitoringCondition}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#EEF3F9] flex flex-wrap items-center justify-between gap-3 text-[13.5px]">
                      <span className="font-semibold text-[#475E7A] tabular-nums">
                        Total Detail Pekerjaan Terfilter: {prj.totalWorkDetailSets} Set
                      </span>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`prj-status-${prj.projectId}`}
                          className="text-[13px] font-semibold text-[#475E7A]"
                        >
                          Ubah Status Proyek:
                        </label>
                        <select
                          id={`prj-status-${prj.projectId}`}
                          disabled={submittingId === prj.projectId}
                          value={prj.effectiveProjectCondition}
                          onChange={(e) =>
                            handleUpdateProjectStatus(
                              prj.projectId,
                              e.target.value as MonitoringWorkCondition
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-[#DCE6F2] bg-white text-[13px] font-semibold text-[#102B50] cursor-pointer"
                        >
                          {MONITORING_WORK_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond}>
                              {cond}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. TABEL PEMANTAUAN PEKERJAAN DETAIL (Tanggal, Proyek, Pelanggan, Teknisi, Jenis Aktivitas, Produk, Jumlah Set, Status) */}
        <section
          aria-label="Tabel Monitoring Aktivitas Pekerjaan"
          className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden"
        >
          <div className="p-6 border-b border-[#EEF3F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                Daftar Monitoring Aktivitas Pekerjaan ({computation.filteredActivities.length} Aktivitas)
              </h3>
              <p className="text-[14.5px] font-normal text-[#475E7A]">
                Setiap baris merepresentasikan aktivitas yang tercatat beserta detail produk, jumlah set, teknisi, dan status pengerjaannya.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13.5px] font-bold text-[#102B50]">
                  <th className="py-3.5 px-4 whitespace-nowrap">Tanggal</th>
                  <th className="py-3.5 px-4">Proyek</th>
                  <th className="py-3.5 px-4">Pelanggan</th>
                  <th className="py-3.5 px-4">Teknisi</th>
                  <th className="py-3.5 px-4">Jenis Aktivitas</th>
                  <th className="py-3.5 px-4">Produk &amp; Set</th>
                  <th className="py-3.5 px-4">Status Pekerjaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F9] text-[14.5px]">
                {computation.filteredActivities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 px-4 text-center text-[#475E7A] font-medium"
                    >
                      Tidak ada aktivitas pekerjaan yang sesuai dengan filter pemantauan.
                    </td>
                  </tr>
                ) : (
                  computation.filteredActivities.map((act) => {
                    const condStyle = CONDITION_BADGE_STYLES[act.monitoringCondition];
                    return (
                      <tr
                        key={act.id}
                        className="hover:bg-[#F8FBFF] transition-colors align-top"
                      >
                        <td className="py-4 px-4 whitespace-nowrap tabular-nums">
                          <div className="font-bold text-[#102B50]">{act.startDate}</div>
                          {act.endDate && act.endDate !== act.startDate && (
                            <div className="text-[13px] font-medium text-[#475E7A]">
                              s/d {act.endDate}
                            </div>
                          )}
                          <div className="text-[13px] font-normal text-[#475E7A] mt-0.5">
                            {act.scheduledTimeSlot}
                          </div>
                          {act.isCrossMonth && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#EBF5FF] text-[#1D4ED8] text-[12px] font-semibold">
                              Lintas Bulan
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-[#2368B5] tabular-nums text-[13.5px]">
                            {act.projectCode}
                          </div>
                          <div className="font-semibold text-[#102B50] mt-0.5">
                            {act.projectTitle}
                          </div>
                          <div className="text-[13px] font-medium text-[#475E7A] mt-1">
                            Kondisi Proyek: {act.effectiveProjectCondition}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-semibold text-[#102B50]">
                            {act.customerName}
                          </div>
                          <div className="text-[13.5px] font-normal text-[#475E7A] mt-0.5">
                            {act.installationAddress}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-medium text-[#102B50]">
                            {formatAssignedTechniciansColumn(act.technicians)}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-[#F0F7FF] text-[#2368B5] text-[13px] font-bold">
                            {act.activityType}
                          </span>
                          <div className="text-[14px] font-medium text-[#102B50] mt-1">
                            {act.title}
                          </div>
                          {act.notes && (
                            <div className="text-[13px] font-normal text-[#475E7A] mt-0.5">
                              {act.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap tabular-nums">
                          <div className="font-semibold text-[#102B50]">
                            {act.productName}
                          </div>
                          <div className="text-[13.5px] font-bold text-[#087F8C] mt-0.5">
                            {act.quantitySets} Set
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[13px] font-bold w-fit ${condStyle.bg} ${condStyle.text} ${condStyle.border}`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${condStyle.dot}`}
                              />
                              <span>{act.monitoringCondition}</span>
                            </span>

                            <select
                              aria-label={`Ubah kondisi pekerjaan ${act.activityCode}`}
                              disabled={submittingId === act.id}
                              value={act.monitoringCondition}
                              onChange={(e) =>
                                handleUpdateActivityCondition(
                                  act.id,
                                  e.target.value as MonitoringWorkCondition
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-[#DCE6F2] bg-[#F8FBFF] text-[13px] font-semibold text-[#102B50] focus:outline-none focus:border-[#2368B5] cursor-pointer"
                            >
                              {MONITORING_WORK_CONDITIONS.map((cond) => (
                                <option key={cond} value={cond}>
                                  Ubah: {cond}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ============================================================================
  // TAMPILAN 2: HALAMAN REKAP PEKERJAAN
  // ============================================================================
  return (
    <div className="w-full space-y-6">
      {bannerMessage && (
        <div
          role="status"
          className={`px-5 py-4 rounded-xl border flex items-center justify-between gap-4 text-[15px] font-medium ${
            bannerMessage.type === 'error'
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              : 'bg-[#ECFDF5] border-[#99F6E4] text-[#065F46]'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-[14px] font-semibold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 1. PANEL FILTER REKAP PEKERJAAN (Periode, Proyek, Teknisi, Aktivitas, Produk, Status) */}
      <section
        aria-label="Filter Rekap Pekerjaan"
        className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
              Filter Rekapitulasi Pekerjaan
            </h3>
            <p className="text-[14.5px] font-normal text-[#475E7A]">
              Perhitungan rekap dilakukan dari aktivitas yang tercatat di database PostgreSQL sesuai periode pelaksanaan tanpa duplikasi proyek baru.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F5F9FF] hover:bg-[#E6F0FA] text-[#2368B5] text-[14px] font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Filter</span>
            </button>
            <button
              type="button"
              onClick={fetchSnapshot}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#DCE6F2] text-[#102B50] text-[14px] font-semibold hover:bg-[#F5F9FF] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#2368B5]" />
              <span>Segarkan Data</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Filter Periode Bulan */}
          <div>
            <label
              htmlFor="rekap-period-month"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Periode Pelaksanaan
            </label>
            <select
              id="rekap-period-month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
            >
              <option value="Semua">Semua Periode</option>
              {availablePeriodMonths.map((m) => (
                <option key={m} value={m}>
                  {formatPeriodMonthLabel(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Proyek */}
          <div>
            <label
              htmlFor="rekap-project"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Proyek
            </label>
            <select
              id="rekap-project"
              value={projectIdFilter}
              onChange={(e) => setProjectIdFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
            >
              <option value="Semua">Semua Proyek</option>
              {(snapshot?.projects || []).map((prj) => (
                <option key={prj.id} value={prj.id}>
                  {prj.projectCode} — {prj.title}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Teknisi */}
          <div>
            <label
              htmlFor="rekap-technician"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Teknisi
            </label>
            <select
              id="rekap-technician"
              value={technicianIdFilter}
              onChange={(e) => setTechnicianIdFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
            >
              <option value="Semua">Semua Teknisi</option>
              {(snapshot?.technicians || []).map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Jenis Aktivitas */}
          <div>
            <label
              htmlFor="rekap-activity-type"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Jenis Aktivitas
            </label>
            <select
              id="rekap-activity-type"
              value={activityTypeFilter}
              onChange={(e) => setActivityTypeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
            >
              <option value="Semua">Semua Aktivitas</option>
              {OPERATIONAL_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Produk */}
          <div>
            <label
              htmlFor="rekap-product"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Produk
            </label>
            <select
              id="rekap-product"
              value={productNameFilter}
              onChange={(e) => setProductNameFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
            >
              <option value="Semua">Semua Produk</option>
              {(snapshot?.products || []).map((prod) => (
                <option key={prod.id} value={prod.name}>
                  {prod.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label
              htmlFor="rekap-status"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Status Pekerjaan
            </label>
            <select
              id="rekap-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-medium text-[#102B50] focus:outline-none focus:border-[#2368B5]"
            >
              <option value="Semua">Semua Status</option>
              {MONITORING_WORK_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rentang Tanggal Spesifik Opsional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div>
            <label
              htmlFor="rekap-date-from"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Rentang Tanggal Mulai (Opsional)
            </label>
            <input
              id="rekap-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-medium text-[#102B50]"
            />
          </div>
          <div>
            <label
              htmlFor="rekap-date-to"
              className="block text-[13.5px] font-semibold text-[#102B50] mb-1.5"
            >
              Rentang Tanggal Selesai (Opsional)
            </label>
            <input
              id="rekap-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-medium text-[#102B50]"
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <div className="w-full px-4 py-2.5 rounded-xl bg-[#F5F9FF] border border-[#DCE7F7] text-[13.5px] font-medium text-[#102B50] flex flex-wrap items-center justify-between gap-2">
              <span>
                Proyek Selesai Penuh (Seluruh Aktivitas Tuntas):{' '}
                <strong className="font-bold text-[#0D9488]">
                  {computation.fullyCompletedProjectsCount} dari {computation.totalProjects} Proyek
                </strong>
              </span>
              {periodMonth !== 'Semua' && (
                <span className="text-[#2368B5] font-semibold">
                  Periode {periodMonth}: {computation.newProjectsInPeriod} Proyek Baru ·{' '}
                  {computation.followUpContinuingProjectsInPeriod} Proyek Lanjutan (Bukan Proyek Baru)
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. ENAM KARTU RINGKASAN REKAP PEKERJAAN (Sesuai Daftar Resmi PROMPT 6) */}
      <section
        aria-label="Ringkasan Angka Rekap Pekerjaan"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        {/* 1. Total Proyek */}
        <div className="bg-white rounded-2xl p-5 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#102B50]">
              Total Proyek
            </span>
            <span className="w-9 h-9 rounded-xl bg-[#F0F7FF] text-[#2368B5] flex items-center justify-center shrink-0">
              <FolderKanban className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[30px] lg:text-[32px] font-extrabold text-[#102B50] tabular-nums leading-none">
            {computation.totalProjects}
          </div>
          <p className="text-[13px] font-normal text-[#475E7A] leading-snug tabular-nums">
            {periodMonth !== 'Semua'
              ? `${computation.newProjectsInPeriod} proyek baru · ${computation.followUpContinuingProjectsInPeriod} proyek lanjutan`
              : `${computation.fullyCompletedProjectsCount} selesai penuh · ${
                  computation.totalProjects - computation.fullyCompletedProjectsCount
                } belum selesai penuh`}
          </p>
        </div>

        {/* 2. Total Aktivitas */}
        <div className="bg-white rounded-2xl p-5 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#102B50]">
              Total Aktivitas
            </span>
            <span className="w-9 h-9 rounded-xl bg-[#F0F7FF] text-[#2368B5] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[30px] lg:text-[32px] font-extrabold text-[#102B50] tabular-nums leading-none">
            {computation.totalActivities}
          </div>
          <p className="text-[13px] font-normal text-[#475E7A] leading-snug">
            Dihitung berdasarkan aktivitas yang tercatat pada periode
          </p>
        </div>

        {/* 3. Total Pekerjaan Selesai */}
        <div className="bg-white rounded-2xl p-5 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#102B50]">
              Total Pekerjaan Selesai
            </span>
            <span className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#0D9488] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[30px] lg:text-[32px] font-extrabold text-[#0D9488] tabular-nums leading-none">
            {computation.totalCompletedWork}
          </div>
          <p className="text-[13px] font-normal text-[#475E7A] leading-snug tabular-nums">
            Aktivitas berstatus Selesai ({computation.completedSets} Set selesai)
          </p>
        </div>

        {/* 4. Total Pekerjaan Berjalan */}
        <div className="bg-white rounded-2xl p-5 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#102B50]">
              Total Pekerjaan Berjalan
            </span>
            <span className="w-9 h-9 rounded-xl bg-[#ECFEFF] text-[#087F8C] flex items-center justify-center shrink-0">
              <PlayCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[30px] lg:text-[32px] font-extrabold text-[#087F8C] tabular-nums leading-none">
            {computation.totalOngoingWork}
          </div>
          <p className="text-[13px] font-normal text-[#475E7A] leading-snug">
            Aktivitas yang sedang dalam pengerjaan lapangan
          </p>
        </div>

        {/* 5. Total Pekerjaan Tertunda */}
        <div className="bg-white rounded-2xl p-5 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#102B50]">
              Total Pekerjaan Tertunda
            </span>
            <span className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#D97706] flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[30px] lg:text-[32px] font-extrabold text-[#D97706] tabular-nums leading-none">
            {computation.totalPendingWork}
          </div>
          <p className="text-[13px] font-normal text-[#475E7A] leading-snug tabular-nums">
            {computation.strictDelayedWorkCount} Tertunda · {computation.notStartedWorkCount} Belum dimulai
          </p>
        </div>

        {/* 6. Total Jumlah Set */}
        <div className="bg-white rounded-2xl p-5 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#102B50]">
              Total Jumlah Set
            </span>
            <span className="w-9 h-9 rounded-xl bg-[#F0F7FF] text-[#2368B5] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[30px] lg:text-[32px] font-extrabold text-[#102B50] tabular-nums leading-none">
            {computation.totalSets}{' '}
            <span className="text-[16px] font-bold text-[#475E7A]">Set</span>
          </div>
          <p className="text-[13px] font-normal text-[#475E7A] leading-snug tabular-nums">
            Mengikuti detail pekerjaan aktivitas ({computation.completedSets} Set selesai)
          </p>
        </div>
      </section>

      {/* 3. REKAP BERDASARKAN JENIS AKTIVITAS & REKAP BERDASARKAN PRODUK */}
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        {/* 7. Total Berdasarkan Jenis Aktivitas */}
        <section
          aria-label="Total Berdasarkan Jenis Aktivitas"
          className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden flex flex-col justify-between"
        >
          <div className="p-6 border-b border-[#EEF3F9]">
            <div className="flex items-center gap-2.5">
              <Wrench className="w-5 h-5 text-[#2368B5]" />
              <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                Total Berdasarkan Jenis Aktivitas
              </h3>
            </div>
            <p className="text-[14px] font-normal text-[#475E7A] mt-1">
              Rekapitulasi jumlah aktivitas, status penyelesaian, dan jumlah set per jenis tahapan pekerjaan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13px] font-bold text-[#102B50]">
                  <th className="py-3 px-3.5">Jenis Aktivitas</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Aktivitas</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Selesai</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Berjalan</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Tertunda</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Jumlah Set</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F9] text-[14px] tabular-nums">
                {computation.byActivityType.map((item) => (
                  <tr key={item.activityType} className="hover:bg-[#F8FBFF]">
                    <td className="py-3 px-3.5 font-semibold text-[#102B50] whitespace-nowrap">
                      {item.activityType}
                    </td>
                    <td className="py-3 px-2.5 text-right font-bold text-[#102B50] whitespace-nowrap">
                      {item.totalActivities}
                    </td>
                    <td className="py-3 px-2.5 text-right font-semibold text-[#0D9488] whitespace-nowrap">
                      {item.completedActivities}
                    </td>
                    <td className="py-3 px-2.5 text-right font-semibold text-[#087F8C] whitespace-nowrap">
                      {item.ongoingActivities}
                    </td>
                    <td className="py-3 px-2.5 text-right font-semibold text-[#D97706] whitespace-nowrap">
                      {item.pendingActivities}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-[#2368B5] whitespace-nowrap">
                      {item.totalSets} Set
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F5F9FF] border-t border-[#DCE6F2] text-[14px] font-bold text-[#102B50] tabular-nums">
                  <td className="py-3.5 px-3.5 whitespace-nowrap">Total Keseluruhan</td>
                  <td className="py-3.5 px-2.5 text-right whitespace-nowrap">
                    {computation.totalActivities}
                  </td>
                  <td className="py-3.5 px-2.5 text-right text-[#0D9488] whitespace-nowrap">
                    {computation.totalCompletedWork}
                  </td>
                  <td className="py-3.5 px-2.5 text-right text-[#087F8C] whitespace-nowrap">
                    {computation.totalOngoingWork}
                  </td>
                  <td className="py-3.5 px-2.5 text-right text-[#D97706] whitespace-nowrap">
                    {computation.totalPendingWork}
                  </td>
                  <td className="py-3.5 px-3.5 text-right text-[#2368B5] whitespace-nowrap">
                    {computation.totalSets} Set
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* 8. Total Berdasarkan Produk */}
        <section
          aria-label="Total Berdasarkan Produk"
          className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden flex flex-col justify-between"
        >
          <div className="p-6 border-b border-[#EEF3F9]">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-[#087F8C]" />
              <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                Total Berdasarkan Produk
              </h3>
            </div>
            <p className="text-[14px] font-normal text-[#475E7A] mt-1">
              Perhitungan jumlah set mengikuti detail pekerjaan per produk pada setiap aktivitas yang tercatat.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13px] font-bold text-[#102B50]">
                  <th className="py-3 px-3.5">Nama Produk</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Proyek</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Aktivitas</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Selesai</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Belum Selesai</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Jumlah Set</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F9] text-[14px] tabular-nums">
                {computation.byProduct.map((prod) => (
                  <tr key={prod.productName} className="hover:bg-[#F8FBFF]">
                    <td className="py-3 px-3.5 font-semibold text-[#102B50] whitespace-nowrap">
                      {prod.productName}
                    </td>
                    <td className="py-3 px-2.5 text-right font-semibold text-[#475E7A] whitespace-nowrap">
                      {prod.distinctProjectsCount} Proyek
                    </td>
                    <td className="py-3 px-2.5 text-right font-bold text-[#102B50] whitespace-nowrap">
                      {prod.totalActivities}
                    </td>
                    <td className="py-3 px-2.5 text-right font-semibold text-[#0D9488] whitespace-nowrap">
                      {prod.completedActivities} ({prod.completedSets} Set)
                    </td>
                    <td className="py-3 px-2.5 text-right font-semibold text-[#D97706] whitespace-nowrap">
                      {prod.ongoingActivities + prod.pendingActivities}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-[#2368B5] whitespace-nowrap">
                      {prod.totalSets} Set
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F5F9FF] border-t border-[#DCE6F2] text-[14px] font-bold text-[#102B50] tabular-nums">
                  <td className="py-3.5 px-3.5 whitespace-nowrap">Total Keseluruhan</td>
                  <td className="py-3.5 px-2.5 text-right whitespace-nowrap">
                    {computation.totalProjects} Proyek
                  </td>
                  <td className="py-3.5 px-2.5 text-right whitespace-nowrap">
                    {computation.totalActivities}
                  </td>
                  <td className="py-3.5 px-2.5 text-right text-[#0D9488] whitespace-nowrap">
                    {computation.totalCompletedWork} ({computation.completedSets} Set)
                  </td>
                  <td className="py-3.5 px-2.5 text-right text-[#D97706] whitespace-nowrap">
                    {computation.totalOngoingWork + computation.totalPendingWork}
                  </td>
                  <td className="py-3.5 px-3.5 text-right text-[#2368B5] whitespace-nowrap">
                    {computation.totalSets} Set
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      {/* 4. PRODUKTIVITAS MASING-MASING TEKNISI (9. Produktivitas masing-masing teknisi) */}
      <section
        aria-label="Produktivitas Masing-Masing Teknisi"
        className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden"
      >
        <div className="p-6 border-b border-[#EEF3F9]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#2368B5]" />
            <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
              Produktivitas Masing-Masing Teknisi
            </h3>
          </div>
          <p className="text-[14.5px] font-normal text-[#475E7A] mt-1">
            Rekapitulasi beban penugasan, pekerjaan selesai, pekerjaan berjalan, pekerjaan tertunda, dan jumlah set yang ditangani oleh setiap teknisi.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13.5px] font-bold text-[#102B50]">
                <th className="py-3.5 px-4">Teknisi</th>
                <th className="py-3.5 px-4 text-right">Proyek Terlibat</th>
                <th className="py-3.5 px-4 text-right">Total Aktivitas</th>
                <th className="py-3.5 px-4 text-right">Pekerjaan Selesai</th>
                <th className="py-3.5 px-4 text-right">Pekerjaan Berjalan</th>
                <th className="py-3.5 px-4 text-right">Pekerjaan Tertunda</th>
                <th className="py-3.5 px-4 text-right">Jumlah Set Dikerjakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F9] text-[14.5px] tabular-nums">
              {computation.technicianProductivity.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 px-4 text-center text-[#475E7A] font-medium"
                  >
                    Tidak ada data produktivitas teknisi pada filter ini.
                  </td>
                </tr>
              ) : (
                computation.technicianProductivity.map((tech) => (
                  <tr key={tech.technicianId} className="hover:bg-[#F8FBFF]">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-[#DCE6F2] bg-[#F0F7FF] shrink-0 relative">
                          <Image
                            src={tech.avatarUrl || '/images/ref_exec_tech1.png'}
                            alt={tech.fullName}
                            fill
                            sizes="40px"
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-[#102B50]">{tech.fullName}</div>
                          <div className="text-[13px] font-medium text-[#475E7A]">
                            {tech.technicianCode} · {tech.specialization}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-[#102B50]">
                      {tech.distinctProjectsCount} Proyek
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-[#102B50]">
                      {tech.totalAssignedActivities} Aktivitas
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-[#0D9488]">
                      {tech.completedActivities} Selesai
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-[#087F8C]">
                      {tech.ongoingActivities} Berjalan
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-[#D97706]">
                      {tech.pendingActivities} Tertunda
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-[#2368B5]">
                        {tech.totalSetsHandled} Set
                      </span>
                      <span className="block text-[12.5px] font-medium text-[#475E7A]">
                        {tech.completedSetsHandled} Set Selesai
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. RINCIAN REKAP PEKERJAAN PER PROYEK & VERIFIKASI LINTAS BULAN */}
      <section
        aria-label="Rincian Rekap Pekerjaan per Proyek"
        className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden"
      >
        <div className="p-6 border-b border-[#EEF3F9]">
          <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
            Rincian Rekapitulasi Proyek &amp; Aktivitas Lintas Bulan ({computation.projectSummaries.length} Proyek)
          </h3>
          <p className="text-[14.5px] font-normal text-[#475E7A] mt-1">
            Setiap aktivitas lanjutan tetap terhubung ke proyek induknya tanpa dihitung sebagai proyek baru. Proyek hanya berstatus Selesai apabila seluruh aktivitas di dalamnya telah selesai.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13.5px] font-bold text-[#102B50]">
                <th className="py-3.5 px-4">Proyek &amp; Pelanggan</th>
                <th className="py-3.5 px-4">Tahapan Aktivitas pada Periode Ini</th>
                <th className="py-3.5 px-4 text-right">Total Aktivitas Proyek</th>
                <th className="py-3.5 px-4 text-right">Total Set Detail Pekerjaan</th>
                <th className="py-3.5 px-4">Kondisi Proyek Aktual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F9] text-[14.5px] align-top">
              {computation.projectSummaries.map((prj) => {
                const badge = CONDITION_BADGE_STYLES[prj.effectiveProjectCondition];
                return (
                  <tr key={prj.projectId} className="hover:bg-[#F8FBFF]">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#2368B5] tabular-nums">
                          {prj.projectCode}
                        </span>
                        {prj.hasCrossMonthActivities && (
                          <span className="px-2 py-0.5 rounded-md bg-[#EBF5FF] text-[#1D4ED8] text-[12px] font-bold">
                            Lintas Bulan
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-[#102B50] mt-0.5">
                        {prj.projectTitle}
                      </div>
                      <div className="text-[13.5px] font-normal text-[#475E7A]">
                        Pelanggan: {prj.customerName}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1.5">
                        {prj.activities.map((act) => {
                          const actStyle = CONDITION_BADGE_STYLES[act.monitoringCondition];
                          return (
                            <div
                              key={act.id}
                              className="flex flex-wrap items-center gap-2 text-[13.5px]"
                            >
                              <span className="font-semibold text-[#102B50] tabular-nums">
                                {act.startDate}:
                              </span>
                              <span className="font-bold text-[#2368B5]">
                                {act.activityType}
                              </span>
                              <span className="text-[#475E7A] tabular-nums">
                                ({act.productName} · {act.quantitySets} Set)
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[12px] font-bold ${actStyle.bg} ${actStyle.text} ${actStyle.border}`}
                              >
                                {act.monitoringCondition}
                              </span>
                              {act.isFollowUpActivity && (
                                <span className="text-[12px] font-semibold text-[#087F8C]">
                                  · Aktivitas Lanjutan
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right tabular-nums">
                      <div className="font-bold text-[#102B50]">
                        {prj.completedActivitiesCount} / {prj.totalRecordedActivities} Selesai
                      </div>
                      <div className="text-[13px] font-medium text-[#475E7A]">
                        {prj.ongoingActivitiesCount} Berjalan · {prj.pendingActivitiesCount}{' '}
                        Tertunda/Belum Mulai
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right font-bold text-[#2368B5] tabular-nums">
                      {prj.totalWorkDetailSets} Set
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[13px] font-bold ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                        <span>{prj.effectiveProjectCondition}</span>
                      </span>
                      {!prj.isFullyCompleted && prj.completedActivitiesCount > 0 && (
                        <div className="text-[12.5px] font-medium text-[#D97706] mt-1">
                          Belum dianggap selesai penuh (masih ada aktivitas belum tuntas)
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
