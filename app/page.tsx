'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Menu, Search, Bell, ChevronDown, Presentation, LogOut } from 'lucide-react';
import AdminSidebar from '@/components/zipblind/AdminSidebar';
import AdminDashboardView from '@/components/zipblind/AdminDashboardView';
import AdminModuleViews from '@/components/zipblind/AdminModuleViews';
import ExecutiveDashboardView from '@/components/zipblind/ExecutiveDashboardView';
import AdminLoginScreen, {
  type AuthenticatedAdminUser,
} from '@/components/zipblind/AdminLoginScreen';
import ResilientImage from '@/components/zipblind/ResilientAvatar';
import {
  ADMIN_SIDEBAR_MENUS,
  type AdminMenuId,
  type UIPreviewStateMode,
} from '@/lib/zipblind-ui-data';

export default function ZipblindAppPage() {
  const [activeMenu, setActiveMenu] = useState<AdminMenuId>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<UIPreviewStateMode>('preview');
  const [standaloneExecutiveMode, setStandaloneExecutiveMode] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // State Autentikasi & Proteksi Sesi Admin (Tahap 3)
  const [authChecking, setAuthChecking] = useState(true);
  const [adminUser, setAdminUser] = useState<AuthenticatedAdminUser | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const checkSessionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = await res.json();

      if (res.ok && data.authenticated && data.admin) {
        setAdminUser(data.admin);
        setSessionExpiresAt(data.expiresAt || null);
        setSessionExpiredMessage(null);
      } else {
        setAdminUser(null);
        setSessionExpiresAt(null);
        if (data.code === 'SESSION_EXPIRED') {
          setSessionExpiredMessage(
            data.message || 'Sesi login Anda telah kedaluwarsa. Silakan login kembali.'
          );
        }
      }
    } catch {
      // Biarkan pada state unauthenticated bila gagal memuat sesi
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void checkSessionStatus();
      }
    });
    return () => {
      active = false;
    };
  }, [checkSessionStatus]);

  const handleLogoutAdmin = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Lanjutkan pembersihan state lokal
    }
    setAdminUser(null);
    setSessionExpiresAt(null);
    setSessionExpiredMessage(null);
  };

  const handleSimulateExpiredSession = async () => {
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_expired' }),
      });
      await checkSessionStatus();
    } catch {
      setAdminUser(null);
      setSessionExpiredMessage('Sesi login Anda telah kedaluwarsa. Silakan login kembali.');
    }
  };

  const currentMenuMeta =
    ADMIN_SIDEBAR_MENUS.find((item) => item.id === activeMenu) ||
    ADMIN_SIDEBAR_MENUS[0];

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F0F4FF] text-[#0D2346] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl px-7 py-5 border border-[#DCE7F7] shadow-xs text-[15px] font-semibold text-[#0D2346]">
          Memverifikasi sesi keamanan Administrator ZIPBLIND...
        </div>
      </div>
    );
  }

  // Proteksi Halaman Admin: Jika belum login atau sesi telah kedaluwarsa, wajibkan Login Admin
  if (!adminUser) {
    return (
      <AdminLoginScreen
        expiredReason={sessionExpiredMessage}
        onLoginSuccess={(user, expiresAt) => {
          setAdminUser(user);
          setSessionExpiresAt(expiresAt);
          setSessionExpiredMessage(null);
        }}
      />
    );
  }

  // Mode Tampilan Terpisah Dashboard Pimpinan (Simulasi Akses via Secret Link)
  if (standaloneExecutiveMode) {
    return (
      <div className="min-h-screen bg-[#EEF4FC] text-[#0D2346]">
        <ExecutiveDashboardView
          previewMode={previewMode}
          isStandaloneMode={true}
          onExitStandalone={() => setStandaloneExecutiveMode(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F0F4FF] text-[#0D2346]">
      {/* Sidebar Admin (12 Menu Eksak) */}
      <AdminSidebar
        activeMenu={activeMenu}
        onSelectMenu={(menuId) => setActiveMenu(menuId)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        notificationCount={previewMode === 'empty' ? 0 : 3}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Horizontal sesuai Gambar Referensi */}
        <header className="bg-[#F0F4FF] px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4 border-b border-[#DCE7F7]/70">
          {/* Kiri: Tombol Menu Sidebar + Divider + Kolom Pencarian Pill + Mode Switcher */}
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((prev) => !prev)}
              aria-label="Buka Menu Navigasi"
              className="p-2 rounded-xl text-[#0D2346] hover:bg-[#E1EBF8] transition-colors shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>

            <span className="h-5 w-[1px] bg-[#CBD5E1] hidden sm:block shrink-0" aria-hidden="true" />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (globalSearchQuery.trim()) {
                  setActiveMenu('data-project');
                }
              }}
              className="relative flex-1 max-w-[420px]"
            >
              <Search className="w-4 h-4 text-[#475E7A] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Cari proyek, pelanggan, atau teknisi..."
                aria-label="Cari proyek, pelanggan, atau teknisi"
                className="w-full pl-11 pr-4 py-2 rounded-full bg-[#E3ECF8] text-[15px] font-normal text-[#0D2346] placeholder:text-[#526B8A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-shadow"
              />
            </form>

            {activeMenu !== 'dashboard' && (
              <div
                className="hidden xl:flex items-center gap-1 bg-[#E3ECF8] p-1 rounded-full ml-2"
                role="group"
                aria-label="Mode Data Pratinjau UI"
              >
                <button
                  type="button"
                  onClick={() => setPreviewMode('preview')}
                  className={`px-3 py-1 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    previewMode === 'preview'
                      ? 'bg-white text-[#0D2346] shadow-xs'
                      : 'text-[#475E7A] hover:text-[#0D2346]'
                  }`}
                >
                  Data Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('empty')}
                  className={`px-3 py-1 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    previewMode === 'empty'
                      ? 'bg-white text-[#0D2346] shadow-xs'
                      : 'text-[#475E7A] hover:text-[#0D2346]'
                  }`}
                >
                  Empty State
                </button>
                <button
                  type="button"
                  onClick={() => setStandaloneExecutiveMode(true)}
                  className="px-3 py-1 rounded-full text-[13px] font-semibold text-[#1754A5] hover:bg-white/60 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1"
                >
                  <Presentation className="w-3.5 h-3.5" />
                  <span>Portal Pimpinan</span>
                </button>
              </div>
            )}
          </div>

          {/* Kanan: Notifikasi + Avatar Admin + Tombol Logout */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Tombol Lonceng Notifikasi dengan Badge Merah 3 */}
            <button
              type="button"
              onClick={() => setActiveMenu('notifikasi')}
              aria-label="Buka Notifikasi"
              className="relative p-2 rounded-full hover:bg-[#E1EBF8] text-[#0D2346] transition-colors"
            >
              <Bell className="w-5 h-5 stroke-[2.2]" />
              {previewMode !== 'empty' && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                  3
                </span>
              )}
            </button>

            {/* Avatar Admin Utama */}
            <button
              type="button"
              onClick={() => setActiveMenu('pengaturan')}
              aria-label="Profil Admin Utama"
              className="flex items-center gap-2 p-1 rounded-full hover:bg-[#E1EBF8] transition-colors"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-xs bg-white">
                <ResilientImage
                  src={adminUser.avatarUrl || '/images/ref_admin_avatar.png'}
                  alt="Avatar Admin Utama"
                  fallbackLabel="AU"
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown className="w-4 h-4 text-[#475E7A]" />
            </button>

            {/* Tombol Logout Admin */}
            <button
              type="button"
              onClick={handleLogoutAdmin}
              aria-label="Keluar dari Sesi Admin"
              title="Logout Admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#FEF2F2] text-[#0D2346] hover:text-[#DC2626] border border-[#DCE7F7] text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Main Content Viewport (Full-Width Responsive Desktop Layout) */}
        <main className="flex-1 w-full min-w-0">
          {/* Header Modul Selain Dashboard Utama & Dashboard Pimpinan */}
          {activeMenu !== 'dashboard' && activeMenu !== 'dashboard-pimpinan' && (
            <div className="w-full px-4 sm:px-6 lg:px-7 xl:px-8 pt-6 pb-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-[30px] lg:text-[34px] font-bold text-[#0D2346] leading-[1.22] tracking-[-0.02em]">
                  {currentMenuMeta.label}
                </h1>
                <p className="text-[15px] lg:text-[16px] font-normal text-[#475E7A] mt-1 leading-relaxed">
                  {currentMenuMeta.subtitle}
                </p>
              </div>
            </div>
          )}

          <motion.div
            key={`${activeMenu}-${previewMode}`}
            initial={{ opacity: 0.96, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {activeMenu === 'dashboard' ? (
              <AdminDashboardView
                onNavigateMenu={(menuId) => setActiveMenu(menuId)}
                previewMode={previewMode}
              />
            ) : (
              <div
                className={
                  activeMenu === 'dashboard-pimpinan'
                    ? 'w-full px-3 sm:px-5 lg:px-6 py-3'
                    : 'w-full px-4 sm:px-6 lg:px-7 xl:px-8 py-5'
                }
              >
                <AdminModuleViews
                  activeMenu={activeMenu}
                  previewMode={previewMode}
                  onOpenStandaloneExecutive={() => setStandaloneExecutiveMode(true)}
                  adminEmail={adminUser.email}
                  sessionExpiresAt={sessionExpiresAt}
                  onLogoutAdmin={handleLogoutAdmin}
                  onSimulateExpiredSession={handleSimulateExpiredSession}
                />
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
