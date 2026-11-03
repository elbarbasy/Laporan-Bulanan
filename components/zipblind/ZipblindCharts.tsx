'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ScriptableContext,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { motion } from 'motion/react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const CHART_FONT_FAMILY = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
ChartJS.defaults.font.family = CHART_FONT_FAMILY;

/**
 * Grafik Perkembangan Pekerjaan (Dual Smooth Area Line Chart sesuai Gambar Referensi:
 * Sumbu X: Jul, Agu, Sep, Okt, Nov, Des
 * Sumbu Y: 0, 5, 10, 15, 20
 * Garis 1 (Biru #1A64E0): Selesai
 * Garis 2 (Teal #15B8A6): Dalam Proses)
 */
export function AdminProjectTrendChart() {
  const data = {
    labels: ['Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    datasets: [
      {
        label: 'Selesai',
        data: [9, 15, 13.8, 17, 17.5, 18],
        borderColor: '#1A64E0',
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 220);
          gradient.addColorStop(0, 'rgba(26, 100, 224, 0.22)');
          gradient.addColorStop(1, 'rgba(26, 100, 224, 0.01)');
          return gradient;
        },
        borderWidth: 2.5,
        pointBackgroundColor: '#1A64E0',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4.5,
        pointHoverRadius: 6,
        tension: 0.42,
        fill: true,
      },
      {
        label: 'Dalam Proses',
        data: [5, 10, 10, 13.5, 13.8, 14],
        borderColor: '#15B8A6',
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 220);
          gradient.addColorStop(0, 'rgba(21, 184, 166, 0.24)');
          gradient.addColorStop(1, 'rgba(21, 184, 166, 0.02)');
          return gradient;
        },
        borderWidth: 2.5,
        pointBackgroundColor: '#15B8A6',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4.5,
        pointHoverRadius: 6,
        tension: 0.42,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Ditampilkan secara presisi di header kartu sesuai gambar referensi
      },
      tooltip: {
        backgroundColor: '#0E2448',
        titleColor: '#FFFFFF',
        bodyColor: '#E2E8F0',
        titleFont: { family: CHART_FONT_FAMILY, size: 14, weight: 600 },
        bodyFont: { family: CHART_FONT_FAMILY, size: 13, weight: 500 },
        padding: 12,
        cornerRadius: 10,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(14, 36, 72, 0.05)',
        },
        border: { display: false },
        ticks: {
          color: '#334155',
          font: { family: CHART_FONT_FAMILY, size: 13, weight: 600 },
          padding: 8,
        },
      },
      y: {
        min: 0,
        max: 20,
        border: { display: false },
        grid: {
          color: 'rgba(14, 36, 72, 0.06)',
        },
        ticks: {
          color: '#334155',
          font: { family: CHART_FONT_FAMILY, size: 13, weight: 600 },
          stepSize: 5,
          padding: 10,
        },
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="h-[180px] w-full"
    >
      <Line data={data} options={options} />
    </motion.div>
  );
}

export function AdminProductDistributionChart() {
  const data = {
    labels: [
      'Motorized Outdoor Zipblind',
      'Solar Screen Zipblind',
      'Heavy Duty Patio Zipblind',
      'Interior Blackout Zipblind',
    ],
    datasets: [
      {
        data: [36, 24, 18, 10],
        backgroundColor: ['#102B50', '#2368B5', '#20B9A4', '#54BDEB'],
        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '66%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 11,
          boxHeight: 11,
          usePointStyle: true,
          padding: 16,
          color: '#102B50',
          font: { family: CHART_FONT_FAMILY, size: 13, weight: 600 },
        },
      },
      tooltip: {
        backgroundColor: '#102B50',
        titleFont: { family: CHART_FONT_FAMILY, size: 14, weight: 600 },
        bodyFont: { family: CHART_FONT_FAMILY, size: 13, weight: 500 },
        padding: 12,
        cornerRadius: 8,
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="h-[260px] w-full"
    >
      <Doughnut data={data} options={options} />
    </motion.div>
  );
}

export function ExecutiveProductDonutChart({
  labels,
  values,
  colors,
  totalSetsLabel,
}: {
  labels?: string[];
  values?: number[];
  colors?: string[];
  totalSetsLabel?: number;
} = {}) {
  const resolvedLabels =
    labels && labels.length > 0
      ? labels
      : ['Roller Blind', 'Zipblind', 'Vertical Blind', 'Venetian Blind'];
  const rawValues =
    values && values.length > 0 ? values : [28, 22, 10, 0];
  const hasNonZero = rawValues.some((v) => v > 0);
  const resolvedValues = hasNonZero ? rawValues : [1, 1, 1, 1];
  const resolvedColors =
    colors && colors.length > 0
      ? colors
      : ['#1A64E0', '#0D3B82', '#15B8A6', '#67C6F3'];
  const displayTotal =
    typeof totalSetsLabel === 'number'
      ? totalSetsLabel
      : rawValues.reduce((sum, v) => sum + v, 0);

  const data = {
    labels: resolvedLabels,
    datasets: [
      {
        data: resolvedValues,
        backgroundColor: resolvedColors,
        borderColor: '#FFFFFF',
        borderWidth: 2.5,
        hoverOffset: 4,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '66%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0E2448',
        titleFont: { family: CHART_FONT_FAMILY, size: 13, weight: 600 },
        bodyFont: { family: CHART_FONT_FAMILY, size: 13, weight: 500 },
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-[152px] h-[152px] shrink-0 mx-auto"
    >
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[25px] font-bold text-[#0D2346] leading-none tabular-nums">
          {displayTotal}
        </span>
        <span className="text-[13px] font-medium text-[#475E7A] mt-0.5">
          Set
        </span>
      </div>
    </motion.div>
  );
}

export function ExecutivePerformanceLineChart({
  labels,
  totalSetsSeries,
  completedSetsSeries,
}: {
  labels?: string[];
  totalSetsSeries?: number[];
  completedSetsSeries?: number[];
} = {}) {
  const resolvedLabels =
    labels && labels.length > 0
      ? labels
      : ['Jul 26', 'Agu 26', 'Sep 26', 'Okt 26', 'Nov 26', 'Des 26'];
  const resolvedTotalSets =
    totalSetsSeries && totalSetsSeries.length > 0
      ? totalSetsSeries
      : [0, 0, 0, 0, 60, 8];
  const resolvedCompletedSets =
    completedSetsSeries && completedSetsSeries.length > 0
      ? completedSetsSeries
      : [0, 0, 0, 0, 44, 0];

  const maxVal = Math.max(...resolvedTotalSets, ...resolvedCompletedSets, 20);
  const yMax = Math.ceil(maxVal / 20) * 20;

  const data = {
    labels: resolvedLabels,
    datasets: [
      {
        label: 'Total Set Pekerjaan',
        data: resolvedTotalSets,
        borderColor: '#1A64E0',
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 180);
          gradient.addColorStop(0, 'rgba(26, 100, 224, 0.22)');
          gradient.addColorStop(1, 'rgba(26, 100, 224, 0.01)');
          return gradient;
        },
        borderWidth: 2.5,
        pointBackgroundColor: '#1A64E0',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.38,
        fill: true,
      },
      {
        label: 'Set Selesai Terpasang',
        data: resolvedCompletedSets,
        borderColor: '#15B8A6',
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 180);
          gradient.addColorStop(0, 'rgba(21, 184, 166, 0.25)');
          gradient.addColorStop(1, 'rgba(21, 184, 166, 0.02)');
          return gradient;
        },
        borderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#15B8A6',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        tension: 0.38,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0E2448',
        titleFont: { family: CHART_FONT_FAMILY, size: 13, weight: 600 },
        bodyFont: { family: CHART_FONT_FAMILY, size: 13, weight: 500 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(14, 36, 72, 0.05)' },
        border: { display: false },
        ticks: {
          color: '#334155',
          font: { family: CHART_FONT_FAMILY, size: 12.5, weight: 600 },
          padding: 6,
        },
      },
      y: {
        min: 0,
        max: yMax,
        border: { display: false },
        grid: { color: 'rgba(14, 36, 72, 0.06)' },
        ticks: {
          color: '#334155',
          font: { family: CHART_FONT_FAMILY, size: 12.5, weight: 600 },
          stepSize: Math.max(10, Math.round(yMax / 4)),
          padding: 8,
        },
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="h-[185px] w-full"
    >
      <Line data={data} options={options} />
    </motion.div>
  );
}

