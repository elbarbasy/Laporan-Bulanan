'use client';

import React from 'react';
import {
  Clock,
  ShieldAlert,
  Inbox,
  CheckCircle2,
  Bell,
  Lock,
} from 'lucide-react';
import ExecutiveDashboardView from './ExecutiveDashboardView';
import SecretLinkManagerPanel from './SecretLinkManagerPanel';
import OperationalModulesView from './OperationalModulesView';
import GalleryPortfolioView from './GalleryPortfolioView';
import { MonitoringRecapView } from './MonitoringRecapView';
import { MonthlyReportView } from './MonthlyReportView';
import {
  type AdminMenuId,
  type UIPreviewStateMode,
} from '@/lib/zipblind-ui-data';

interface AdminModuleViewsProps {
  activeMenu: AdminMenuId;
  previewMode: UIPreviewStateMode;
  onOpenStandaloneExecutive: () => void;
  adminEmail?: string;
  sessionExpiresAt?: string | null;
  onLogoutAdmin?: () => void;
  onSimulateExpiredSession?: () => void;
}

export default function AdminModuleViews({
  activeMenu,
  previewMode,
  onOpenStandaloneExecutive,
  adminEmail = 'admin@zipblind.co.id',
  sessionExpiresAt,
  onLogoutAdmin,
  onSimulateExpiredSession,
}: AdminModuleViewsProps) {
  const isEmpty = previewMode === 'empty';
  const isLoading = previewMode === 'loading';

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-24 rounded-2xl bg-slate-200/70 animate-pulse" />
        <div className="h-96 rounded-2xl bg-slate-200/70 animate-pulse" />
      </div>
    );
  }

  const renderEmptyCard = (title: string, desc: string) => (
    <div className="bg-white rounded-2xl p-12 border border-[#DCE6F2] text-center shadow-xs">
      <Inbox className="w-10 h-10 text-[#475E7A] mx-auto mb-3" />
      <h3 className="text-[18px] font-semibold text-[#102B50]">{title}</h3>
      <p className="text-[14px] lg:text-[15px] font-normal text-[#475E7A] max-w-md mx-auto mt-1.5 leading-relaxed">
        {desc}
      </p>
    </div>
  );

  // 2–5. MODUL OPERASIONAL TAHAP 4 (Jadwal Teknisi, Data Teknisi, Data Pelanggan, Data Project)
  if (
    activeMenu === 'jadwal-teknisi' ||
    activeMenu === 'data-teknisi' ||
    activeMenu === 'data-pelanggan' ||
    activeMenu === 'data-project'
  ) {
    return <OperationalModulesView activeMenu={activeMenu} previewMode={previewMode} />;
  }

  // 6. GALERI PROJECT (TAHAP 5 — Portfolio & Album Dokumentasi Proyek)
  if (activeMenu === 'galeri-project') {
    return <GalleryPortfolioView previewMode={previewMode} />;
  }

  // 7 & 8. MONITORING DAN REKAP PEKERJAAN (TAHAP 6 — Database PostgreSQL & Aturan Perhitungan Resmi)
  if (activeMenu === 'monitoring' || activeMenu === 'rekap-pekerjaan') {
    return <MonitoringRecapView mode={activeMenu} previewMode={previewMode} />;
  }

  // 9. LAPORAN BULANAN (TAHAP 7 — Laporan Bulanan Otomatis Tanggal 1 Bulan Berikutnya, Arsip, PDF & Excel)
  if (activeMenu === 'laporan-bulanan') {
    return <MonthlyReportView previewMode={previewMode} />;
  }

  // 10. DASHBOARD PIMPINAN (Di dalam Menu Admin + Panel Kontrol Secret Link Backend)
  if (activeMenu === 'dashboard-pimpinan') {
    return (
      <div className="space-y-6">
        {/* Pratinjau Langsung Desain Dashboard Pimpinan */}
        <div className="rounded-3xl overflow-hidden border border-[#DCE7F6] shadow-xs">
          <ExecutiveDashboardView previewMode={previewMode} />
        </div>

        {/* Panel Kontrol Secret Link Pimpinan Berbasis Backend SHA-256 */}
        <SecretLinkManagerPanel onOpenStandaloneExecutive={onOpenStandaloneExecutive} />
      </div>
    );
  }

  // 11. NOTIFIKASI
  if (activeMenu === 'notifikasi') {
    return (
      <div className="w-full">
        {isEmpty ? (
          renderEmptyCard(
            'Tidak Ada Notifikasi Baru',
            'Pemberitahuan mengenai jadwal teknisi, penyelesaian aktivitas, dan masa berlaku secret link akan muncul di sini.'
          )
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {[
              {
                id: 'notif-1',
                title: 'Kunjungan Instalasi Sedang Berlangsung',
                detail: 'Teknisi Rizky Pratama memulai pemasangan Heavy Duty Patio Zipblind di PIK 2.',
                time: 'Hari ini · 08:45 WIB',
              },
              {
                id: 'notif-2',
                title: 'Pekerjaan Lintas Bulan Teridentifikasi',
                detail: 'Proyek PRJ-ZB-26107 (Menara Nusantara Capital) dijadwalkan berlanjut ke periode November 2026.',
                time: 'Kemarin · 16:20 WIB',
              },
              {
                id: 'notif-3',
                title: 'Laporan Bulanan Oktober 2026 Siap',
                detail: 'Rekapitulasi 6 proyek (88 unit) siap diunduh dalam format PDF dan Excel.',
                time: '31 Okt 2026 · 17:30 WIB',
              },
            ].map((notif) => (
              <div
                key={notif.id}
                className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#F0F7FF] text-[#2368B5] flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[16px] lg:text-[17px] font-semibold text-[#102B50] leading-snug">
                      {notif.title}
                    </h4>
                    <span className="block text-[13.5px] font-medium text-[#2368B5] tabular-nums mt-1">
                      {notif.time}
                    </span>
                  </div>
                </div>
                <p className="text-[15px] font-normal text-[#475E7A] leading-relaxed">
                  {notif.detail}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 12. PENGATURAN (Autentikasi, Validasi Sesi, Penanganan Sesi Kedaluwarsa, & Secret Link)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 lg:p-7 border border-[#DCE6F2] shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-ocean-blue text-white flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                  Autentikasi &amp; Keamanan Sesi Admin
                </h3>
                <p className="text-[14px] font-normal text-[#475E7A]">
                  Proteksi Halaman Admin, Validasi Sesi, &amp; Role-Based Access Control
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-[12.5px] font-bold">
              Sesi Aktif
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F9FF] border border-[#DCE7F7] space-y-2 text-[14.5px]">
            <div className="flex justify-between">
              <span className="text-[#475E7A]">Email Administrator:</span>
              <strong className="font-semibold text-[#102B50]">{adminEmail}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#475E7A]">Role Otorisasi:</span>
              <strong className="font-semibold text-[#102B50]">admin (Akses Penuh 12 Menu)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#475E7A]">Masa Berlaku Sesi:</span>
              <strong className="font-semibold text-[#102B50] tabular-nums">
                {sessionExpiresAt
                  ? new Date(sessionExpiresAt).toLocaleString('id-ID')
                  : 'Terverifikasi Server'}
              </strong>
            </div>
          </div>

          <div className="space-y-2.5 text-[15px] font-normal text-[#475E7A]">
            <p className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#087F8C] shrink-0" />
              <span>Hanya Administrator yang memiliki akses login ke dalam sistem.</span>
            </p>
            <p className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#087F8C] shrink-0" />
              <span>Teknisi tidak memiliki akun login; registrasi publik dinonaktifkan.</span>
            </p>
            <p className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#087F8C] shrink-0" />
              <span>Pimpinan mengakses dashboard read-only menggunakan Secret Link berbatas waktu.</span>
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {onSimulateExpiredSession && (
              <button
                type="button"
                onClick={onSimulateExpiredSession}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] text-[14.5px] font-semibold transition-colors cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>Simulasikan Sesi Kedaluwarsa</span>
              </button>
            )}
            {onLogoutAdmin && (
              <button
                type="button"
                onClick={onLogoutAdmin}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] text-[14.5px] font-semibold transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Logout Admin</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 lg:p-7 border border-[#DCE6F2] shadow-xs space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-fresh-teal text-white flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                Parameter Sistem &amp; Keamanan Akses
              </h3>
              <p className="text-[14px] font-normal text-[#475E7A]">
                Standar keamanan dan identitas visual ZIPBLIND Management System
              </p>
            </div>
          </div>
          <div className="pt-2 space-y-3 text-[15px] font-normal text-[#475E7A]">
            <div className="flex justify-between py-2 border-b border-[#EEF3F9]">
              <span>Penyimpanan Token Secret Link</span>
              <strong className="font-semibold text-[#102B50]">SHA-256 Hash (Server-Only)</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-[#EEF3F9]">
              <span>Registrasi Publik &amp; Akun Teknisi</span>
              <strong className="font-semibold text-[#DC2626]">Diblokir (403 Forbidden)</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-[#EEF3F9]">
              <span>Hak Akses Portal Pimpinan</span>
              <strong className="font-semibold text-[#087F8C]">Read-Only (Lihat &amp; Unduh)</strong>
            </div>
            <div className="flex justify-between py-2">
              <span>Tipografi &amp; Format Ekspor</span>
              <strong className="font-semibold text-[#102B50]">Plus Jakarta Sans · PDF &amp; Excel</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Pengelolaan Secret Link Pimpinan juga dapat diakses dari Pengaturan */}
      <SecretLinkManagerPanel onOpenStandaloneExecutive={onOpenStandaloneExecutive} />
    </div>
  );
}
