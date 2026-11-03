'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldAlert, ShieldCheck, Lock, Clock, Ban } from 'lucide-react';
import ExecutiveDashboardView from '@/components/zipblind/ExecutiveDashboardView';
import ResilientImage from '@/components/zipblind/ResilientAvatar';

interface ValidatedLinkMeta {
  id: string;
  label: string;
  tokenPrefix: string;
  canDownloadReports: boolean;
  expiresAt: string;
  lastAccessedAt: string;
}

export default function ExecutiveSecretLinkPortalPage() {
  const params = useParams<{ token: string }>();
  const rawToken = typeof params?.token === 'string' ? params.token : '';

  const [status, setStatus] = useState<'validating' | 'valid' | 'denied'>('validating');
  const [errorCode, setErrorCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [linkMeta, setLinkMeta] = useState<ValidatedLinkMeta | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyToken() {
      if (!rawToken) {
        setStatus('denied');
        setErrorCode('TOKEN_MISSING');
        setErrorMessage('Token secret link tidak ditemukan pada URL.');
        return;
      }

      try {
        const res = await fetch('/api/executive/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: rawToken,
            accessAction: 'view_dashboard',
          }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (res.ok && data.valid && data.link) {
          setLinkMeta(data.link);
          setStatus('valid');
        } else {
          setErrorCode(data.code || 'ACCESS_DENIED');
          setErrorMessage(
            data.message || 'Akses ditolak: Secret link tidak valid atau telah berakhir.'
          );
          setStatus('denied');
        }
      } catch {
        if (!cancelled) {
          setErrorCode('NETWORK_ERROR');
          setErrorMessage('Gagal menghubungi server validasi keamanan ZIPBLIND.');
          setStatus('denied');
        }
      }
    }

    verifyToken();
    return () => {
      cancelled = true;
    };
  }, [rawToken]);

  const handleVerifiedDownloadLog = async () => {
    if (!rawToken) return;
    try {
      await fetch('/api/executive/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          accessAction: 'download_pdf',
        }),
      });
    } catch {
      // Abaikan jika gagal log sekunder
    }
  };

  if (status === 'validating') {
    return (
      <div className="min-h-screen bg-[#EEF4FC] text-[#0D2346] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 border border-[#DCE7F6] shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EBF3FF] text-[#1D63DC] flex items-center justify-center mx-auto animate-pulse">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-[20px] font-bold text-[#0D2346]">
            Memvalidasi Secret Link Pimpinan...
          </h1>
          <p className="text-[14.5px] font-normal text-[#475E7A]">
            Memeriksa kecocokan hash SHA-256, status pencabutan, dan masa berlaku token di server.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    const isRevoked = errorCode === 'TOKEN_REVOKED';
    const isExpired = errorCode === 'TOKEN_EXPIRED';

    return (
      <div className="min-h-screen bg-[#EEF4FC] text-[#0D2346] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#DCE7F6] shadow-[0_12px_36px_rgba(13,35,70,0.08)] max-w-lg w-full space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                <ResilientImage
                  src="/images/ref_exec_logo_z.png"
                  alt="Logo ZIPBLIND"
                  fallbackLabel="Z"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="text-[18px] font-bold text-[#0D2346] leading-tight">
                  ZIPBLIND
                </div>
                <div className="text-[13px] font-medium text-[#475E7A]">
                  Executive Portal Security Gate
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[12.5px] font-bold">
              {isRevoked ? (
                <Ban className="w-3.5 h-3.5" />
              ) : isExpired ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>{errorCode || 'ACCESS_DENIED'}</span>
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-3.5">
            <ShieldAlert className="w-6 h-6 text-[#DC2626] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h1 className="text-[20px] font-bold text-[#991B1B]">
                Akses Portal Pimpinan Ditolak
              </h1>
              <p className="text-[14.5px] font-normal text-[#7F1D1D] leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-[14px] font-normal text-[#475E7A] bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0]">
            <p className="font-semibold text-[#0D2346]">
              Ketentuan Keamanan Secret Link Pimpinan:
            </p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Pimpinan tidak menggunakan halaman login Admin.</li>
              <li>Setiap token divalidasi secara kriptografis (SHA-256) di sisi server.</li>
              <li>Token yang telah kedaluwarsa atau dicabut oleh Admin otomatis ditolak.</li>
              <li>Hubungi Administrator ZIPBLIND untuk meminta tautan Secret Link baru.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF4FC] text-[#0D2346]">
      {linkMeta && (
        <div className="w-full bg-[#0B224B] text-white px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#22C58B] shrink-0" />
            <span className="font-semibold">
              Secret Link Terverifikasi: {linkMeta.label} ({linkMeta.tokenPrefix}...)
            </span>
          </div>
          <div className="flex items-center gap-4 text-white/85 tabular-nums">
            <span>
              Berlaku s/d:{' '}
              <strong className="text-white">
                {new Date(linkMeta.expiresAt).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white font-semibold">
              Hanya Lihat &amp; Unduh Laporan (Read-Only)
            </span>
          </div>
        </div>
      )}

      <ExecutiveDashboardView
        previewMode="preview"
        isStandaloneMode={true}
        canDownloadReports={linkMeta?.canDownloadReports ?? true}
        onReportDownloadAction={handleVerifiedDownloadLog}
        secretToken={rawToken}
      />
    </div>
  );
}
