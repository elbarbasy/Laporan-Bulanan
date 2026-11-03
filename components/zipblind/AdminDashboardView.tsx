'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Folder,
  Image as ImageIcon,
  FileText,
  Check,
  Clock,
  AlertCircle,
  Zap,
  TrendingUp,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Headphones,
  Gem,
  Inbox,
  Camera,
} from 'lucide-react';
import AnimatedKpiNumber from './AnimatedKpiNumber';
import ResilientImage from './ResilientAvatar';
import { AdminProjectTrendChart } from './ZipblindCharts';
import {
  PREVIEW_PROJECTS,
  PREVIEW_RECENT_ACTIVITIES,
  calculateExecutiveMetrics,
  type AdminMenuId,
  type UIPreviewStateMode,
} from '@/lib/zipblind-ui-data';

interface AdminDashboardViewProps {
  onNavigateMenu: (menuId: AdminMenuId) => void;
  previewMode: UIPreviewStateMode;
}

function MiniSparkline({
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
      viewBox="0 0 220 40"
      className="w-full h-9 overflow-visible mt-1.5"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaData} fill={`url(#${gradientId})`} />
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx={endX} cy={endY} r="3.5" fill={color} />
    </svg>
  );
}

export default function AdminDashboardView({
  onNavigateMenu,
  previewMode,
}: AdminDashboardViewProps) {
  const [periodRange, setPeriodRange] = useState<'6 Bulan Terakhir' | '12 Bulan Terakhir'>(
    '6 Bulan Terakhir'
  );

  const isEmpty = previewMode === 'empty';
  const isLoading = previewMode === 'loading';

  const projects = isEmpty ? [] : PREVIEW_PROJECTS;
  const recentActivities = isEmpty ? [] : PREVIEW_RECENT_ACTIVITIES;
  const metrics = calculateExecutiveMetrics(projects);

  if (isLoading) {
    return (
      <div className="px-4 lg:px-7 py-6 space-y-5" aria-busy="true" aria-label="Memuat Dashboard Admin">
        <div className="h-52 rounded-2xl bg-slate-200/70 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 rounded-2xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 h-72 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="lg:col-span-3 h-72 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="lg:col-span-3 h-72 rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* 1. HERO BANNER DENGAN ILUSTRASI TEKNISI 3D DI SISI KANAN */}
      <section
        aria-label="Banner Sambutan Admin Utama"
        className="relative bg-gradient-to-r from-[#CFE4FA] via-[#DAEDFD] to-[#C6E1FA] lg:overflow-visible overflow-hidden"
      >
        {/* Elemen Dekoratif Melengkung Halus */}
        <div
          className="pointer-events-none absolute -left-16 -bottom-24 w-80 h-80 rounded-full bg-white/35 blur-2xl"
          aria-hidden="true"
        />

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-center lg:h-[218px]">
          {/* Teks Sambutan di Sisi Kiri */}
          <div className="lg:col-span-5 px-6 sm:px-8 lg:pl-8 lg:pr-2 pt-6 pb-8 lg:pt-4 lg:pb-8 z-10">
            <h1 className="text-[34px] sm:text-[38px] lg:text-[40px] font-bold text-[#0D2346] leading-[1.14] tracking-[-0.02em]">
              Selamat Datang,
              <br />
              Admin Utama!
            </h1>
            <p className="text-[15px] lg:text-[15.5px] font-medium text-[#1E3A5F] mt-2.5 leading-relaxed">
              Kelola operasional ZIPBLIND dengan lebih mudah dan efisien.
            </p>
          </div>

          {/* Ilustrasi Teknisi 3D Kartun di Sisi Kanan (Topi Pop-Out di Atas Garis Banner) */}
          <div className="lg:col-span-7 relative flex justify-center lg:justify-end items-end h-[210px] lg:h-[218px]">
            <ResilientImage
              src="/images/ref_hero_mascot_seamless.png"
              alt="Maskot Teknisi 3D Kartun ZIPBLIND"
              fallbackLabel="Maskot Teknisi 3D ZIPBLIND"
              variant="mascot"
              className="w-full max-w-[840px] 2xl:max-w-[920px] h-[245px] lg:h-[264.5px] lg:-mt-[46.5px] object-cover object-right select-none pointer-events-none"
            />
          </div>
        </div>
      </section>

      {/* 2. EMPAT KARTU KPI HORIZONTAL */}
      <section
        aria-label="Ringkasan KPI Operasional"
        className="w-full px-4 sm:px-6 lg:px-7 xl:px-8 -mt-8 relative z-20"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Kartu 1: Total Project */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl pt-4 px-5 pb-2.5 border border-[#E6EEF8] shadow-[0_6px_22px_rgba(13,35,70,0.05)] flex flex-col justify-between"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#DCEBFF] flex items-center justify-center shrink-0 mt-0.5">
                <Folder className="w-5 h-5 text-[#1D63DC] fill-[#1D63DC]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-[#1E293B] leading-snug">
                  Total Project
                </h2>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[34px] lg:text-[36px] font-bold text-[#0D2346] leading-none tabular-nums">
                    <AnimatedKpiNumber value={metrics.totalProjects} />
                  </span>
                  {metrics.trends?.totalChange && (
                    <span className="text-[13.5px] font-bold text-[#10B981] whitespace-nowrap">
                      ↑ {metrics.trends.totalChange}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <MiniSparkline
              color="#2563EB"
              gradientId="spark-blue-1"
              pathData="M 4 32 Q 35 27, 62 31 T 124 25 T 176 19 T 214 10"
              areaData="M 4 32 Q 35 27, 62 31 T 124 25 T 176 19 T 214 10 L 214 40 L 4 40 Z"
              endX={214}
              endY={10}
            />
          </motion.div>

          {/* Kartu 2: Pekerjaan Selesai */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl pt-4 px-5 pb-2.5 border border-[#E6EEF8] shadow-[0_6px_22px_rgba(13,35,70,0.05)] flex flex-col justify-between"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#22C58B] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-[#1E293B] leading-snug">
                  Pekerjaan Selesai
                </h2>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[34px] lg:text-[36px] font-bold text-[#0D2346] leading-none tabular-nums">
                    <AnimatedKpiNumber value={metrics.completedProjects} />
                  </span>
                  {metrics.trends?.completedChange && (
                    <span className="text-[13.5px] font-bold text-[#10B981] whitespace-nowrap">
                      ↑ {metrics.trends.completedChange}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <MiniSparkline
              color="#10B981"
              gradientId="spark-green-2"
              pathData="M 4 32 Q 38 27, 68 31 T 130 24 T 178 18 T 214 9"
              areaData="M 4 32 Q 38 27, 68 31 T 130 24 T 178 18 T 214 9 L 214 40 L 4 40 Z"
              endX={214}
              endY={9}
            />
          </motion.div>

          {/* Kartu 3: Sedang Berjalan */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl pt-4 px-5 pb-2.5 border border-[#E6EEF8] shadow-[0_6px_22px_rgba(13,35,70,0.05)] flex flex-col justify-between"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Clock className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-[#1E293B] leading-snug">
                  Sedang Berjalan
                </h2>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[34px] lg:text-[36px] font-bold text-[#0D2346] leading-none tabular-nums">
                    <AnimatedKpiNumber value={metrics.ongoingProjects} />
                  </span>
                  {metrics.trends?.ongoingChange && (
                    <span className="text-[13.5px] font-bold text-[#2563EB] whitespace-nowrap">
                      ↑ {metrics.trends.ongoingChange}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <MiniSparkline
              color="#2563EB"
              gradientId="spark-blue-3"
              pathData="M 4 32 Q 36 28, 66 31 T 128 26 T 175 17 T 214 10"
              areaData="M 4 32 Q 36 28, 66 31 T 128 26 T 175 17 T 214 10 L 214 40 L 4 40 Z"
              endX={214}
              endY={10}
            />
          </motion.div>

          {/* Kartu 4: Tertunda */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl pt-4 px-5 pb-2.5 border border-[#E6EEF8] shadow-[0_6px_22px_rgba(13,35,70,0.05)] flex flex-col justify-between"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#F59E0B] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <AlertCircle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-[#1E293B] leading-snug">
                  Tertunda
                </h2>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[34px] lg:text-[36px] font-bold text-[#0D2346] leading-none tabular-nums">
                    <AnimatedKpiNumber value={metrics.delayedProjects} />
                  </span>
                  {metrics.trends?.delayedChange && (
                    <span className="text-[13.5px] font-bold text-[#EF4444] whitespace-nowrap">
                      ↓ {metrics.trends.delayedChange}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <MiniSparkline
              color="#F59E0B"
              gradientId="spark-amber-4"
              pathData="M 4 32 Q 36 28, 68 31 T 132 23 T 182 13 T 214 7"
              areaData="M 4 32 Q 36 28, 68 31 T 132 23 T 182 13 T 214 7 L 214 40 L 4 40 Z"
              endX={214}
              endY={7}
            />
          </motion.div>
        </div>
      </section>

      {/* 3. BAGIAN KONTEN UTAMA (TIGA AREA: GRAFIK, AKSES CEPAT, AKTIVITAS TERBARU) */}
      <section
        aria-label="Konten Utama Operasional"
        className="w-full px-4 sm:px-6 lg:px-7 xl:px-8 grid grid-cols-1 lg:grid-cols-[1.82fr_1fr_1.24fr] gap-5"
      >
        {/* Area 1: Grafik Perkembangan Pekerjaan */}
        <div className="bg-white rounded-2xl p-5 border border-[#E6EEF8] shadow-[0_6px_22px_rgba(13,35,70,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EBF3FF] text-[#1A64E0] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-[19px] xl:text-[20px] font-bold text-[#0D2346] tracking-[-0.015em]">
                  Perkembangan Pekerjaan
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPeriodRange((prev) =>
                    prev === '6 Bulan Terakhir' ? '12 Bulan Terakhir' : '6 Bulan Terakhir'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] text-[13.5px] font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <span>{periodRange}</span>
                <ChevronDown className="w-4 h-4 text-[#475569]" />
              </button>
            </div>

            {/* Legend Kanan sesuai Gambar Referensi */}
            <div className="flex items-center justify-end gap-5 mt-2 mb-1.5 text-[13.5px] font-semibold text-[#1E293B]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1A64E0]" />
                <span>Selesai</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15B8A6]" />
                <span>Dalam Proses</span>
              </span>
            </div>
          </div>

          {isEmpty ? (
            <div className="h-[180px] flex flex-col items-center justify-center text-center p-5 bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
              <Inbox className="w-7 h-7 text-[#475E7A] mb-1.5" />
              <p className="text-[15px] font-semibold text-[#0D2346]">Belum Ada Data Grafik</p>
              <p className="text-[13.5px] text-[#475E7A] max-w-sm mt-0.5">
                Grafik perkembangan pekerjaan akan tampil setelah data tersedia.
              </p>
            </div>
          ) : (
            <AdminProjectTrendChart />
          )}
        </div>

        {/* Area 2: Akses Cepat (Empat Modul 2x2 Grid) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E6EEF8] shadow-[0_6px_22px_rgba(13,35,70,0.04)] flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-[#2563EB] fill-[#2563EB]" />
            <h3 className="text-[19px] xl:text-[20px] font-bold text-[#0D2346] tracking-[-0.015em]">
              Akses Cepat
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* 1. Jadwal Teknisi */}
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              onClick={() => onNavigateMenu('jadwal-teknisi')}
              className="rounded-2xl bg-[#EEF5FF] hover:bg-[#E2EEFF] p-3 flex flex-col items-center justify-center text-center transition-colors"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs mb-2">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[14.5px] font-semibold text-[#0D2346] leading-tight">
                Jadwal
                <br />
                Teknisi
              </span>
            </motion.button>

            {/* 2. Data Project */}
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              onClick={() => onNavigateMenu('data-project')}
              className="rounded-2xl bg-[#EAFAFC] hover:bg-[#DDF6FA] p-3 flex flex-col items-center justify-center text-center transition-colors"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#14B8A6] text-white flex items-center justify-center shadow-xs mb-2">
                <Folder className="w-5 h-5" />
              </div>
              <span className="text-[14.5px] font-semibold text-[#0D2346] leading-tight">
                Data
                <br />
                Project
              </span>
            </motion.button>

            {/* 3. Galeri Project */}
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              onClick={() => onNavigateMenu('galeri-project')}
              className="rounded-2xl bg-[#F3F0FF] hover:bg-[#EAE5FF] p-3 flex flex-col items-center justify-center text-center transition-colors"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-xs mb-2">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-[14.5px] font-semibold text-[#0D2346] leading-tight">
                Galeri
                <br />
                Project
              </span>
            </motion.button>

            {/* 4. Laporan */}
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              onClick={() => onNavigateMenu('laporan-bulanan')}
              className="rounded-2xl bg-[#EAFAF4] hover:bg-[#DCF6EC] p-3 flex flex-col items-center justify-center text-center transition-colors"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#10B981] text-white flex items-center justify-center shadow-xs mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[14.5px] font-semibold text-[#0D2346] leading-tight mt-0.5">
                Laporan
              </span>
            </motion.button>
          </div>
        </div>

        {/* Area 3: Aktivitas Terbaru (Vertical Timeline) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E6EEF8] shadow-[0_6px_22px_rgba(13,35,70,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h3 className="text-[19px] xl:text-[20px] font-bold text-[#0D2346] tracking-[-0.015em] whitespace-nowrap">
                Aktivitas Terbaru
              </h3>
              <button
                type="button"
                onClick={() => onNavigateMenu('monitoring')}
                className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {isEmpty ? (
              <div className="h-[180px] flex flex-col items-center justify-center text-center p-4 bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                <Inbox className="w-7 h-7 text-[#475E7A] mb-1.5" />
                <p className="text-[15px] font-semibold text-[#0D2346]">
                  Belum Ada Aktivitas
                </p>
              </div>
            ) : (
              <div className="relative space-y-3 before:absolute before:left-[13px] before:top-3 before:bottom-3 before:w-[2px] before:bg-[#E2E8F0]">
                {recentActivities.map((act) => {
                  const badgeStyle =
                    act.iconType === 'photo'
                      ? 'bg-[#2563EB] text-white'
                      : act.iconType === 'completed'
                        ? 'bg-[#22C58B] text-white'
                        : 'bg-[#F59E0B] text-white';

                  return (
                    <div
                      key={act.id}
                      className="relative flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${badgeStyle}`}
                        >
                          {act.iconType === 'photo' ? (
                            <Camera className="w-3.5 h-3.5" />
                          ) : act.iconType === 'completed' ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <Calendar className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[14.5px] font-semibold text-[#0D2346] leading-snug">
                            {act.title}
                          </h4>
                          <p className="text-[13.5px] font-normal text-[#334155] leading-snug truncate">
                            {act.subtitle}
                          </p>
                          <span className="block text-[12.5px] font-normal text-[#64748B] leading-tight mt-0.5">
                            {act.timeAgo}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-11 h-11 shrink-0 overflow-hidden border border-[#E2E8F0] ${
                          act.isAvatar ? 'rounded-full' : 'rounded-xl'
                        }`}
                      >
                        <ResilientImage
                          src={act.thumbnailUrl}
                          alt={act.subtitle}
                          fallbackLabel="ZB"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. BANNER BAWAH IDENTITAS ZIPBLIND */}
      <section
        aria-label="Identitas ZIPBLIND"
        className="w-full px-4 sm:px-6 lg:px-7 xl:px-8"
      >
        <div className="rounded-2xl bg-gradient-to-r from-[#0D2346] via-[#153F7C] to-[#1FA4B8] text-white overflow-hidden shadow-md relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            {/* Kiri: Brand & Tagline */}
            <div className="lg:col-span-4 px-6 py-3.5 lg:py-4">
              <h3 className="text-[20px] lg:text-[21px] font-bold tracking-tight text-white leading-tight">
                ZIPBLIND
              </h3>
              <p className="text-[13.5px] lg:text-[14px] font-normal text-white/90 mt-0.5">
                Solusi Blind &amp; Shading Terbaik untuk Ruang Anda
              </p>
            </div>

            {/* Tengah: 3 Value Pillars */}
            <div className="lg:col-span-5 px-5 py-3 lg:py-4 border-t lg:border-t-0 lg:border-l border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/12 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#9AE6D5]" />
                </div>
                <span className="text-[13.5px] font-medium text-white leading-tight">
                  Profesional
                  <br />
                  &amp; Terpercaya
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/12 flex items-center justify-center shrink-0">
                  <Headphones className="w-4 h-4 text-[#9AE6D5]" />
                </div>
                <span className="text-[13.5px] font-medium text-white leading-tight">
                  Layanan
                  <br />
                  Responsif
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/12 flex items-center justify-center shrink-0">
                  <Gem className="w-4 h-4 text-[#9AE6D5]" />
                </div>
                <span className="text-[13.5px] font-medium text-white leading-tight">
                  Kualitas
                  <br />
                  Premium
                </span>
              </div>
            </div>

            {/* Kanan: Visual Produk & Tombol Tentang ZIPBLIND */}
            <button
              type="button"
              onClick={() => onNavigateMenu('galeri-project')}
              aria-label="Tentang ZIPBLIND"
              className="lg:col-span-3 relative h-20 lg:h-[74px] w-full flex items-center justify-end overflow-hidden group cursor-pointer focus:outline-none"
            >
              <ResilientImage
                src="/images/ref_bottom_blinds.png"
                alt="Tentang ZIPBLIND"
                fallbackLabel="Tentang ZIPBLIND"
                variant="gallery"
                className="w-full h-full object-cover object-right group-hover:scale-[1.02] transition-transform duration-200"
              />
              <span className="sr-only">Tentang ZIPBLIND</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
