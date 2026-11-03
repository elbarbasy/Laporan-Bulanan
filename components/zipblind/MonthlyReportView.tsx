'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  CalendarCheck2,
  Camera,
  CheckCircle2,
  Clock,
  FileDown,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Layers,
  Package,
  PlayCircle,
  Printer,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { UIPreviewStateMode } from '@/lib/zipblind-ui-data';
import type {
  MonthlyReportArchiveEntry,
  OfficialMonthlyReportData,
} from '@/lib/zipblind-monthly-report';

interface MonthlyReportViewProps {
  previewMode: UIPreviewStateMode;
}

interface ExportLogEntry {
  id: string;
  reportPeriodMonth: string;
  reportTitle: string;
  exportFormat: string;
  exportedByRole: string;
  exportedAt: string;
}

export function MonthlyReportView({ previewMode }: MonthlyReportViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');
  const [reportsByPeriod, setReportsByPeriod] = useState<
    Record<string, OfficialMonthlyReportData>
  >({});
  const [archives, setArchives] = useState<MonthlyReportArchiveEntry[]>([]);
  const [exportLogs, setExportLogs] = useState<ExportLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const loadReports = useCallback(async (periodToLoad: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/monthly-reports?period=${encodeURIComponent(periodToLoad)}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
      const data = await res.json();
      if (res.ok) {
        setReportsByPeriod(data.reportsByPeriod || {});
        setArchives(data.archives || []);
        setExportLogs(data.exportLogs || []);
        if (data.selectedPeriod) {
          setSelectedPeriod(data.selectedPeriod);
        }
      } else {
        setStatusNotice({
          type: 'error',
          text: data.error || 'Gagal memuat data laporan bulanan dari database.',
        });
      }
    } catch {
      setStatusNotice({
        type: 'error',
        text: 'Tidak dapat terhubung ke server laporan bulanan.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/monthly-reports?period=2026-11', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setReportsByPeriod(data.reportsByPeriod || {});
          setArchives(data.archives || []);
          setExportLogs(data.exportLogs || []);
          if (data.selectedPeriod) {
            setSelectedPeriod(data.selectedPeriod);
          }
        } else {
          setStatusNotice({
            type: 'error',
            text: data.error || 'Gagal memuat data laporan bulanan.',
          });
        }
      } catch {
        if (!active) return;
        setStatusNotice({
          type: 'error',
          text: 'Tidak dapat terhubung ke server laporan bulanan.',
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

  // Uji / picu pembuatan otomatis laporan bulanan (dengan proteksi anti-duplikasi)
  const handleTriggerAutoGeneration = async (periodMonth: string) => {
    setGenerating(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/admin/monthly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusNotice({
          type: 'error',
          text: data.error || 'Gagal memproses pembuatan laporan bulanan.',
        });
      } else {
        setReportsByPeriod(data.reportsByPeriod || {});
        setArchives(data.archives || []);
        setExportLogs(data.exportLogs || []);
        setSelectedPeriod(periodMonth);
        setStatusNotice({
          type: data.duplicatePrevented ? 'info' : 'success',
          text: data.message,
        });
      }
    } catch {
      setStatusNotice({
        type: 'error',
        text: 'Terjadi gangguan jaringan saat memverifikasi pembuatan laporan.',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Unduh laporan resmi dalam format PDF atau Excel
  const handleDownloadReport = async (
    periodMonth: string,
    format: 'PDF' | 'EXCEL'
  ) => {
    const key = `${periodMonth}-${format}`;
    setDownloadingKey(key);
    setStatusNotice(null);
    try {
      const url = `/api/admin/monthly-reports/export?period=${encodeURIComponent(
        periodMonth
      )}&format=${format}`;
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setStatusNotice({
          type: 'error',
          text: errData.error || `Gagal mengunduh laporan ${format}.`,
        });
        return;
      }

      const blob = await res.blob();
      const ext = format === 'PDF' ? 'pdf' : 'xls';
      const downloadName = `Laporan-Bulanan-ZIPBLIND-${periodMonth}.${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      setStatusNotice({
        type: 'success',
        text: `Berhasil mengunduh dokumen resmi "${downloadName}" (${format}) dan mencatat riwayat di arsip database.`,
      });

      // Muat ulang jumlah ekspor pada arsip
      await loadReports(periodMonth);
    } catch {
      setStatusNotice({
        type: 'error',
        text: `Gagal mengunduh file ${format}.`,
      });
    } finally {
      setDownloadingKey(null);
    }
  };

  if (loading && Object.keys(reportsByPeriod).length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-[#DCE6F2] shadow-xs flex items-center justify-center gap-3 text-[#2368B5]">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-[15px] font-semibold">
          Memuat sistem Laporan Bulanan Otomatis &amp; Arsip dari database PostgreSQL...
        </span>
      </div>
    );
  }

  if (previewMode === 'empty') {
    return (
      <div className="bg-white rounded-2xl p-10 border border-[#DCE6F2] shadow-xs text-center space-y-2">
        <FileText className="w-10 h-10 text-[#2368B5] mx-auto" />
        <h3 className="text-[18px] font-bold text-[#102B50]">
          Belum Ada Arsip Laporan Bulanan pada Mode Kosong
        </h3>
        <p className="text-[15px] font-normal text-[#475E7A]">
          Laporan bulanan otomatis akan dibuat pada tanggal 1 bulan berikutnya berdasarkan aktivitas yang tercatat.
        </p>
      </div>
    );
  }

  const currentReport: OfficialMonthlyReportData | undefined =
    reportsByPeriod[selectedPeriod] || Object.values(reportsByPeriod)[0];

  if (!currentReport) {
    return null;
  }

  const activityRows = [
    {
      no: '5',
      title: 'Aktivitas Pengukuran',
      data: currentReport.measurementActivity,
    },
    {
      no: '6',
      title: 'Aktivitas Pemasangan',
      data: currentReport.installationActivity,
    },
    {
      no: '7',
      title: 'Aktivitas Survey',
      data: currentReport.surveyActivity,
    },
    {
      no: '8',
      title: 'Aktivitas Service',
      data: currentReport.serviceActivity,
    },
    {
      no: '9',
      title: 'Aktivitas Perbaikan',
      data: currentReport.repairActivity,
    },
  ];

  return (
    <div data-testid="monthly-report-view" className="w-full space-y-6">
      {statusNotice && (
        <div
          role="status"
          data-testid="report-banner-feedback"
          className={`px-5 py-4 rounded-xl border flex items-center justify-between gap-4 text-[15px] font-medium ${
            statusNotice.type === 'error'
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              : statusNotice.type === 'info'
                ? 'bg-[#EBF5FF] border-[#BFDBFE] text-[#1E3A8A]'
                : 'bg-[#ECFDF5] border-[#99F6E4] text-[#065F46]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusNotice.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0D9488]" />
            )}
            <span>{statusNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-[14px] font-semibold underline cursor-pointer shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 1. PANEL KONTROL WAKTU PEMBUATAN OTOMATIS & PENCEGAHAN DUPLIKASI */}
      <section
        aria-label="Kontrol Laporan Bulanan Otomatis"
        className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs space-y-5"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EBF5FF] text-[#2368B5] text-[13px] font-bold">
                <CalendarCheck2 className="w-4 h-4" />
                <span>Jadwal Otomatis: Tanggal 1 Bulan Berikutnya</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#ECFDF5] text-[#0D9488] text-[13px] font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Proteksi Anti-Duplikasi Periode Aktif</span>
              </span>
            </div>
            <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em] pt-1">
              Sistem Laporan Bulanan Otomatis ZIPBLIND
            </h3>
            <p className="text-[14.5px] font-normal text-[#475E7A] leading-relaxed">
              Laporan bulanan resmi dibuat otomatis setiap tanggal 1 bulan berikutnya (contoh: Laporan November dibuat pada 1 Desember; Laporan Desember dibuat pada 1 Januari) tanpa duplikasi laporan untuk periode yang sama.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EDF3FA]">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label htmlFor="select-report-period" className="sr-only">
                  Pilih Periode Laporan
                </label>
                <select
                  id="select-report-period"
                  data-testid="select-report-period"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] font-bold text-[#102B50] focus:outline-none focus:border-[#2368B5] cursor-pointer"
                >
                  {archives.map((arc) => (
                    <option key={arc.periodMonth} value={arc.periodMonth}>
                      Periode: {arc.periodLabel} (Rilis {arc.officialGeneratedDateLabel})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                data-testid="btn-auto-generate-report"
                disabled={generating}
                onClick={() => handleTriggerAutoGeneration(selectedPeriod)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E0EFFE] text-[#2368B5] border border-[#BFDBFE] text-[14px] font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                <span>Verifikasi Pembuatan Otomatis</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                data-testid="btn-download-pdf"
                disabled={downloadingKey === `${selectedPeriod}-PDF`}
                onClick={() => handleDownloadReport(selectedPeriod, 'PDF')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#102B50] hover:bg-[#1B3F70] text-white text-[14px] font-bold transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>
                  {downloadingKey === `${selectedPeriod}-PDF`
                    ? 'Mengunduh PDF...'
                    : 'Unduh PDF'}
                </span>
              </button>

              <button
                type="button"
                data-testid="btn-download-excel"
                disabled={downloadingKey === `${selectedPeriod}-EXCEL`}
                onClick={() => handleDownloadReport(selectedPeriod, 'EXCEL')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#066670] text-white text-[14px] font-bold transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>
                  {downloadingKey === `${selectedPeriod}-EXCEL`
                    ? 'Mengunduh Excel...'
                    : 'Unduh Excel'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#F5F9FF] text-[#102B50] border border-[#DCE6F2] text-[14px] font-bold transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#2368B5]" />
                <span>Cetak</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ARSIP LAPORAN BULANAN (Melihat & Mengunduh Laporan Bulan Sebelumnya) */}
      <section aria-label="Arsip Laporan Bulanan" className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
              Arsip Laporan Bulanan Resmi ({archives.length} Periode)
            </h3>
            <p className="text-[14.5px] font-normal text-[#475E7A]">
              Admin dapat melihat dan mengunduh laporan bulan sebelumnya maupun periode aktif dalam format PDF dan Excel.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {archives.map((arc) => {
            const isSelected = arc.periodMonth === selectedPeriod;
            return (
              <div
                key={arc.id}
                className={`bg-white rounded-2xl p-6 border transition-all flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'border-[#2368B5] ring-2 ring-[#2368B5]/15 shadow-sm'
                    : 'border-[#DCE6F2] shadow-xs'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[#2368B5] tabular-nums">
                      {arc.reportDocumentNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#F0F7FF] text-[#2368B5] text-[12.5px] font-bold tabular-nums">
                      Dibuat: {arc.officialGeneratedDateLabel}
                    </span>
                  </div>

                  <h4 className="text-[18px] font-bold text-[#102B50]">
                    Laporan Bulanan — {arc.periodLabel}
                  </h4>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-[13px] tabular-nums">
                    <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#E6EEF8]">
                      <span className="block text-[#475E7A]">Proyek</span>
                      <strong className="text-[15px] font-extrabold text-[#102B50]">
                        {arc.totalProjects}
                      </strong>
                      <span className="block text-[11.5px] text-[#0D9488] font-semibold">
                        {arc.completedProjects} Selesai
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#E6EEF8]">
                      <span className="block text-[#475E7A]">Aktivitas</span>
                      <strong className="text-[15px] font-extrabold text-[#102B50]">
                        {arc.totalActivities}
                      </strong>
                      <span className="block text-[11.5px] text-[#2368B5] font-semibold">
                        {arc.newProjectsCount} Baru · {arc.continuingProjectsCount} Lanjutan
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#E6EEF8]">
                      <span className="block text-[#475E7A]">Jumlah Set</span>
                      <strong className="text-[15px] font-extrabold text-[#087F8C]">
                        {arc.totalSets} Set
                      </strong>
                      <span className="block text-[11.5px] text-[#475E7A] font-semibold">
                        {arc.completedSets} Selesai
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#EEF3F9] flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod(arc.periodMonth)}
                    className={`flex-1 px-3.5 py-2 rounded-xl text-[13.5px] font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EBF5FF] text-[#2368B5]'
                        : 'bg-[#F5F9FF] hover:bg-[#E6F0FA] text-[#102B50]'
                    }`}
                  >
                    {isSelected ? 'Sedang Ditampilkan' : 'Lihat Isi Laporan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadReport(arc.periodMonth, 'PDF')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#102B50] hover:bg-[#1B3F70] text-white text-[13.5px] font-bold transition-colors cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadReport(arc.periodMonth, 'EXCEL')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#087F8C] hover:bg-[#066670] text-white text-[13.5px] font-bold transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. DOKUMEN LAPORAN BULANAN RESMI SIAP CETAK (MENCAKUP SELURUH 14 POIN SPESIFIKASI PROMPT 7) */}
      <article
        aria-label={`Dokumen Laporan Bulanan ${currentReport.periodLabel}`}
        className="bg-white rounded-3xl border border-[#DCE6F2] shadow-xs overflow-hidden print:border-none print:shadow-none"
      >
        {/* Kop Dokumen Laporan Resmi */}
        <div className="p-6 lg:p-8 bg-gradient-to-r from-[#102B50] via-[#18457C] to-[#087F8C] text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/15 text-white text-[13px] font-bold">
              <FileText className="w-4 h-4" />
              <span>DOKUMEN LAPORAN OPERASIONAL BULANAN RESMI</span>
            </div>
            <h2 className="text-[24px] lg:text-[28px] font-extrabold tracking-[-0.02em]">
              Laporan Operasional Bulanan — {currentReport.periodLabel}
            </h2>
            <p className="text-[14.5px] text-white/90 font-normal">
              Nomor Dokumen: <strong className="font-bold">{currentReport.reportDocumentNumber}</strong> ·
              Waktu Pembuatan Otomatis Resmi:{' '}
              <strong className="font-bold">{currentReport.officialGeneratedDateLabel}</strong> (Tanggal 1 Bulan Berikutnya)
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/20 text-[13.5px] space-y-1 shrink-0 tabular-nums">
            <div className="flex items-center justify-between gap-6">
              <span className="text-white/80">Periode Pelaksanaan:</span>
              <strong className="font-bold">{currentReport.periodLabel}</strong>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-white/80">Tanggal Rilis Otomatis:</span>
              <strong className="font-bold">{currentReport.officialGeneratedDate}</strong>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-white/80">Status Dokumen:</span>
              <strong className="font-bold text-[#A7F3D0]">Terverifikasi Database</strong>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8 space-y-8">
          {/* BAGIAN A: POIN 1, 2, 3, 4, DAN 10 (RINGKASAN PROYEK & TOTAL JUMLAH SET) */}
          <section aria-label="Poin 1 sampai 4 dan 10 Ringkasan Proyek dan Set" className="space-y-4">
            <div>
              <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                I. Ringkasan Proyek &amp; Total Jumlah Set (Poin 1 – 4 &amp; Poin 10)
              </h3>
              <p className="text-[14.5px] font-normal text-[#475E7A]">
                Aktivitas lanjutan pada bulan berikutnya tidak dihitung sebagai proyek baru. Proyek hanya dihitung selesai apabila seluruh aktivitasnya telah tuntas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. Total Proyek */}
              <div className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#102B50]">
                    1. Total Proyek
                  </span>
                  <FolderKanban className="w-5 h-5 text-[#2368B5]" />
                </div>
                <div className="text-[30px] font-extrabold text-[#102B50] tabular-nums leading-none">
                  {currentReport.totalProjects}
                </div>
                <p className="text-[13px] font-medium text-[#2368B5] tabular-nums">
                  {currentReport.newProjectsCount} Proyek Baru ·{' '}
                  {currentReport.continuingProjectsCount} Proyek Lanjutan
                </p>
              </div>

              {/* 2. Proyek Selesai */}
              <div className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#102B50]">
                    2. Proyek Selesai
                  </span>
                  <CheckCircle2 className="w-5 h-5 text-[#0D9488]" />
                </div>
                <div className="text-[30px] font-extrabold text-[#0D9488] tabular-nums leading-none">
                  {currentReport.completedProjects}
                </div>
                <p className="text-[13px] font-normal text-[#475E7A]">
                  Seluruh tahapan proyek selesai
                </p>
              </div>

              {/* 3. Proyek Berjalan */}
              <div className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#102B50]">
                    3. Proyek Berjalan
                  </span>
                  <PlayCircle className="w-5 h-5 text-[#087F8C]" />
                </div>
                <div className="text-[30px] font-extrabold text-[#087F8C] tabular-nums leading-none">
                  {currentReport.ongoingProjects}
                </div>
                <p className="text-[13px] font-normal text-[#475E7A]">
                  Termasuk proyek lintas bulan
                </p>
              </div>

              {/* 4. Proyek Tertunda */}
              <div className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#102B50]">
                    4. Proyek Tertunda
                  </span>
                  <Clock className="w-5 h-5 text-[#D97706]" />
                </div>
                <div className="text-[30px] font-extrabold text-[#D97706] tabular-nums leading-none">
                  {currentReport.delayedProjects}
                </div>
                <p className="text-[13px] font-normal text-[#475E7A]">
                  Menunggu kesiapan lokasi
                </p>
              </div>

              {/* 10. Total Jumlah Set */}
              <div className="p-5 rounded-2xl bg-[#F0F7FF] border border-[#BFDBFE] flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#102B50]">
                    10. Total Jumlah Set
                  </span>
                  <Layers className="w-5 h-5 text-[#2368B5]" />
                </div>
                <div className="text-[30px] font-extrabold text-[#2368B5] tabular-nums leading-none">
                  {currentReport.totalSets}{' '}
                  <span className="text-[16px] font-bold">Set</span>
                </div>
                <p className="text-[13px] font-semibold text-[#102B50] tabular-nums">
                  {currentReport.completedSets} Set Selesai pada periode ini
                </p>
              </div>
            </div>
          </section>

          {/* BAGIAN B: POIN 5, 6, 7, 8, 9 (RINCIAN 5 AKTIVITAS WAJIB: PENGUKURAN, PEMASANGAN, SURVEY, SERVICE, PERBAIKAN) */}
          <section aria-label="Poin 5 sampai 9 Rincian Aktivitas" className="space-y-4">
            <div>
              <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                II. Rekapitulasi Aktivitas Pengukuran, Pemasangan, Survey, Service, &amp; Perbaikan (Poin 5 – 9)
              </h3>
              <p className="text-[14.5px] font-normal text-[#475E7A]">
                Menampilkan pelaksanaan aktivitas pada bulan {currentReport.periodLabel} beserta pekerjaan lanjutan yang belum dilaksanakan karena dijadwalkan pada bulan berikutnya.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#DCE6F2]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13.5px] font-bold text-[#102B50]">
                    <th className="py-3.5 px-4">Kategori Aktivitas Laporan</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      Dilaksanakan Bulan Ini
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Selesai</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      Sedang Berjalan
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      Tertunda / Belum Mulai
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      Belum Dilaksanakan (Jadwal Lintas Bulan)
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      Jumlah Set Bulan Ini
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F9] text-[14.5px] tabular-nums">
                  {activityRows.map((row) => (
                    <tr key={row.no} className="hover:bg-[#F8FBFF]">
                      <td className="py-3.5 px-4 font-bold text-[#102B50]">
                        {row.no}. {row.title}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#102B50]">
                        {row.data.executedInPeriodCount} Aktivitas
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#0D9488]">
                        {row.data.completedCount} Selesai
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[#087F8C]">
                        {row.data.ongoingCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[#D97706]">
                        {row.data.delayedOrNotStartedCount}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {row.data.unexecutedFutureCrossMonthCount > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] text-[13px] font-bold">
                            {row.data.unexecutedFutureCrossMonthCount} Belum Dilaksanakan ({row.data.unexecutedFutureCrossMonthSets} Set)
                          </span>
                        ) : (
                          <span className="text-[#475E7A]">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#2368B5]">
                        {row.data.totalSetsInPeriod} Set
                      </td>
                    </tr>
                  ))}
                  {currentReport.otherActivities.map((other) => (
                    <tr key={other.activityType} className="hover:bg-[#F8FBFF] bg-[#FAFCFF]">
                      <td className="py-3.5 px-4 font-semibold text-[#475E7A]">
                        Tahap Pendukung: Aktivitas {other.activityType}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#102B50]">
                        {other.executedInPeriodCount} Aktivitas
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#0D9488]">
                        {other.completedCount} Selesai
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[#087F8C]">
                        {other.ongoingCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[#D97706]">
                        {other.delayedOrNotStartedCount}
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#475E7A]">
                        {other.unexecutedFutureCrossMonthCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#2368B5]">
                        {other.totalSetsInPeriod} Set
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* BAGIAN C: RINCIAN PEKERJAAN LINTAS BULAN PER PROYEK (Contoh Spesifikasi Proyek Rumah A) */}
          <section aria-label="Pekerjaan Lintas Bulan per Proyek" className="space-y-4">
            <div>
              <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                III. Status Pelaksanaan Proyek &amp; Pekerjaan Lintas Bulan pada {currentReport.periodLabel}
              </h3>
              <p className="text-[14.5px] font-normal text-[#475E7A]">
                Menampilkan tahapan proyek yang selesai pada bulan laporan, tahapan yang belum dilaksanakan (terjadwal pada bulan berikutnya), serta penanda proyek lanjutan agar tidak dihitung sebagai proyek baru.
              </p>
            </div>

            {currentReport.projectDetails.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] text-[14.5px] text-[#475E7A]">
                Tidak ada aktivitas proyek yang tercatat pada periode {currentReport.periodLabel}.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {currentReport.projectDetails.map((prj) => (
                  <div
                    key={prj.projectId}
                    className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
                          <span className="text-[#2368B5] tabular-nums">
                            {prj.projectCode}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md ${
                              prj.isNewProjectInPeriod
                                ? 'bg-[#EBF5FF] text-[#1D4ED8]'
                                : 'bg-[#FEF3C7] text-[#92400E]'
                            }`}
                          >
                            {prj.isNewProjectInPeriod
                              ? `Proyek Baru (${currentReport.periodLabel})`
                              : `Proyek Lanjutan dari ${prj.projectOriginMonth} (Bukan Proyek Baru)`}
                          </span>
                        </div>
                        <h4 className="text-[16.5px] font-bold text-[#102B50] mt-1">
                          {prj.projectTitle}
                        </h4>
                        <p className="text-[13.5px] font-normal text-[#475E7A]">
                          Pelanggan: {prj.customerName} · {prj.installationAddress}
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-xl text-[13px] font-bold ${
                          prj.statusInPeriod === 'Selesai'
                            ? 'bg-[#ECFDF5] text-[#0D9488] border border-[#99F6E4]'
                            : prj.statusInPeriod === 'Berjalan'
                              ? 'bg-[#ECFEFF] text-[#087F8C] border border-[#A5F3FC]'
                              : 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                        }`}
                      >
                        Proyek {prj.statusInPeriod}
                      </span>
                    </div>

                    {/* Aktivitas yang dilaksanakan pada bulan ini */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[13px] font-bold text-[#102B50]">
                        Tahapan pada Bulan {currentReport.periodLabel}:
                      </div>
                      {prj.activitiesInPeriod.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 rounded-xl bg-white border border-[#E2ECF7] flex flex-wrap items-center justify-between gap-2 text-[13.5px]"
                        >
                          <div>
                            <span className="font-bold text-[#102B50]">
                              {act.activityType}
                            </span>{' '}
                            <span className="text-[#475E7A] tabular-nums">
                              ({act.startDate})
                            </span>{' '}
                            ·{' '}
                            <span className="font-semibold text-[#2368B5] tabular-nums">
                              {act.productName} ({act.quantitySets} Set)
                            </span>
                            <div className="text-[12.5px] text-[#475E7A]">
                              Teknisi: {act.techniciansText}
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[12.5px] font-bold ${
                              act.condition === 'Selesai'
                                ? 'bg-[#ECFDF5] text-[#0D9488]'
                                : act.condition === 'Sedang berjalan'
                                  ? 'bg-[#ECFEFF] text-[#087F8C]'
                                  : 'bg-[#FFFBEB] text-[#D97706]'
                            }`}
                          >
                            {act.condition}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Pekerjaan Lanjutan yang Belum Dilaksanakan pada Bulan Ini */}
                    {prj.unexecutedFollowUpActivities.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[13px] font-bold text-[#B45309]">
                          Pekerjaan Proyek Ini yang Belum Dilaksanakan pada {currentReport.periodLabel}:
                        </div>
                        {prj.unexecutedFollowUpActivities.map((fut) => (
                          <div
                            key={fut.id}
                            className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-wrap items-center justify-between gap-2 text-[13.5px]"
                          >
                            <div>
                              <span className="font-bold text-[#92400E]">
                                {fut.activityType}
                              </span>{' '}
                              ·{' '}
                              <span className="font-semibold text-[#92400E] tabular-nums">
                                {fut.productName} ({fut.quantitySets} Set)
                              </span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-lg bg-white border border-[#FDE68A] text-[#B45309] text-[12.5px] font-bold">
                              {fut.statusLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* BAGIAN D: POIN 11 (REKAP BERDASARKAN PRODUK) & POIN 12 (PRODUKTIVITAS TEKNISI) */}
          <section aria-label="Poin 11 dan 12 Rekap Produk dan Teknisi" className="space-y-6">
            {/* 11. Rekap Berdasarkan Produk */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#087F8C]" />
                <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                  IV. Rekap Berdasarkan Produk (Poin 11)
                </h3>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#DCE6F2]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13.5px] font-bold text-[#102B50]">
                      <th className="py-3.5 px-4">Nama Produk</th>
                      <th className="py-3.5 px-4 text-right">Proyek Terkait</th>
                      <th className="py-3.5 px-4 text-right">Total Aktivitas</th>
                      <th className="py-3.5 px-4 text-right">Aktivitas Selesai</th>
                      <th className="py-3.5 px-4 text-right">Belum Selesai</th>
                      <th className="py-3.5 px-4 text-right">Total Jumlah Set</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F9] text-[14.5px] tabular-nums">
                    {currentReport.productRecap.map((prod) => (
                      <tr key={prod.productName} className="hover:bg-[#F8FBFF]">
                        <td className="py-3.5 px-4 font-bold text-[#102B50]">
                          {prod.productName}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#475E7A]">
                          {prod.projectsCount} Proyek
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#102B50]">
                          {prod.activitiesCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#0D9488]">
                          {prod.completedActivitiesCount} ({prod.completedSets} Set)
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#D97706]">
                          {prod.incompleteActivitiesCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#2368B5]">
                          {prod.totalSets} Set
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 12. Produktivitas Teknisi */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#2368B5]" />
                <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                  V. Produktivitas Teknisi (Poin 12)
                </h3>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#DCE6F2]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13.5px] font-bold text-[#102B50]">
                      <th className="py-3.5 px-4">Teknisi</th>
                      <th className="py-3.5 px-4 text-right">Proyek</th>
                      <th className="py-3.5 px-4 text-right">Total Aktivitas</th>
                      <th className="py-3.5 px-4 text-right">Selesai</th>
                      <th className="py-3.5 px-4 text-right">Berjalan</th>
                      <th className="py-3.5 px-4 text-right">Tertunda</th>
                      <th className="py-3.5 px-4 text-right">Jumlah Set Dikerjakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F9] text-[14.5px] tabular-nums">
                    {currentReport.technicianProductivity.map((tech) => (
                      <tr key={tech.technicianId} className="hover:bg-[#F8FBFF]">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-[#DCE6F2] bg-[#F0F7FF] relative shrink-0">
                              <Image
                                src={tech.avatarUrl || '/images/ref_exec_tech1.png'}
                                alt={tech.fullName}
                                fill
                                sizes="36px"
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-[#102B50]">
                                {tech.fullName}
                              </div>
                              <div className="text-[12.5px] text-[#475E7A]">
                                {tech.technicianCode} · {tech.specialization}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#102B50]">
                          {tech.projectsCount} Proyek
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#102B50]">
                          {tech.totalActivities}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0D9488]">
                          {tech.completedActivities}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#087F8C]">
                          {tech.ongoingActivities}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#D97706]">
                          {tech.pendingActivities}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#2368B5]">
                          {tech.totalSetsHandled} Set ({tech.completedSetsHandled} Selesai)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* BAGIAN E: POIN 13 (DOKUMENTASI FOTO JIKA TERSEDIA) */}
          <section aria-label="Poin 13 Dokumentasi Foto" className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#2368B5]" />
              <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                VI. Dokumentasi Foto Proyek (Poin 13 — {currentReport.photoDocumentation.length} Foto Tersedia)
              </h3>
            </div>

            {currentReport.photoDocumentation.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] text-[14.5px] text-[#475E7A]">
                Tidak ada lampiran dokumentasi foto pada periode {currentReport.periodLabel}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentReport.photoDocumentation.map((ph) => (
                  <div
                    key={ph.id}
                    className="rounded-2xl border border-[#DCE6F2] bg-[#F8FBFF] overflow-hidden flex flex-col justify-between"
                  >
                    <div className="relative h-40 w-full bg-[#E6F0FA]">
                      <Image
                        src={ph.imageUrl}
                        alt={ph.caption}
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#102B50]/85 text-white text-[12px] font-bold">
                        {ph.documentationCategory}
                      </span>
                    </div>
                    <div className="p-3.5 space-y-1">
                      <div className="text-[12.5px] font-bold text-[#2368B5] tabular-nums">
                        {ph.projectCode} · {ph.activityType}
                      </div>
                      <div className="text-[13.5px] font-bold text-[#102B50] line-clamp-1">
                        {ph.projectTitle}
                      </div>
                      <p className="text-[13px] font-normal text-[#475E7A] line-clamp-2">
                        {ph.caption}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* BAGIAN F: POIN 14 (PERBANDINGAN DENGAN BULAN SEBELUMNYA) */}
          <section
            aria-label="Poin 14 Perbandingan dengan Bulan Sebelumnya"
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#087F8C]" />
              <h3 className="text-[19px] lg:text-[21px] font-bold text-[#102B50] tracking-[-0.015em]">
                VII. Perbandingan dengan Bulan Sebelumnya —{' '}
                {currentReport.previousMonthComparison.previousPeriodLabel} (Poin 14)
              </h3>
            </div>
            <p className="text-[14.5px] font-normal text-[#475E7A]">
              {currentReport.previousMonthComparison.summaryNarrative}
            </p>

            <div className="overflow-x-auto rounded-2xl border border-[#DCE6F2]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[13.5px] font-bold text-[#102B50]">
                    <th className="py-3.5 px-4">Indikator Perbandingan</th>
                    <th className="py-3.5 px-4 text-right">
                      Bulan Sebelumnya ({currentReport.previousMonthComparison.previousPeriodLabel})
                    </th>
                    <th className="py-3.5 px-4 text-right">
                      Bulan Laporan ({currentReport.periodLabel})
                    </th>
                    <th className="py-3.5 px-4 text-right">Selisih Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F9] text-[14.5px] tabular-nums">
                  <tr>
                    <td className="py-3.5 px-4 font-semibold text-[#102B50]">
                      Total Proyek Aktif
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#475E7A]">
                      {currentReport.previousMonthComparison.previousTotalProjects} Proyek
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#102B50]">
                      {currentReport.totalProjects} Proyek ({currentReport.newProjectsCount} Baru,{' '}
                      {currentReport.continuingProjectsCount} Lanjutan)
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#2368B5]">
                      {currentReport.previousMonthComparison.deltaTotalProjects >= 0
                        ? `+${currentReport.previousMonthComparison.deltaTotalProjects}`
                        : currentReport.previousMonthComparison.deltaTotalProjects}{' '}
                      Proyek
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-semibold text-[#102B50]">
                      Proyek Selesai Penuh
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#475E7A]">
                      {currentReport.previousMonthComparison.previousCompletedProjects} Proyek
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0D9488]">
                      {currentReport.completedProjects} Proyek
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0D9488]">
                      {currentReport.previousMonthComparison.deltaCompletedProjects >= 0
                        ? `+${currentReport.previousMonthComparison.deltaCompletedProjects}`
                        : currentReport.previousMonthComparison.deltaCompletedProjects}{' '}
                      Proyek
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-semibold text-[#102B50]">
                      Total Aktivitas Dilaksanakan
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#475E7A]">
                      {currentReport.previousMonthComparison.previousTotalActivities} Aktivitas
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#102B50]">
                      {currentReport.totalActivitiesInPeriod} Aktivitas
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#2368B5]">
                      {currentReport.previousMonthComparison.deltaTotalActivities >= 0
                        ? `+${currentReport.previousMonthComparison.deltaTotalActivities}`
                        : currentReport.previousMonthComparison.deltaTotalActivities}{' '}
                      Aktivitas
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-semibold text-[#102B50]">
                      Total Jumlah Set Pekerjaan
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#475E7A]">
                      {currentReport.previousMonthComparison.previousTotalSets} Set
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#087F8C]">
                      {currentReport.totalSets} Set ({currentReport.completedSets} Set Selesai)
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#087F8C]">
                      {currentReport.previousMonthComparison.deltaTotalSets >= 0
                        ? `+${currentReport.previousMonthComparison.deltaTotalSets}`
                        : currentReport.previousMonthComparison.deltaTotalSets}{' '}
                      Set
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Riwayat Unduhan Laporan (Log Database report_export_logs) */}
          {exportLogs.length > 0 && (
            <section
              aria-label="Riwayat Unduhan Laporan Bulanan"
              className="pt-4 border-t border-[#EEF3F9] space-y-2.5"
            >
              <h4 className="text-[15px] font-bold text-[#102B50]">
                Riwayat Ekspor Laporan Resmi Terakhir (Database PostgreSQL)
              </h4>
              <div className="flex flex-wrap gap-2.5">
                {exportLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="px-3.5 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE6F2] text-[13px] text-[#475E7A] tabular-nums flex items-center gap-2"
                  >
                    <span className="px-2 py-0.5 rounded-md bg-[#EBF5FF] text-[#2368B5] font-bold">
                      {log.exportFormat}
                    </span>
                    <span className="font-semibold text-[#102B50]">
                      {log.reportTitle}
                    </span>
                    <span>
                      · {new Date(log.exportedAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
