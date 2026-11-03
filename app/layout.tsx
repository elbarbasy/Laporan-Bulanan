import type {Metadata} from 'next';
import {Plus_Jakarta_Sans} from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ZIPBLIND Management System',
  description: 'Sistem manajemen operasional jadwal teknisi, proyek, aktivitas pekerjaan, dokumentasi, monitoring, rekap, laporan bulanan, dan dashboard pimpinan ZIPBLIND.',
  openGraph: {
    title: 'ZIPBLIND Management System',
    description: 'Sistem manajemen operasional jadwal teknisi, proyek, aktivitas pekerjaan, dokumentasi, monitoring, rekap, laporan bulanan, dan dashboard pimpinan ZIPBLIND.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZIPBLIND Management System',
    description: 'Sistem manajemen operasional jadwal teknisi, proyek, aktivitas pekerjaan, dokumentasi, monitoring, rekap, laporan bulanan, dan dashboard pimpinan ZIPBLIND.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <body
        suppressHydrationWarning
        className="font-sans bg-[#F6F9FC] text-[#102B50] antialiased selection:bg-[#2368B5]/15 selection:text-[#102B50]"
      >
        {children}
      </body>
    </html>
  );
}
