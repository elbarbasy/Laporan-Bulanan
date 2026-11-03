'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FolderKanban,
  Layers,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import ResilientImage from './ResilientAvatar';
import {
  OPERATIONAL_ACTIVITY_TYPES,
  OPERATIONAL_STATUS_LIST,
  TECHNICIAN_AVATAR_PRESETS,
  filterSchedulesByCalendarMode,
  formatAssignedTechniciansColumn,
  summarizeActivitiesByPeriodAndStatus,
  type CalendarViewMode,
  type OperationalActivityRecord,
  type OperationalActivityType,
  type OperationalStatus,
} from '@/lib/zipblind-operational';
import type { UIPreviewStateMode } from '@/lib/zipblind-ui-data';

interface TechnicianRecord {
  id: string;
  technicianCode: string;
  fullName: string;
  phone: string;
  specialization: string;
  avatarUrl: string;
  isActive: boolean;
  totalAssignedActivities: number;
  completedActivities: number;
}

interface ProjectRecord {
  id: string;
  projectCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  title: string;
  installationAddress: string;
  description: string;
  status: OperationalStatus;
  startDate: string;
  targetEndDate: string;
  completedAt: string | null;
  totalActivities: number;
  completedActivities: number;
  incompleteActivities: number;
  totalQuantitySets: number;
  primaryProductName: string;
  latestActivitySummary: string;
  isCrossMonth: boolean;
  activities: OperationalActivityRecord[];
}

interface CustomerRecord {
  id: string;
  customerCode: string;
  fullName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
  totalProjects: number;
  projects: ProjectRecord[];
}

interface ProductItem {
  id: string;
  name: string;
  unitLabel: string;
}

interface OperationalSnapshot {
  technicians: TechnicianRecord[];
  customers: CustomerRecord[];
  projects: ProjectRecord[];
  activities: OperationalActivityRecord[];
  products: ProductItem[];
}

interface OperationalModulesViewProps {
  activeMenu: 'jadwal-teknisi' | 'data-teknisi' | 'data-pelanggan' | 'data-project';
  previewMode: UIPreviewStateMode;
}

function getStatusBadgeClasses(status: OperationalStatus): string {
  switch (status) {
    case 'Selesai':
      return 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]';
    case 'Sedang Berjalan':
      return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
    case 'Dijadwalkan':
      return 'bg-[#F0F7FF] text-[#2368B5] border-[#DCE6F2]';
    case 'Tertunda':
      return 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]';
    case 'Dibatalkan':
      return 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]';
    default:
      return 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]';
  }
}

export default function OperationalModulesView({
  activeMenu,
  previewMode,
}: OperationalModulesViewProps) {
  const [snapshot, setSnapshot] = useState<OperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filter Jadwal Teknisi (Kalender Harian, Mingguan, Bulanan)
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('bulanan');
  const [anchorDate, setAnchorDate] = useState<string>('2026-11-10');
  const [showAllDates, setShowAllDates] = useState<boolean>(false);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'Semua' | OperationalStatus>(
    'Semua'
  );

  // Filter Data Project & Rekap Tanggal Pelaksanaan
  const [projectStatusFilter, setProjectStatusFilter] = useState<'Semua' | OperationalStatus>(
    'Semua'
  );
  const [projectSearch, setProjectSearch] = useState<string>('');
  const [recapMonthFilter, setRecapMonthFilter] = useState<string>('2026-11');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Modal States
  // 1. Modal Jadwal / Aktivitas Proyek
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [actFormProjectId, setActFormProjectId] = useState<string>('');
  const [actFormType, setActFormType] = useState<OperationalActivityType>('Pemasangan');
  const [actFormTitle, setActFormTitle] = useState<string>('');
  const [actFormStartDate, setActFormStartDate] = useState<string>('2026-11-10');
  const [actFormEndDate, setActFormEndDate] = useState<string>('2026-11-10');
  const [actFormTimeSlot, setActFormTimeSlot] = useState<string>('09:00 - 14:00 WIB');
  const [actFormProductId, setActFormProductId] = useState<string>('');
  const [actFormQuantitySets, setActFormQuantitySets] = useState<number>(6);
  const [actFormStatus, setActFormStatus] = useState<OperationalStatus>('Dijadwalkan');
  const [actFormNotes, setActFormNotes] = useState<string>('');
  const [actFormTechIds, setActFormTechIds] = useState<string[]>([]);

  // 2. Modal Data Teknisi
  const [techModalOpen, setTechModalOpen] = useState(false);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [techFormName, setTechFormName] = useState<string>('');
  const [techFormPhone, setTechFormPhone] = useState<string>('');
  const [techFormSpec, setTechFormSpec] = useState<string>('');
  const [techFormAvatar, setTechFormAvatar] = useState<string>('/images/ref_exec_tech1.png');
  const [techFormActive, setTechFormActive] = useState<boolean>(true);

  // 3. Modal Data Pelanggan & Modal Riwayat Proyek Pelanggan
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [custFormName, setCustFormName] = useState<string>('');
  const [custFormContact, setCustFormContact] = useState<string>('');
  const [custFormPhone, setCustFormPhone] = useState<string>('');
  const [custFormEmail, setCustFormEmail] = useState<string>('');
  const [custFormCity, setCustFormCity] = useState<string>('Jakarta Selatan');
  const [custFormAddress, setCustFormAddress] = useState<string>('');
  const [custFormNotes, setCustFormNotes] = useState<string>('');
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);

  // 4. Modal Data Project
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projFormCustomerId, setProjFormCustomerId] = useState<string>('');
  const [projFormTitle, setProjFormTitle] = useState<string>('');
  const [projFormAddress, setProjFormAddress] = useState<string>('');
  const [projFormDesc, setProjFormDesc] = useState<string>('');
  const [projFormStartDate, setProjFormStartDate] = useState<string>('2026-11-10');
  const [projFormTargetDate, setProjFormTargetDate] = useState<string>('2026-12-15');
  const [projFormStatus, setProjFormStatus] = useState<OperationalStatus>('Sedang Berjalan');

  const fetchOperationalData = useCallback(async () => {
    setLoading((prev) => prev);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.ok && data) {
        setSnapshot(data);
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setExpandedProjectId((prev) => prev || data.projects[0].id);
        }
      } else {
        setBannerNotice({
          type: 'error',
          text: data.error || 'Gagal memuat data operasional dari database.',
        });
      }
    } catch {
      setBannerNotice({
        type: 'error',
        text: 'Gagal menghubungi server operasional.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchOperationalData();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchOperationalData]);

  // Helper buka modal Tambah/Ubah Jadwal (Aktivitas)
  const openAddScheduleModal = (preselectedProjectId?: string) => {
    const defaultProj =
      snapshot?.projects.find((p) => p.id === preselectedProjectId) || snapshot?.projects[0];
    const defaultProd = snapshot?.products[0];
    const defaultTech = snapshot?.technicians.find((t) => t.isActive) || snapshot?.technicians[0];

    setEditingActivityId(null);
    setActFormProjectId(defaultProj?.id || '');
    setActFormType('Pemasangan');
    setActFormTitle(defaultProj ? `Pemasangan ${defaultProj.title}` : 'Pemasangan Zipblind');
    setActFormStartDate(anchorDate || '2026-11-10');
    setActFormEndDate(anchorDate || '2026-11-10');
    setActFormTimeSlot('09:00 - 15:00 WIB');
    setActFormProductId(defaultProd?.id || '');
    setActFormQuantitySets(6);
    setActFormStatus('Dijadwalkan');
    setActFormNotes('');
    setActFormTechIds(defaultTech ? [defaultTech.id] : []);
    setScheduleModalOpen(true);
  };

  const openEditScheduleModal = (act: OperationalActivityRecord) => {
    setEditingActivityId(act.id);
    setActFormProjectId(act.projectId);
    setActFormType(act.activityType);
    setActFormTitle(act.title);
    setActFormStartDate(act.startDate);
    setActFormEndDate(act.endDate || act.startDate);
    setActFormTimeSlot(act.scheduledTimeSlot);
    setActFormProductId(act.productId || snapshot?.products[0]?.id || '');
    setActFormQuantitySets(act.quantitySets || 1);
    setActFormStatus(act.status);
    setActFormNotes(act.notes || '');
    setActFormTechIds(act.technicians.map((t) => t.id));
    setScheduleModalOpen(true);
  };

  const toggleTechSelection = (techId: string) => {
    setActFormTechIds((prev) =>
      prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]
    );
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actFormProjectId) {
      setBannerNotice({ type: 'error', text: 'Pilih proyek terlebih dahulu.' });
      return;
    }
    if (actFormTechIds.length === 0) {
      setBannerNotice({
        type: 'error',
        text: 'Pilih minimal satu teknisi yang ditugaskan.',
      });
      return;
    }

    setSubmitting(true);
    setBannerNotice(null);
    try {
      const method = editingActivityId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/operational', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'activity',
          id: editingActivityId || undefined,
          projectId: actFormProjectId,
          activityType: actFormType,
          title: actFormTitle || `${actFormType} Proyek`,
          startDate: actFormStartDate,
          endDate: actFormEndDate >= actFormStartDate ? actFormEndDate : actFormStartDate,
          scheduledTimeSlot: actFormTimeSlot,
          productId: actFormProductId,
          quantitySets: Number(actFormQuantitySets || 1),
          status: actFormStatus,
          notes: actFormNotes,
          technicianIds: actFormTechIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({ type: 'error', text: data.error || 'Gagal menyimpan jadwal.' });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setScheduleModalOpen(false);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } catch {
      setBannerNotice({ type: 'error', text: 'Gagal menyimpan jadwal ke server.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickActivityStatusChange = async (
    activityId: string,
    newStatus: OperationalStatus
  ) => {
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'activity',
          id: activityId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({ type: 'error', text: data.error || 'Gagal mengubah status pekerjaan.' });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntity = async (
    entity: 'activity' | 'technician' | 'customer' | 'project',
    id: string
  ) => {
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({ type: 'error', text: data.error || 'Gagal menghapus data.' });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handler Data Teknisi
  const openAddTechModal = () => {
    setEditingTechId(null);
    setTechFormName('');
    setTechFormPhone('');
    setTechFormSpec('Spesialis Instalasi & Kalibrasi Zipblind');
    setTechFormAvatar('/images/ref_tech_1.png');
    setTechFormActive(true);
    setTechModalOpen(true);
  };

  const openEditTechModal = (tech: TechnicianRecord) => {
    setEditingTechId(tech.id);
    setTechFormName(tech.fullName);
    setTechFormPhone(tech.phone);
    setTechFormSpec(tech.specialization);
    setTechFormAvatar(tech.avatarUrl);
    setTechFormActive(tech.isActive);
    setTechModalOpen(true);
  };

  const handleSaveTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const method = editingTechId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/operational', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'technician',
          id: editingTechId || undefined,
          fullName: techFormName,
          phone: techFormPhone,
          specialization: techFormSpec,
          avatarUrl: techFormAvatar,
          isActive: techFormActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({ type: 'error', text: data.error || 'Gagal menyimpan data teknisi.' });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setTechModalOpen(false);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTechnicianActive = async (tech: TechnicianRecord) => {
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'technician',
          id: tech.id,
          isActive: !tech.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handler Data Pelanggan
  const openAddCustomerModal = () => {
    setEditingCustomerId(null);
    setCustFormName('');
    setCustFormContact('');
    setCustFormPhone('');
    setCustFormEmail('');
    setCustFormCity('Jakarta Selatan');
    setCustFormAddress('');
    setCustFormNotes('');
    setCustomerModalOpen(true);
  };

  const openEditCustomerModal = (cust: CustomerRecord) => {
    setEditingCustomerId(cust.id);
    setCustFormName(cust.fullName);
    setCustFormContact(cust.contactPerson);
    setCustFormPhone(cust.phone);
    setCustFormEmail(cust.email);
    setCustFormCity(cust.city);
    setCustFormAddress(cust.address);
    setCustFormNotes(cust.notes);
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const method = editingCustomerId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/operational', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'customer',
          id: editingCustomerId || undefined,
          fullName: custFormName,
          contactPerson: custFormContact || custFormName,
          phone: custFormPhone,
          email: custFormEmail,
          city: custFormCity,
          address: custFormAddress,
          notes: custFormNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({ type: 'error', text: data.error || 'Gagal menyimpan pelanggan.' });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setCustomerModalOpen(false);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handler Data Project
  const openAddProjectModal = () => {
    const defaultCust = snapshot?.customers[0];
    setEditingProjectId(null);
    setProjFormCustomerId(defaultCust?.id || '');
    setProjFormTitle('');
    setProjFormAddress(defaultCust?.address || '');
    setProjFormDesc('');
    setProjFormStartDate('2026-11-10');
    setProjFormTargetDate('2026-12-15');
    setProjFormStatus('Sedang Berjalan');
    setProjectModalOpen(true);
  };

  const openEditProjectModal = (prj: ProjectRecord) => {
    setEditingProjectId(prj.id);
    setProjFormCustomerId(prj.customerId);
    setProjFormTitle(prj.title);
    setProjFormAddress(prj.installationAddress);
    setProjFormDesc(prj.description);
    setProjFormStartDate(prj.startDate || '2026-11-10');
    setProjFormTargetDate(prj.targetEndDate || prj.startDate || '2026-12-15');
    setProjFormStatus(prj.status);
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const method = editingProjectId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/operational', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'project',
          id: editingProjectId || undefined,
          customerId: projFormCustomerId,
          title: projFormTitle,
          installationAddress: projFormAddress,
          description: projFormDesc,
          startDate: projFormStartDate,
          targetEndDate: projFormTargetDate,
          status: projFormStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({ type: 'error', text: data.error || 'Gagal menyimpan proyek.' });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setProjectModalOpen(false);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickProjectStatusChange = async (
    projectId: string,
    newStatus: OperationalStatus
  ) => {
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const res = await fetch('/api/admin/operational', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'project',
          id: projectId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({ type: 'error', text: data.error || 'Gagal mengubah status proyek.' });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || previewMode === 'loading') {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-24 rounded-2xl bg-slate-200/70 animate-pulse" />
        <div className="h-96 rounded-2xl bg-slate-200/70 animate-pulse" />
      </div>
    );
  }

  const techniciansList = previewMode === 'empty' ? [] : snapshot?.technicians || [];
  const customersList = previewMode === 'empty' ? [] : snapshot?.customers || [];
  const projectsList = previewMode === 'empty' ? [] : snapshot?.projects || [];
  const activitiesList = previewMode === 'empty' ? [] : snapshot?.activities || [];

  const historyCustomer = customersList.find((c) => c.id === historyCustomerId) || null;

  return (
    <div className="space-y-6">
      {/* Banner Umpan Balik Operasional */}
      {bannerNotice && (
        <div
          role={bannerNotice.type === 'error' ? 'alert' : 'status'}
          className={`px-5 py-4 rounded-2xl border flex items-center justify-between gap-4 text-[15px] font-medium ${
            bannerNotice.type === 'error'
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
              : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {bannerNotice.type === 'error' ? (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            )}
            <span>{bannerNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerNotice(null)}
            className="text-[14px] font-semibold underline cursor-pointer shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ====================================================================
          MODUL 1: JADWAL TEKNISI (jadwal-teknisi)
         ==================================================================== */}
      {activeMenu === 'jadwal-teknisi' && (() => {
        const filteredSchedules = showAllDates
          ? scheduleStatusFilter === 'Semua'
            ? activitiesList
            : activitiesList.filter((s) => s.status === scheduleStatusFilter)
          : filterSchedulesByCalendarMode(
              activitiesList,
              calendarMode,
              anchorDate,
              scheduleStatusFilter
            );

        return (
          <div className="space-y-6">
            {/* Bar Kontrol Kalender Harian, Mingguan, Bulanan & Tambah Jadwal */}
            <div className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs space-y-5">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                  <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                    Kalender &amp; Penugasan Jadwal Teknisi
                  </h3>
                  <p className="text-[14px] lg:text-[15px] font-normal text-[#475E7A] mt-1">
                    Kelola jadwal harian, mingguan, dan bulanan. Seluruh teknisi yang ditugaskan ditampilkan dalam satu kolom terpadu.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fetchOperationalData()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F4F8FD] hover:bg-[#E7F0FA] text-[#102B50] text-[14.5px] font-semibold border border-[#DCE6F2] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-[#2368B5]" />
                    <span>Muat Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddScheduleModal()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Jadwal Teknisi</span>
                  </button>
                </div>
              </div>

              {/* Filter Mode Kalender, Tanggal Acuan, dan Status Pekerjaan */}
              <div className="pt-4 border-t border-[#EEF3F9] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="group"
                    aria-label="Mode Tampilan Kalender"
                    className="inline-flex items-center bg-[#F1F6FC] p-1.5 rounded-xl border border-[#DCE6F2]"
                  >
                    {(
                      [
                        { id: 'harian', label: 'Kalender Harian' },
                        { id: 'mingguan', label: 'Kalender Mingguan' },
                        { id: 'bulanan', label: 'Kalender Bulanan' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setCalendarMode(m.id);
                          setShowAllDates(false);
                        }}
                        className={`px-4 py-2 rounded-lg text-[14.5px] font-semibold transition-colors cursor-pointer ${
                          !showAllDates && calendarMode === m.id
                            ? 'bg-[#102B50] text-white shadow-xs'
                            : 'text-[#475E7A] hover:text-[#102B50]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowAllDates(true)}
                      className={`px-4 py-2 rounded-lg text-[14.5px] font-semibold transition-colors cursor-pointer ${
                        showAllDates
                          ? 'bg-[#102B50] text-white shadow-xs'
                          : 'text-[#475E7A] hover:text-[#102B50]'
                      }`}
                    >
                      Semua Periode ({activitiesList.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-2 bg-[#F8FBFF] px-3.5 py-2 rounded-xl border border-[#DCE6F2]">
                    <Calendar className="w-4 h-4 text-[#2368B5]" />
                    <label
                      htmlFor="schedule-anchor-date"
                      className="text-[14px] font-semibold text-[#102B50]"
                    >
                      Tanggal Acuan:
                    </label>
                    <input
                      id="schedule-anchor-date"
                      type="date"
                      value={anchorDate}
                      onChange={(e) => {
                        setAnchorDate(e.target.value);
                        setShowAllDates(false);
                      }}
                      className="text-[14.5px] font-semibold text-[#2368B5] bg-transparent focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                {/* Filter Status Pekerjaan */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['Semua', ...OPERATIONAL_STATUS_LIST] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setScheduleStatusFilter(st)}
                      className={`px-3.5 py-1.5 rounded-lg text-[13.5px] font-semibold border transition-colors cursor-pointer ${
                        scheduleStatusFilter === st
                          ? 'bg-[#2368B5] text-white border-[#2368B5]'
                          : 'bg-white text-[#475E7A] border-[#DCE6F2] hover:text-[#102B50]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabel Utama Jadwal Teknisi (Tanpa Kolom Jenis Penugasan!) */}
            <div className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-[#F8FBFF] border-b border-[#DCE6F2] flex flex-wrap items-center justify-between gap-3">
                <div className="text-[15px] font-semibold text-[#102B50]">
                  Menampilkan <span className="text-[#2368B5] tabular-nums">{filteredSchedules.length}</span> Jadwal Pekerjaan Teknisi
                </div>
                <div className="flex items-center gap-2 text-[13.5px] text-[#475E7A]">
                  <span>Pintasan Tanggal Contoh:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAnchorDate('2026-11-10');
                      setShowAllDates(false);
                    }}
                    className="px-2.5 py-1 rounded-md bg-white border border-[#DCE6F2] font-semibold text-[#2368B5] hover:bg-[#F0F7FF] cursor-pointer tabular-nums"
                  >
                    10 Nov 2026
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnchorDate('2026-12-15');
                      setShowAllDates(false);
                    }}
                    className="px-2.5 py-1 rounded-md bg-white border border-[#DCE6F2] font-semibold text-[#2368B5] hover:bg-[#F0F7FF] cursor-pointer tabular-nums"
                  >
                    15 Des 2026 (Lintas Bulan)
                  </button>
                </div>
              </div>

              {filteredSchedules.length === 0 ? (
                <div className="p-12 text-center">
                  <Calendar className="w-10 h-10 text-[#475E7A] mx-auto mb-3" />
                  <h4 className="text-[18px] font-semibold text-[#102B50]">
                    Tidak Ada Jadwal pada Periode Ini
                  </h4>
                  <p className="text-[14.5px] font-normal text-[#475E7A] mt-1">
                    Ubah filter kalender ke &ldquo;Semua Periode&rdquo; atau tambahkan jadwal teknisi baru.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      {/* Label Tabel: 14px | 600 */}
                      <tr className="border-b border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-semibold text-[#3B526E]">
                        <th className="py-4 px-5 font-semibold">Tanggal</th>
                        <th className="py-4 px-5 font-semibold">Waktu</th>
                        <th className="py-4 px-5 font-semibold">Pelanggan &amp; Lokasi</th>
                        <th className="py-4 px-5 font-semibold">Teknisi yang Ditugaskan</th>
                        <th className="py-4 px-5 font-semibold">Detail Pekerjaan</th>
                        <th className="py-4 px-5 font-semibold">Status Pekerjaan</th>
                        <th className="py-4 px-5 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF3F9] text-[15px]">
                      {filteredSchedules.map((sch) => {
                        const combinedTechnicianNames = formatAssignedTechniciansColumn(
                          sch.technicians
                        );
                        return (
                          <tr key={sch.id} className="hover:bg-[#F9FBFE] transition-colors">
                            {/* 1. Tanggal */}
                            <td className="py-4.5 px-5 whitespace-nowrap tabular-nums">
                              <div className="font-semibold text-[#102B50]">{sch.startDate}</div>
                              {sch.endDate && sch.endDate !== sch.startDate && (
                                <div className="text-[13px] font-medium text-[#475E7A]">
                                  s/d {sch.endDate}
                                </div>
                              )}
                              {sch.isCrossMonth && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1] text-[12px] font-semibold">
                                  Lintas Bulan
                                </span>
                              )}
                            </td>

                            {/* 2. Waktu */}
                            <td className="py-4.5 px-5 whitespace-nowrap tabular-nums font-medium text-[#475E7A]">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-[#2368B5]" />
                                {sch.scheduledTimeSlot}
                              </span>
                            </td>

                            {/* 3. Pelanggan atau Lokasi */}
                            <td className="py-4.5 px-5">
                              <div className="font-semibold text-[#102B50]">{sch.customerName}</div>
                              <div className="text-[13.5px] font-medium text-[#2368B5] mt-0.5">
                                {sch.projectCode} · {sch.projectTitle}
                              </div>
                              <div className="text-[13.5px] font-normal text-[#475E7A] mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#20B9A4] shrink-0" />
                                <span>{sch.installationAddress}</span>
                              </div>
                            </td>

                            {/* 4. Teknisi yang Ditugaskan (Seluruh nama teknisi dalam SATU kolom, tanpa kolom jenis penugasan) */}
                            <td className="py-4.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className="flex -space-x-2 overflow-hidden shrink-0">
                                  {sch.technicians.map((t) => (
                                    <div
                                      key={t.id}
                                      className="w-9 h-9 rounded-full overflow-hidden border-2 border-white bg-[#F0F7FF]"
                                      title={t.fullName}
                                    >
                                      <ResilientImage
                                        src={t.avatarUrl}
                                        alt={t.fullName}
                                        fallbackLabel={t.fullName.slice(0, 2)}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="font-semibold text-[#102B50] leading-snug">
                                  {combinedTechnicianNames}
                                </div>
                              </div>
                            </td>

                            {/* 5. Detail Pekerjaan */}
                            <td className="py-4.5 px-5">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-[#F0F7FF] text-[#2368B5] text-[13px] font-semibold">
                                  {sch.activityType}
                                </span>
                                <span className="font-semibold text-[#102B50] tabular-nums">
                                  {sch.productName} · {sch.quantitySets} Set
                                </span>
                              </div>
                              <div className="text-[14px] font-normal text-[#475E7A] mt-1">
                                {sch.title}
                              </div>
                              {sch.notes && (
                                <div className="text-[13px] font-normal text-[#64748B] mt-0.5">
                                  Catatan: {sch.notes}
                                </div>
                              )}
                            </td>

                            {/* 6. Status Pekerjaan (Langsung dapat diubah oleh Admin) */}
                            <td className="py-4.5 px-5 whitespace-nowrap">
                              <select
                                aria-label={`Status pekerjaan ${sch.activityCode}`}
                                value={sch.status}
                                disabled={submitting}
                                onChange={(e) =>
                                  handleQuickActivityStatusChange(
                                    sch.id,
                                    e.target.value as OperationalStatus
                                  )
                                }
                                className={`px-3 py-1.5 rounded-xl border text-[13.5px] font-semibold cursor-pointer focus:outline-none ${getStatusBadgeClasses(
                                  sch.status
                                )}`}
                              >
                                {OPERATIONAL_STATUS_LIST.map((st) => (
                                  <option key={st} value={st} className="bg-white text-[#102B50]">
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 7. Aksi */}
                            <td className="py-4.5 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditScheduleModal(sch)}
                                  aria-label={`Ubah jadwal ${sch.activityCode}`}
                                  className="px-3 py-1.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E0EFFE] text-[#2368B5] text-[13.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Ubah</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntity('activity', sch.id)}
                                  aria-label={`Hapus jadwal ${sch.activityCode}`}
                                  className="p-2 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
          </div>
        );
      })()}

      {/* ====================================================================
          MODUL 2: DATA TEKNISI (data-teknisi)
         ==================================================================== */}
      {activeMenu === 'data-teknisi' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                Direktori &amp; Pengelolaan Avatar Teknisi
              </h3>
              <p className="text-[14px] lg:text-[15px] font-normal text-[#475E7A] mt-1">
                Setiap teknisi memiliki avatar masing-masing yang dikelola oleh Admin. Teknisi tidak memiliki akun login.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddTechModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Teknisi</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
            {techniciansList.map((tech) => (
              <div
                key={tech.id}
                className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs flex flex-col justify-between gap-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#2368B5]/25 shrink-0 bg-[#F0F7FF]">
                    <ResilientImage
                      src={tech.avatarUrl}
                      alt={`Avatar ${tech.fullName}`}
                      fallbackLabel={tech.fullName.slice(0, 2)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-[#2368B5] tabular-nums">
                        {tech.technicianCode}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[12.5px] font-semibold ${
                          tech.isActive
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#FEE2E2] text-[#DC2626]'
                        }`}
                      >
                        {tech.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <h4 className="text-[17px] lg:text-[18px] font-semibold text-[#102B50] mt-1 truncate">
                      {tech.fullName}
                    </h4>
                    <p className="text-[14px] font-normal text-[#475E7A] mt-0.5 line-clamp-2">
                      {tech.specialization}
                    </p>
                  </div>
                </div>

                <div className="pt-3.5 border-t border-[#EEF3F9] space-y-3">
                  <div className="flex items-center justify-between text-[14px] text-[#475E7A] tabular-nums">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Phone className="w-4 h-4 text-[#2368B5]" />
                      {tech.phone}
                    </span>
                    <span className="font-semibold text-[#102B50]">
                      {tech.totalAssignedActivities} Penugasan ({tech.completedActivities} Selesai)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openEditTechModal(tech)}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#F0F7FF] hover:bg-[#E0EFFE] text-[#2368B5] text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ubah &amp; Avatar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleTechnicianActive(tech)}
                      className={`px-3 py-2 rounded-xl text-[13.5px] font-semibold cursor-pointer ${
                        tech.isActive
                          ? 'bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E]'
                          : 'bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D]'
                      }`}
                    >
                      {tech.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntity('technician', tech.id)}
                      aria-label={`Hapus teknisi ${tech.fullName}`}
                      className="p-2 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODUL 3: DATA PELANGGAN (data-pelanggan)
         ==================================================================== */}
      {activeMenu === 'data-pelanggan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                Data Pelanggan &amp; Riwayat Proyek
              </h3>
              <p className="text-[14px] lg:text-[15px] font-normal text-[#475E7A] mt-1">
                Kelola informasi pelanggan dan lihat riwayat seluruh proyek serta tahapan pekerjaan masing-masing pelanggan.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddCustomerModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pelanggan</span>
            </button>
          </div>

          {/* Panel Riwayat Proyek Pelanggan (Ditampilkan di bagian atas saat dipilih) */}
          {historyCustomer && (
            <div className="bg-white rounded-2xl p-6 border-2 border-[#2368B5]/35 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-[#EEF3F9] pb-4">
                <div>
                  <span className="text-[13px] font-semibold text-[#2368B5] uppercase">
                    Riwayat Proyek Pelanggan
                  </span>
                  <h4 className="text-[19px] font-bold text-[#102B50] mt-0.5">
                    {historyCustomer.fullName} ({historyCustomer.customerCode})
                  </h4>
                  <p className="text-[14px] font-normal text-[#475E7A]">
                    Alamat: {historyCustomer.address}, {historyCustomer.city}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryCustomerId(null)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#102B50] text-[14px] font-semibold cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Tutup Riwayat</span>
                </button>
              </div>

              {historyCustomer.projects.length === 0 ? (
                <p className="text-[15px] font-normal text-[#475E7A] py-4">
                  Pelanggan ini belum memiliki riwayat proyek yang tercatat.
                </p>
              ) : (
                <div className="space-y-4">
                  {historyCustomer.projects.map((prj) => (
                    <div
                      key={prj.id}
                      className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-[13.5px] font-semibold text-[#2368B5] tabular-nums">
                            {prj.projectCode}
                          </span>
                          <h5 className="text-[17px] font-semibold text-[#102B50]">
                            {prj.title}
                          </h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-[13px] font-semibold border ${getStatusBadgeClasses(
                              prj.status
                            )}`}
                          >
                            Status Proyek: {prj.status}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-white border border-[#DCE6F2] text-[13px] font-semibold text-[#102B50] tabular-nums">
                            {prj.totalQuantitySets} Set · {prj.totalActivities} Tahap Aktivitas
                          </span>
                        </div>
                      </div>

                      {prj.activities.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                          {prj.activities.map((act) => (
                            <div
                              key={act.id}
                              className="p-3.5 rounded-xl bg-white border border-[#DCE6F2] text-[13.5px] space-y-1"
                            >
                              <div className="flex items-center justify-between font-semibold text-[#102B50]">
                                <span>{act.activityType}</span>
                                <span className="text-[#2368B5] tabular-nums">{act.startDate}</span>
                              </div>
                              <div className="text-[#475E7A]">
                                Produk: <strong className="text-[#102B50]">{act.productName}</strong> ({act.quantitySets} Set)
                              </div>
                              <div className="text-[#475E7A]">
                                Teknisi: <strong className="text-[#102B50]">{formatAssignedTechniciansColumn(act.technicians)}</strong>
                              </div>
                              <div className="pt-1 flex items-center justify-between">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[12px] font-semibold border ${getStatusBadgeClasses(
                                    act.status
                                  )}`}
                                >
                                  Status Aktivitas: {act.status}
                                </span>
                                {act.isCrossMonth && (
                                  <span className="text-[12px] font-semibold text-[#0369A1]">
                                    Lintas Bulan
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-semibold text-[#3B526E]">
                    <th className="py-4 px-5 font-semibold">Kode</th>
                    <th className="py-4 px-5 font-semibold">Nama Pelanggan &amp; Kontak</th>
                    <th className="py-4 px-5 font-semibold">Kota &amp; Alamat Instalasi</th>
                    <th className="py-4 px-5 font-semibold">Telepon / Email</th>
                    <th className="py-4 px-5 font-semibold text-center">Riwayat Proyek</th>
                    <th className="py-4 px-5 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F9] text-[15px]">
                  {customersList.map((cust) => (
                    <tr key={cust.id} className="hover:bg-[#F9FBFE] transition-colors">
                      <td className="py-4.5 px-5 text-[14px] font-semibold text-[#2368B5] tabular-nums whitespace-nowrap">
                        {cust.customerCode}
                      </td>
                      <td className="py-4.5 px-5">
                        <div className="font-semibold text-[#102B50]">{cust.fullName}</div>
                        <div className="text-[13.5px] font-normal text-[#475E7A]">
                          PIC: {cust.contactPerson}
                        </div>
                      </td>
                      <td className="py-4.5 px-5 font-normal text-[#475E7A]">
                        <span className="font-semibold text-[#102B50]">{cust.city}</span> ·{' '}
                        {cust.address}
                      </td>
                      <td className="py-4.5 px-5 tabular-nums">
                        <div className="font-medium text-[#102B50]">{cust.phone}</div>
                        {cust.email && (
                          <div className="text-[13.5px] font-normal text-[#475E7A]">
                            {cust.email}
                          </div>
                        )}
                      </td>
                      <td className="py-4.5 px-5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setHistoryCustomerId(cust.id)}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E0EFFE] text-[#2368B5] text-[13.5px] font-semibold cursor-pointer tabular-nums"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Lihat Riwayat ({cust.totalProjects} Proyek)</span>
                        </button>
                      </td>
                      <td className="py-4.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditCustomerModal(cust)}
                            className="px-3 py-1.5 rounded-xl bg-[#F4F8FD] hover:bg-[#E5EFFA] text-[#102B50] text-[13.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Ubah</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntity('customer', cust.id)}
                            aria-label={`Hapus pelanggan ${cust.fullName}`}
                            className="p-2 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODUL 4: DATA PROJECT (data-project)
         ==================================================================== */}
      {activeMenu === 'data-project' && (() => {
        const filteredProjects = projectsList.filter((p) => {
          const statusMatch =
            projectStatusFilter === 'Semua' || p.status === projectStatusFilter;
          const q = projectSearch.trim().toLowerCase();
          const searchMatch =
            !q ||
            p.projectCode.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q) ||
            p.customerName.toLowerCase().includes(q) ||
            p.installationAddress.toLowerCase().includes(q);
          return statusMatch && searchMatch;
        });

        // Rekapitulasi pekerjaan berdasarkan tanggal pelaksanaan & status
        const periodSummary = summarizeActivitiesByPeriodAndStatus(
          activitiesList,
          recapMonthFilter === 'ALL' ? undefined : recapMonthFilter
        );

        return (
          <div className="space-y-6">
            {/* Bar Rekapitulasi Pekerjaan Berdasarkan Tanggal Pelaksanaan & Status (Aturan Bisnis Lintas Bulan) */}
            <div className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                    Data Project &amp; Tahapan Aktivitas Multi-Jadwal
                  </h3>
                  <p className="text-[14px] lg:text-[15px] font-normal text-[#475E7A] mt-1">
                    Satu proyek dapat memiliki banyak aktivitas (Pengukuran, Persiapan, Pemasangan) pada tanggal maupun bulan berbeda. Status Proyek dan Status Aktivitas dipisahkan secara tegas.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#F8FBFF] px-3.5 py-2 rounded-xl border border-[#DCE6F2]">
                    <span className="text-[13.5px] font-semibold text-[#102B50]">
                      Periode Rekap Pelaksanaan:
                    </span>
                    <select
                      aria-label="Periode Rekap Pelaksanaan"
                      value={recapMonthFilter}
                      onChange={(e) => setRecapMonthFilter(e.target.value)}
                      className="text-[14px] font-semibold text-[#2368B5] bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="2026-11">November 2026</option>
                      <option value="2026-12">Desember 2026 (Lintas Bulan)</option>
                      <option value="ALL">Seluruh Periode</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={openAddProjectModal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Proyek Baru</span>
                  </button>
                </div>
              </div>

              {/* Kartu Ringkasan Aturan Bisnis: Pemisahan Proyek Baru vs Proyek Lanjutan Lintas Bulan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[#F8FBFF] border border-[#DCE6F2]">
                  <div className="text-[13px] font-semibold text-[#475E7A]">
                    Aktivitas Dijadwalkan / Berjalan
                  </div>
                  <div className="text-[24px] font-bold text-[#102B50] tabular-nums mt-1">
                    {periodSummary.filteredActivitiesCount} Aktivitas
                  </div>
                  <div className="text-[13px] font-normal text-[#475E7A] mt-0.5 tabular-nums">
                    Total {periodSummary.totalPlannedSetsCount} Set Produk
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                  <div className="text-[13px] font-semibold text-[#15803D]">
                    Aktivitas Selesai Aktual
                  </div>
                  <div className="text-[24px] font-bold text-[#15803D] tabular-nums mt-1">
                    {periodSummary.completedActivitiesCount} Selesai
                  </div>
                  <div className="text-[13px] font-normal text-[#15803D] mt-0.5 tabular-nums">
                    {periodSummary.completedSetsCount} Set Selesai Terpasang
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FEF3C7]/60 border border-[#FDE68A]">
                  <div className="text-[13px] font-semibold text-[#92400E]">
                    Aktivitas Belum Selesai
                  </div>
                  <div className="text-[24px] font-bold text-[#92400E] tabular-nums mt-1">
                    {periodSummary.ongoingActivitiesCount +
                      periodSummary.scheduledActivitiesCount +
                      periodSummary.delayedActivitiesCount}{' '}
                    Belum Selesai
                  </div>
                  <div className="text-[12.5px] font-normal text-[#92400E] mt-0.5">
                    Tidak dihitung sebagai selesai
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F0F7FF] border border-[#DCE6F2]">
                  <div className="text-[13px] font-semibold text-[#2368B5]">
                    Proyek Baru Dimulai Periode Ini
                  </div>
                  <div className="text-[24px] font-bold text-[#102B50] tabular-nums mt-1">
                    {periodSummary.newProjectsStartedInPeriod} Proyek
                  </div>
                  <div className="text-[12.5px] font-normal text-[#475E7A] mt-0.5">
                    Berdasarkan bulan mulai proyek
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#E0F2FE]/60 border border-[#BAE6FD]">
                  <div className="text-[13px] font-semibold text-[#0369A1]">
                    Proyek Lanjutan Lintas Bulan
                  </div>
                  <div className="text-[24px] font-bold text-[#0369A1] tabular-nums mt-1">
                    {periodSummary.continuingCrossMonthProjectsInPeriod} Proyek
                  </div>
                  <div className="text-[12.5px] font-normal text-[#0369A1] mt-0.5">
                    Terhubung ke proyek awal (Bukan proyek baru)
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Status Proyek & Pencarian */}
            <div className="bg-white rounded-2xl p-5 border border-[#DCE6F2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 bg-[#F1F6FC] p-1.5 rounded-xl">
                {(['Semua', ...OPERATIONAL_STATUS_LIST] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setProjectStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-[14.5px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      projectStatusFilter === status
                        ? 'bg-[#102B50] text-white shadow-xs'
                        : 'text-[#475E7A] hover:text-[#102B50]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-96 xl:w-[420px]">
                <Search className="w-4 h-4 text-[#475E7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Cari kode, nama proyek, atau pelanggan..."
                  aria-label="Cari Proyek"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] font-normal text-[#102B50] placeholder:text-[#7892B0] focus:outline-none focus:border-[#2368B5]"
                />
              </div>
            </div>

            {/* Daftar Proyek beserta Tahapan Aktivitas Multi-Jadwal */}
            <div className="space-y-5">
              {filteredProjects.map((prj) => {
                const isExpanded = expandedProjectId === prj.id;
                return (
                  <div
                    key={prj.id}
                    className="bg-white rounded-2xl border border-[#DCE6F2] shadow-xs overflow-hidden"
                  >
                    {/* Header Proyek */}
                    <div className="p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#F8FBFF] border-b border-[#DCE6F2]">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-[14px] font-bold text-[#2368B5] tabular-nums">
                            {prj.projectCode}
                          </span>
                          <span className="text-[#DCE6F2]">•</span>
                          <span className="text-[14px] font-semibold text-[#102B50]">
                            Pelanggan: {prj.customerName}
                          </span>
                          {prj.isCrossMonth && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] text-[12.5px] font-semibold">
                              Memiliki Aktivitas Lintas Bulan
                            </span>
                          )}
                        </div>
                        <h4 className="text-[18px] lg:text-[20px] font-bold text-[#102B50]">
                          {prj.title}
                        </h4>
                        <div className="text-[14px] font-normal text-[#475E7A] flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-[#20B9A4]" />
                            {prj.installationAddress}
                          </span>
                          <span>•</span>
                          <span className="tabular-nums font-medium">
                            Periode Proyek: {prj.startDate} s/d {prj.targetEndDate}
                          </span>
                        </div>
                      </div>

                      {/* Pemisahan Status Proyek & Ringkasan Aktivitas + Tombol Aksi */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white px-4 py-2.5 rounded-xl border border-[#DCE6F2]">
                          <div className="text-[12px] font-semibold text-[#475E7A]">
                            Status Proyek (Terpisah dari Aktivitas)
                          </div>
                          <select
                            aria-label={`Ubah status proyek ${prj.projectCode}`}
                            value={prj.status}
                            disabled={submitting}
                            onChange={(e) =>
                              handleQuickProjectStatusChange(
                                prj.id,
                                e.target.value as OperationalStatus
                              )
                            }
                            className={`mt-1 px-3 py-1 rounded-lg border text-[13.5px] font-semibold cursor-pointer focus:outline-none ${getStatusBadgeClasses(
                              prj.status
                            )}`}
                          >
                            {OPERATIONAL_STATUS_LIST.map((st) => (
                              <option key={st} value={st} className="bg-white text-[#102B50]">
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="bg-white px-4 py-2.5 rounded-xl border border-[#DCE6F2] tabular-nums">
                          <div className="text-[12px] font-semibold text-[#475E7A]">
                            Progres Tahapan Aktivitas
                          </div>
                          <div className="text-[14.5px] font-bold text-[#102B50] mt-1">
                            {prj.completedActivities} / {prj.totalActivities} Tahap Selesai ({prj.totalQuantitySets} Set)
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openAddScheduleModal(prj.id)}
                            className="px-3.5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Tambah Aktivitas</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditProjectModal(prj)}
                            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F0F7FF] text-[#102B50] border border-[#DCE6F2] text-[13.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#2368B5]" />
                            <span>Ubah Proyek</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProjectId(isExpanded ? null : prj.id)
                            }
                            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F0F7FF] text-[#2368B5] border border-[#DCE6F2] text-[13.5px] font-semibold cursor-pointer"
                          >
                            {isExpanded ? 'Sembunyikan Tahapan' : 'Lihat Tahapan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntity('project', prj.id)}
                            aria-label={`Hapus proyek ${prj.projectCode}`}
                            className="p-2.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tabel Tahapan Aktivitas di dalam Proyek yang Sama */}
                    {isExpanded && (
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[15.5px] font-bold text-[#102B50] flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#2368B5]" />
                            <span>
                              Daftar Aktivitas &amp; Jadwal Terhubung ke Proyek {prj.projectCode}
                            </span>
                          </h5>
                          <span className="text-[13.5px] font-normal text-[#475E7A]">
                            Seluruh aktivitas di bawah ini terikat ke satu ID Proyek yang sama tanpa duplikasi proyek baru
                          </span>
                        </div>

                        {prj.activities.length === 0 ? (
                          <p className="text-[14.5px] font-normal text-[#475E7A] py-4">
                            Belum ada tahapan aktivitas pada proyek ini. Klik &ldquo;Tambah Aktivitas&rdquo; untuk menjadwalkan Pengukuran, Persiapan, atau Pemasangan.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-[#DCE6F2]">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-[#F8FBFF] border-b border-[#DCE6F2] text-[13.5px] font-semibold text-[#3B526E]">
                                  <th className="py-3.5 px-4">Tanggal</th>
                                  <th className="py-3.5 px-4">Jenis Aktivitas</th>
                                  <th className="py-3.5 px-4">Teknisi</th>
                                  <th className="py-3.5 px-4">Detail Produk</th>
                                  <th className="py-3.5 px-4 text-right">Jumlah Set</th>
                                  <th className="py-3.5 px-4">Catatan Opsional</th>
                                  <th className="py-3.5 px-4">Status Aktivitas</th>
                                  <th className="py-3.5 px-4 text-right">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#EEF3F9] text-[14.5px]">
                                {prj.activities.map((act) => (
                                  <tr key={act.id} className="hover:bg-[#F9FBFE]">
                                    <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                                      <div className="font-semibold text-[#102B50]">
                                        {act.startDate}
                                      </div>
                                      <div className="text-[12.5px] text-[#475E7A]">
                                        {act.scheduledTimeSlot}
                                      </div>
                                      {act.isCrossMonth && (
                                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0369A1] text-[11.5px] font-semibold">
                                          Lintas Bulan
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <span className="px-2.5 py-1 rounded-md bg-[#F0F7FF] text-[#2368B5] text-[13px] font-semibold">
                                        {act.activityType}
                                      </span>
                                      <div className="text-[13.5px] font-medium text-[#102B50] mt-1">
                                        {act.title}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 font-semibold text-[#102B50]">
                                      {formatAssignedTechniciansColumn(act.technicians)}
                                    </td>
                                    <td className="py-3.5 px-4 font-medium text-[#102B50]">
                                      {act.productName}
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-bold text-[#102B50] tabular-nums">
                                      {act.quantitySets} Set
                                    </td>
                                    <td className="py-3.5 px-4 text-[#475E7A] text-[13.5px]">
                                      {act.notes || '-'}
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <select
                                        aria-label={`Status aktivitas ${act.activityCode}`}
                                        value={act.status}
                                        disabled={submitting}
                                        onChange={(e) =>
                                          handleQuickActivityStatusChange(
                                            act.id,
                                            e.target.value as OperationalStatus
                                          )
                                        }
                                        className={`px-3 py-1 rounded-lg border text-[13px] font-semibold cursor-pointer ${getStatusBadgeClasses(
                                          act.status
                                        )}`}
                                      >
                                        {OPERATIONAL_STATUS_LIST.map((st) => (
                                          <option
                                            key={st}
                                            value={st}
                                            className="bg-white text-[#102B50]"
                                          >
                                            {st}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => openEditScheduleModal(act)}
                                          className="px-2.5 py-1 rounded-lg bg-[#F0F7FF] text-[#2368B5] text-[13px] font-semibold cursor-pointer"
                                        >
                                          Ubah
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteEntity('activity', act.id)}
                                          className="p-1.5 rounded-lg bg-[#FEF2F2] text-[#DC2626] cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ====================================================================
          MODAL 1: TAMBAH / UBAH JADWAL TEKNISI & AKTIVITAS PROYEK
         ==================================================================== */}
      {scheduleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-schedule-title"
          className="fixed inset-0 z-50 bg-[#0A192F]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 lg:p-8 border border-[#DCE6F2] shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#EEF3F9] pb-4">
              <h3 id="modal-schedule-title" className="text-[20px] font-bold text-[#102B50]">
                {editingActivityId
                  ? 'Ubah Jadwal & Aktivitas Pekerjaan'
                  : 'Tambah Jadwal Teknisi & Aktivitas Proyek'}
              </h3>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="p-2 rounded-xl bg-[#F1F5F9] text-[#475E7A] hover:text-[#102B50] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Pilih Proyek / Pelanggan
                  </label>
                  <select
                    value={actFormProjectId}
                    onChange={(e) => setActFormProjectId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] focus:outline-none focus:border-[#2368B5]"
                  >
                    {snapshot?.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title} ({p.customerName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Jenis Aktivitas
                  </label>
                  <select
                    value={actFormType}
                    onChange={(e) => setActFormType(e.target.value as OperationalActivityType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] focus:outline-none focus:border-[#2368B5]"
                  >
                    {OPERATIONAL_ACTIVITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Judul / Deskripsi Pekerjaan
                </label>
                <input
                  type="text"
                  value={actFormTitle}
                  onChange={(e) => setActFormTitle(e.target.value)}
                  required
                  placeholder="Contoh: Pemasangan Utama Motorized Zipblind Rumah A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] focus:outline-none focus:border-[#2368B5]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    value={actFormStartDate}
                    onChange={(e) => {
                      setActFormStartDate(e.target.value);
                      if (actFormEndDate < e.target.value) {
                        setActFormEndDate(e.target.value);
                      }
                    }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={actFormEndDate}
                    onChange={(e) => setActFormEndDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Waktu Kunjungan
                  </label>
                  <input
                    type="text"
                    value={actFormTimeSlot}
                    onChange={(e) => setActFormTimeSlot(e.target.value)}
                    required
                    placeholder="09:00 - 15:00 WIB"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Detail Produk Katalog
                  </label>
                  <select
                    value={actFormProductId}
                    onChange={(e) => setActFormProductId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  >
                    {snapshot?.products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Jumlah Set
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={actFormQuantitySets}
                    onChange={(e) => setActFormQuantitySets(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Status Pekerjaan
                  </label>
                  <select
                    value={actFormStatus}
                    onChange={(e) => setActFormStatus(e.target.value as OperationalStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  >
                    {OPERATIONAL_STATUS_LIST.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pilihan Satu atau Beberapa Teknisi */}
              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-2">
                  Pilih Satu atau Beberapa Teknisi yang Ditugaskan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {snapshot?.technicians.map((tech) => {
                    const selected = actFormTechIds.includes(tech.id);
                    return (
                      <label
                        key={tech.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-[#F0F7FF] border-[#2368B5]'
                            : 'bg-white border-[#DCE6F2] hover:bg-[#F8FBFF]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleTechSelection(tech.id)}
                          className="w-4 h-4 accent-[#2368B5]"
                        />
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-[#DCE6F2] shrink-0">
                          <ResilientImage
                            src={tech.avatarUrl}
                            alt={tech.fullName}
                            fallbackLabel={tech.fullName.slice(0, 2)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold text-[#102B50] truncate">
                            {tech.fullName}
                          </div>
                          <div className="text-[12px] text-[#475E7A]">
                            {tech.isActive ? 'Aktif' : 'Nonaktif'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Catatan Opsional
                </label>
                <textarea
                  rows={2}
                  value={actFormNotes}
                  onChange={(e) => setActFormNotes(e.target.value)}
                  placeholder="Catatan tambahan terkait akses lokasi, alat khusus, atau koordinasi pelanggan..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EEF3F9]">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] text-[#475E7A] text-[14.5px] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Jadwal & Aktivitas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: TAMBAH / UBAH DATA & AVATAR TEKNISI
         ==================================================================== */}
      {techModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tech-title"
          className="fixed inset-0 z-50 bg-[#0A192F]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 lg:p-8 border border-[#DCE6F2] shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#EEF3F9] pb-4">
              <h3 id="modal-tech-title" className="text-[20px] font-bold text-[#102B50]">
                {editingTechId ? 'Ubah Data & Avatar Teknisi' : 'Tambah Teknisi Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setTechModalOpen(false)}
                className="p-2 rounded-xl bg-[#F1F5F9] text-[#475E7A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTechnician} className="space-y-4">
              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Nama Lengkap Teknisi
                </label>
                <input
                  type="text"
                  value={techFormName}
                  onChange={(e) => setTechFormName(e.target.value)}
                  required
                  placeholder="Contoh: Rizky Pratama"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={techFormPhone}
                    onChange={(e) => setTechFormPhone(e.target.value)}
                    required
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Status Keaktifan
                  </label>
                  <select
                    value={techFormActive ? 'true' : 'false'}
                    onChange={(e) => setTechFormActive(e.target.value === 'true')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  >
                    <option value="true">Aktif Bertugas</option>
                    <option value="false">Nonaktif Sementara</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Spesialisasi Keahlian
                </label>
                <input
                  type="text"
                  value={techFormSpec}
                  onChange={(e) => setTechFormSpec(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              {/* Pemilih Avatar Teknisi Individual */}
              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-2">
                  Pilih Avatar Khusus Teknisi Ini
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5 mb-3">
                  {TECHNICIAN_AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setTechFormAvatar(preset.url)}
                      className={`p-1.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        techFormAvatar === preset.url
                          ? 'border-[#2368B5] bg-[#F0F7FF] scale-105'
                          : 'border-[#DCE6F2] hover:border-[#2368B5]/50'
                      }`}
                      title={preset.label}
                    >
                      <div className="w-12 h-12 mx-auto rounded-xl overflow-hidden">
                        <ResilientImage
                          src={preset.url}
                          alt={preset.label}
                          fallbackLabel="TK"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={techFormAvatar}
                  onChange={(e) => setTechFormAvatar(e.target.value)}
                  placeholder="Atau masukkan URL avatar kustom..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#DCE6F2] text-[14px] text-[#475E7A]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EEF3F9]">
                <button
                  type="button"
                  onClick={() => setTechModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] text-[#475E7A] text-[14.5px] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Teknisi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: TAMBAH / UBAH DATA PELANGGAN
         ==================================================================== */}
      {customerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-customer-title"
          className="fixed inset-0 z-50 bg-[#0A192F]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 lg:p-8 border border-[#DCE6F2] shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#EEF3F9] pb-4">
              <h3 id="modal-customer-title" className="text-[20px] font-bold text-[#102B50]">
                {editingCustomerId ? 'Ubah Data Pelanggan' : 'Tambah Pelanggan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="p-2 rounded-xl bg-[#F1F5F9] text-[#475E7A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Nama Pelanggan / Perusahaan
                  </label>
                  <input
                    type="text"
                    value={custFormName}
                    onChange={(e) => setCustFormName(e.target.value)}
                    required
                    placeholder="Contoh: Bpk. Arifin Wijaya"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Nama Kontak Person (PIC)
                  </label>
                  <input
                    type="text"
                    value={custFormContact}
                    onChange={(e) => setCustFormContact(e.target.value)}
                    placeholder="Nama penanggung jawab lokasi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Nomor Telepon
                  </label>
                  <input
                    type="text"
                    value={custFormPhone}
                    onChange={(e) => setCustFormPhone(e.target.value)}
                    required
                    placeholder="0811-xxxx-xxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Kota / Wilayah
                  </label>
                  <input
                    type="text"
                    value={custFormCity}
                    onChange={(e) => setCustFormCity(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Alamat Lengkap Lokasi
                </label>
                <input
                  type="text"
                  value={custFormAddress}
                  onChange={(e) => setCustFormAddress(e.target.value)}
                  required
                  placeholder="Jl. ..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EEF3F9]">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] text-[#475E7A] text-[14.5px] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: TAMBAH / UBAH DATA PROJECT
         ==================================================================== */}
      {projectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-project-title"
          className="fixed inset-0 z-50 bg-[#0A192F]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 lg:p-8 border border-[#DCE6F2] shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#EEF3F9] pb-4">
              <h3 id="modal-project-title" className="text-[20px] font-bold text-[#102B50]">
                {editingProjectId ? 'Ubah Data Proyek' : 'Tambah Proyek Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setProjectModalOpen(false)}
                className="p-2 rounded-xl bg-[#F1F5F9] text-[#475E7A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Pelanggan Pemilik Proyek
                </label>
                <select
                  value={projFormCustomerId}
                  onChange={(e) => {
                    setProjFormCustomerId(e.target.value);
                    const c = snapshot?.customers.find((cust) => cust.id === e.target.value);
                    if (c && !projFormAddress) {
                      setProjFormAddress(c.address);
                    }
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                >
                  {snapshot?.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customerCode} — {c.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Nama Proyek
                </label>
                <input
                  type="text"
                  value={projFormTitle}
                  onChange={(e) => setProjFormTitle(e.target.value)}
                  required
                  placeholder="Contoh: Proyek Rumah Modern — Pondok Indah"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Alamat Lokasi Pemasangan
                </label>
                <input
                  type="text"
                  value={projFormAddress}
                  onChange={(e) => setProjFormAddress(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={projFormStartDate}
                    onChange={(e) => setProjFormStartDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Target Selesai
                  </label>
                  <input
                    type="date"
                    value={projFormTargetDate}
                    onChange={(e) => setProjFormTargetDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Status Proyek
                  </label>
                  <select
                    value={projFormStatus}
                    onChange={(e) => setProjFormStatus(e.target.value as OperationalStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  >
                    {OPERATIONAL_STATUS_LIST.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EEF3F9]">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] text-[#475E7A] text-[14.5px] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Proyek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
