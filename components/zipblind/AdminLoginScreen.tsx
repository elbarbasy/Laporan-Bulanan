'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  LogIn,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '@/src/lib/firebase';
import ResilientImage from './ResilientAvatar';

export interface AuthenticatedAdminUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string;
}

interface AdminLoginScreenProps {
  onLoginSuccess: (admin: AuthenticatedAdminUser, expiresAt: string) => void;
  expiredReason?: string | null;
}

export default function AdminLoginScreen({
  onLoginSuccess,
  expiredReason,
}: AdminLoginScreenProps) {
  const [email, setEmail] = useState('admin@zipblind.co.id');
  const [password, setPassword] = useState('ZipblindAdmin2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(expiredReason || null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.authenticated) {
        setErrorMessage(
          data.message || 'Autentikasi gagal. Periksa kembali email dan kata sandi Admin Anda.'
        );
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess(data.admin, data.expiresAt);
    } catch {
      setErrorMessage('Gagal terhubung ke server autentikasi ZIPBLIND.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();

      if (!res.ok || !data.authenticated) {
        setErrorMessage(
          data.message || 'Akun Google Anda tidak terdaftar sebagai Administrator ZIPBLIND.'
        );
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess(data.admin, data.expiresAt);
    } catch {
      setErrorMessage('Login OAuth dibatalkan atau gagal diverifikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F0F4FF] text-[#0D2346] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-10">
      <motion.div
        initial={{ opacity: 0.95, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-5xl bg-white rounded-3xl border border-[#DCE7F7] shadow-[0_16px_48px_rgba(13,35,70,0.08)] overflow-hidden grid grid-cols-1 lg:grid-cols-12"
      >
        {/* Kolom Kiri: Identitas Visual & Aturan Keamanan Akses ZIPBLIND */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[#0E2448] via-[#123366] to-[#1754A5] text-white p-7 sm:p-9 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/10 p-1.5 flex items-center justify-center shrink-0">
                <ResilientImage
                  src="/images/ref_logo_z.png"
                  alt="Logo ZIPBLIND"
                  fallbackLabel="ZB"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="text-[21px] font-bold tracking-tight text-white leading-tight">
                  ZIPBLIND
                </div>
                <div className="text-[13.5px] font-normal text-[#B8D0F0]">
                  Management System
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/12 text-[#9AE6D5] text-[12.5px] font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Proteksi Halaman Admin Aktif</span>
              </span>
              <h1 className="text-[28px] sm:text-[30px] font-bold text-white leading-[1.2] tracking-[-0.02em]">
                Portal Autentikasi Administrator
              </h1>
              <p className="text-[14.5px] font-normal text-[#D4E4FA] leading-relaxed">
                Sistem informasi manajemen jadwal teknisi, proyek, dan monitoring operasional
                ZIPBLIND.
              </p>
            </div>

            <div className="space-y-3 pt-2 text-[14px] text-[#E2EEFD]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#20B9A4] shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold text-white">Hanya Admin:</strong> Satu-satunya
                  pengguna yang login dan mengelola seluruh 12 menu operasional.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#20B9A4] shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold text-white">Akses Pimpinan:</strong> Tidak
                  menggunakan halaman login ini; mengakses portal Read-Only via Secret Link.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#20B9A4] shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold text-white">Tanpa Akun Teknisi:</strong> Teknisi
                  tidak memiliki akun login dan registrasi publik dinonaktifkan.
                </span>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-6 border-t border-white/15 flex items-center justify-between text-[13px] text-[#B8D0F0]">
            <span>Keamanan Sesi HMAC-SHA256 &amp; RLS</span>
            <span className="font-semibold text-white">ZIPBLIND</span>
          </div>
        </div>

        {/* Kolom Kanan: Formulir Login Admin */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h2 className="text-[24px] sm:text-[26px] font-bold text-[#0D2346] tracking-[-0.015em]">
                Masuk sebagai Admin
              </h2>
              <p className="text-[14.5px] font-normal text-[#475E7A] mt-1">
                Masukkan kredensial Administrator resmi untuk membuka Dashboard Admin.
              </p>
            </div>

            {(errorMessage || expiredReason) && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-3 text-[#991B1B]"
              >
                <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                <div className="text-[14px] font-medium leading-snug">
                  {errorMessage || expiredReason}
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email-input"
                  className="block text-[14px] font-semibold text-[#0D2346]"
                >
                  Email Administrator
                </label>
                <div className="relative">
                  <Mail className="w-4.5 h-4.5 text-[#475E7A] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@zipblind.co.id"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#F5F8FF] border border-[#DCE7F7] text-[15px] font-normal text-[#0D2346] focus:outline-none focus:ring-2 focus:ring-[#2368B5]/30 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password-input"
                  className="block text-[14px] font-semibold text-[#0D2346]"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4.5 h-4.5 text-[#475E7A] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Admin"
                    className="w-full pl-11 pr-11 py-3 rounded-xl bg-[#F5F8FF] border border-[#DCE7F7] text-[15px] font-normal text-[#0D2346] focus:outline-none focus:ring-2 focus:ring-[#2368B5]/30 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#475E7A] hover:text-[#0D2346] p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#102B50] via-[#1754A5] to-[#2368B5] text-white text-[15.5px] font-semibold shadow-[0_6px_18px_rgba(23,84,165,0.28)] hover:opacity-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4.5 h-4.5" />
                <span>{isSubmitting ? 'Memverifikasi Sesi Admin...' : 'Masuk ke Dashboard Admin'}</span>
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#E2EBF5]" />
              <span className="shrink mx-3 text-[13px] font-medium text-[#475E7A]">
                atau verifikasi SSO Admin
              </span>
              <div className="flex-grow border-t border-[#E2EBF5]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleAdminLogin}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#DCE7F7] hover:bg-[#F5F8FF] text-[#0D2346] text-[14.5px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-[#2368B5]" />
              <span>Masuk dengan Akun Google Admin Terdaftar</span>
            </button>

            <div className="p-3.5 rounded-xl bg-[#F0F7FF] border border-[#DCE7F7] text-[13px] text-[#1E3A5F] space-y-1">
              <div className="font-semibold text-[#0D2346]">
                Akun Administrator Terdaftar (Database PostgreSQL):
              </div>
              <div>
                Email: <strong className="font-semibold">admin@zipblind.co.id</strong> · Sandi:{' '}
                <strong className="font-semibold">ZipblindAdmin2026!</strong>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
