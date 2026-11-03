'use client';

import React from 'react';
import {
  Home,
  Calendar,
  Users,
  Folder,
  Image as ImageIcon,
  TrendingUp,
  ClipboardCheck,
  FileText,
  Crown,
  Bell,
  Settings,
  ChevronRight,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import ResilientImage from './ResilientAvatar';
import {
  ADMIN_SIDEBAR_MENUS,
  type AdminMenuId,
} from '@/lib/zipblind-ui-data';

interface AdminSidebarProps {
  activeMenu: AdminMenuId;
  onSelectMenu: (menuId: AdminMenuId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  notificationCount?: number;
}

const MENU_ICON_MAP: Record<AdminMenuId, React.ComponentType<{ className?: string }>> = {
  'dashboard': Home,
  'jadwal-teknisi': Calendar,
  'data-teknisi': Users,
  'data-pelanggan': Users,
  'data-project': Folder,
  'galeri-project': ImageIcon,
  'monitoring': TrendingUp,
  'rekap-pekerjaan': ClipboardCheck,
  'laporan-bulanan': FileText,
  'dashboard-pimpinan': Crown,
  'notifikasi': Bell,
  'pengaturan': Settings,
};

export default function AdminSidebar({
  activeMenu,
  onSelectMenu,
  mobileOpen,
  onCloseMobile,
  notificationCount = 3,
}: AdminSidebarProps) {
  const renderNavList = () => (
    <nav aria-label="Menu Utama Admin ZIPBLIND" className="flex-1 px-3.5 py-3 space-y-1 overflow-y-auto">
      {ADMIN_SIDEBAR_MENUS.map((item) => {
        const Icon = MENU_ICON_MAP[item.id];
        const isActive = activeMenu === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectMenu(item.id);
              onCloseMobile();
            }}
            className={`group relative w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-[14px] lg:text-[15px] font-semibold leading-snug transition-all duration-150 whitespace-nowrap shrink-0 text-left ${
              isActive
                ? 'bg-gradient-to-r from-[#1754A5] via-[#2777DB] to-[#47A4F5] text-white shadow-[0_6px_16px_rgba(39,119,219,0.35)]'
                : 'text-[#C8D9F0] hover:bg-white/8 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3.5 min-w-0">
              <Icon
                className={`w-[18px] h-[18px] shrink-0 transition-transform duration-150 ${
                  isActive ? 'text-white' : 'text-[#95B0D3] group-hover:text-white'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </span>

            {item.id === 'notifikasi' && notificationCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#EF4444] text-white text-[12px] font-bold flex items-center justify-center shrink-0 tabular-nums shadow-xs">
                {notificationCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const renderBrandHeader = () => (
    <div className="px-5 pt-6 pb-5 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
        <ResilientImage
          src="/images/ref_logo_z.png"
          alt="Logo ZIPBLIND"
          fallbackLabel="ZB"
          className="w-full h-full object-contain"
        />
      </div>
      <div className="min-w-0">
        <span className="block text-[20px] font-bold tracking-tight text-white leading-tight whitespace-nowrap truncate">
          ZIPBLIND
        </span>
        <span className="block text-[13.5px] font-normal text-[#9BB4D6] leading-tight mt-0.5 whitespace-nowrap truncate">
          Management System
        </span>
      </div>
    </div>
  );

  const renderAdminProfileCard = () => (
    <div className="p-3.5">
      <button
        type="button"
        onClick={() => onSelectMenu('pengaturan')}
        className="w-full p-3 rounded-2xl bg-[#152D58]/90 hover:bg-[#1B386B] border border-white/10 flex items-center justify-between gap-3 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/25 shrink-0 bg-white">
            <ResilientImage
              src="/images/ref_admin_avatar.png"
              alt="Admin Utama"
              fallbackLabel="AU"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-white leading-tight truncate">
              Admin Utama
            </div>
            <div className="text-[13px] font-normal text-[#9BB4D6] leading-tight mt-0.5 truncate">
              Administrator
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#9BB4D6] shrink-0" />
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[256px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-gradient-to-b from-[#0E2448] via-[#0D2040] to-[#0A1933] text-white select-none shadow-lg">
        {renderBrandHeader()}
        {renderNavList()}
        {renderAdminProfileCard()}
      </aside>

      {/* Mobile & Tablet Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0A1933]/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: -270 }}
            animate={{ x: 0 }}
            exit={{ x: -270 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-[264px] max-w-[85vw] bg-gradient-to-b from-[#0E2448] to-[#0A1933] text-white flex flex-col h-full shadow-2xl"
          >
            <div className="flex items-center justify-between pr-4">
              {renderBrandHeader()}
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Tutup Navigasi"
                className="p-2 rounded-lg text-[#9BB4D6] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavList()}
            {renderAdminProfileCard()}
          </motion.aside>
        </div>
      )}
    </>
  );
}
