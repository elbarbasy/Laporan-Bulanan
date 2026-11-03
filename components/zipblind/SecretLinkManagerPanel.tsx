'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Link2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Ban,
} from 'lucide-react';

interface SecretLinkItem {
  id: string;
  label: string;
  tokenPrefix: string;
  tokenHash: string;
  canDownloadReports: boolean;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
}

interface ExecutiveAccessLogItem {
  id: string;
  secretLinkId: string;
  accessAction: string;
  ipAddress: string | null;
  accessedAt: string;
}

interface SecretLinkManagerPanelProps {
  onOpenStandaloneExecutive: () => void;
}

export default function SecretLinkManagerPanel({
  onOpenStandaloneExecutive,
}: SecretLinkManagerPanelProps) {
  const [links, setLinks] = useState<SecretLinkItem[]>([]);
  const [accessLogs, setAccessLogs] = useState<ExecutiveAccessLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('Akses Eksekutif Pimpinan Bulanan');
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [newlyGeneratedPath, setNewlyGeneratedPath] = useState<string | null>(null);
  const [newlyGeneratedRawToken, setNewlyGeneratedRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/secret-links', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setLinks(Array.isArray(data.secretLinks) ? data.secretLinks : []);
      setAccessLogs(Array.isArray(data.accessLogs) ? data.accessLogs : []);
      setCurrentTimeMs(Date.now());
    } catch {
      // Abaikan gangguan jaringan sementara
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void fetchLinks();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchLinks]);

  const handleCreateSecretLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/admin/secret-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim() || 'Akses Eksekutif Pimpinan ZIPBLIND',
          expiresInDays,
          canDownloadReports: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.secretPath) {
        setNewlyGeneratedPath(data.secretPath);
        setNewlyGeneratedRawToken(data.rawToken);
        setStatusNotice(data.message);
        await fetchLinks();
      } else {
        setStatusNotice(data.message || 'Gagal membuat secret link baru.');
      }
    } catch {
      setStatusNotice('Gagal menghubungi server untuk membuat secret link.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActionLink = async (
    id: string,
    action: 'revoke' | 'extend' | 'expire_now'
  ) => {
    setSubmitting(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/admin/secret-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, expiresInDays: 30 }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusNotice(data.message);
        await fetchLinks();
      } else {
        setStatusNotice(data.message || 'Gagal memperbarui status secret link.');
      }
    } catch {
      setStatusNotice('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!newlyGeneratedPath) return;
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${newlyGeneratedPath}`
        : newlyGeneratedPath;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* Kartu Utama Pembuatan & Kontrol Secret Link Pimpinan */}
      <div className="bg-white rounded-2xl p-6 lg:p-7 border border-[#DCE6F2] shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#2368B5]">
              <Link2 className="w-4 h-4" />
              <span>Manajemen Keamanan Secret Link Pimpinan (SHA-256 Hashed)</span>
            </div>
            <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
              Akses Tanpa Login (Read-Only) untuk Pimpinan
            </h3>
            <p className="text-[14px] lg:text-[15px] font-normal text-[#475E7A]">
              Token dibuat secara kriptografis di backend, divalidasi di server, dan disimpan hanya
              dalam bentuk hash SHA-256 di database PostgreSQL.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenStandaloneExecutive}
            className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold shadow-xs hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buka Tampilan Terpisah Pimpinan</span>
          </button>
        </div>

        {/* Form Buat Token Secret Link Baru */}
        <form
          onSubmit={handleCreateSecretLink}
          className="p-4 sm:p-5 rounded-2xl bg-[#F5F9FF] border border-[#DCE7F7] grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
        >
          <div className="md:col-span-6 space-y-1.5">
            <label
              htmlFor="secret-link-label"
              className="block text-[14px] font-semibold text-[#102B50]"
            >
              Label Secret Link Baru
            </label>
            <input
              id="secret-link-label"
              type="text"
              required
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Contoh: Akses Pimpinan Direksi November 2026"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#DCE6F2] text-[15px] font-normal text-[#102B50] focus:outline-none focus:ring-2 focus:ring-[#2368B5]/30"
            />
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label
              htmlFor="secret-link-expiry"
              className="block text-[14px] font-semibold text-[#102B50]"
            >
              Masa Berlaku Token
            </label>
            <select
              id="secret-link-expiry"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#DCE6F2] text-[15px] font-semibold text-[#102B50] focus:outline-none focus:ring-2 focus:ring-[#2368B5]/30"
            >
              <option value={7}>7 Hari</option>
              <option value={30}>30 Hari</option>
              <option value={90}>90 Hari</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#102B50] hover:bg-[#1B3F70] text-white text-[15px] font-semibold transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Token Baru</span>
            </button>
          </div>
        </form>

        {/* Tampilan Satu Kali (One-Time Display) saat Token Baru Dibuat */}
        {newlyGeneratedPath && (
          <div className="p-4.5 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[14.5px] font-bold text-[#065F46]">
                <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                <span>Secret Link Baru Berhasil Dibuat (Ditampilkan Satu Kali)</span>
              </div>
              <span className="text-[12.5px] font-semibold text-[#047857] bg-white px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
                Disimpan sebagai SHA-256 Hash di Database
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#A7F3D0] text-[14px] font-semibold text-[#0D2346] truncate select-all tabular-nums">
                {newlyGeneratedPath}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F0FDF4] border border-[#6EE7B7] text-[#065F46] text-[14px] font-semibold transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Tersalin' : 'Salin Link'}</span>
                </button>
                <a
                  href={newlyGeneratedPath}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-semibold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Uji Buka Link Pimpinan</span>
                </a>
              </div>
            </div>
            {newlyGeneratedRawToken && (
              <p className="text-[13px] font-normal text-[#065F46]">
                Catatan Keamanan: Raw token di atas tidak pernah disimpan di kode frontend maupun di
                database. Hanya nilai hash SHA-256 yang tersimpan.
              </p>
            )}
          </div>
        )}

        {statusNotice && !newlyGeneratedPath && (
          <div className="p-3.5 rounded-xl bg-[#F0F7FF] border border-[#2368B5]/30 text-[14px] font-medium text-[#102B50] flex items-center justify-between gap-3">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-[13px] font-bold text-[#2368B5] hover:underline"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Daftar Token Secret Link di Database */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[16px] font-bold text-[#102B50]">
              Daftar Token Secret Link Terdaftar ({links.length})
            </h4>
            <button
              type="button"
              onClick={fetchLinks}
              className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#2368B5] hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang</span>
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-center text-[14px] text-[#475E7A]">
              Memuat daftar token secret link dari database...
            </div>
          ) : links.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center text-[14.5px] text-[#475E7A]">
              Belum ada token secret link pimpinan. Klik &ldquo;Buat Token Baru&rdquo; di atas untuk
              membuat tautan akses pimpinan.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#DCE6F2]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F9FF] border-b border-[#DCE6F2] text-[14px] font-semibold text-[#102B50]">
                    <th className="py-3 px-4">Label &amp; Prefix</th>
                    <th className="py-3 px-4">Hash SHA-256 (Database)</th>
                    <th className="py-3 px-4">Masa Berlaku</th>
                    <th className="py-3 px-4">Status Token</th>
                    <th className="py-3 px-4 text-right">Tindakan Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F9] text-[14.5px]">
                  {links.map((item) => {
                    const isExpired =
                      currentTimeMs > 0 && new Date(item.expiresAt).getTime() <= currentTimeMs;
                    const isActive = !item.isRevoked && !isExpired;

                    return (
                      <tr key={item.id} className="hover:bg-[#F8FBFF]">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#102B50]">{item.label}</div>
                          <div className="text-[13px] font-normal text-[#475E7A] tabular-nums">
                            Prefix: {item.tokenPrefix}... · Hak: Read-Only &amp; Unduh Laporan
                          </div>
                        </td>
                        <td className="py-3.5 px-4 tabular-nums text-[13.5px] text-[#475E7A]">
                          {item.tokenHash.slice(0, 16)}...{item.tokenHash.slice(-8)}
                        </td>
                        <td className="py-3.5 px-4 tabular-nums text-[14px] text-[#102B50]">
                          {new Date(item.expiresAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.isRevoked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[12.5px] font-bold">
                              <Ban className="w-3.5 h-3.5" />
                              <span>Dicabut</span>
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] text-[12.5px] font-bold">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Kedaluwarsa</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-[12.5px] font-bold">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Aktif</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleActionLink(item.id, 'extend')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F7FF] hover:bg-[#E1EFFE] text-[#2368B5] text-[13px] font-semibold transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Perbarui (+30 Hari)</span>
                            </button>

                            {isActive && (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleActionLink(item.id, 'revoke')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] text-[13px] font-semibold transition-colors cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Cabut Token</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Riwayat Log Akses Pimpinan */}
        {accessLogs.length > 0 && (
          <div className="pt-2 space-y-2">
            <h4 className="text-[15px] font-bold text-[#102B50]">
              Log Akses Portal Pimpinan Terbaru ({accessLogs.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {accessLogs.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[13.5px] flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-[#102B50] block">
                      Aksi: {log.accessAction}
                    </span>
                    <span className="text-[12.5px] text-[#475E7A] tabular-nums">
                      IP: {log.ipAddress || '127.0.0.1'}
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium text-[#2368B5] tabular-nums">
                    {new Date(log.accessedAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
