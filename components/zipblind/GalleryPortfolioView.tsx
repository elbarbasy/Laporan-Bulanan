'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FolderOpen,
  Grid,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  GALLERY_DOCUMENTATION_CATEGORIES,
  filterGalleryPhotos,
  isBeforeAfterApplicable,
  type DocumentationCategory,
  type GalleryPhotoItem,
  type ProjectAlbumGroup,
  type ServiceComparePhase,
} from '@/lib/zipblind-gallery';
import {
  OPERATIONAL_ACTIVITY_TYPES,
  OPERATIONAL_STATUS_LIST,
  type OperationalActivityType,
  type OperationalStatus,
} from '@/lib/zipblind-operational';
import type { UIPreviewStateMode } from '@/lib/zipblind-ui-data';

interface GalleryProjectOption {
  id: string;
  projectCode: string;
  title: string;
  customerName: string;
  customerCity: string;
  installationAddress: string;
  status: OperationalStatus;
}

interface GalleryActivityOption {
  id: string;
  projectId: string;
  activityCode: string;
  activityType: OperationalActivityType;
  title: string;
  startDate: string;
  status: OperationalStatus;
  productName: string;
  quantitySets: number;
}

interface GalleryCustomerOption {
  id: string;
  customerCode: string;
  fullName: string;
  city: string;
}

interface GalleryProductOption {
  id: string;
  name: string;
}

interface GallerySnapshotData {
  photos: GalleryPhotoItem[];
  albums: ProjectAlbumGroup[];
  projects: GalleryProjectOption[];
  activities: GalleryActivityOption[];
  customers: GalleryCustomerOption[];
  products: GalleryProductOption[];
}

type PortfolioLayoutMode = 'album' | 'grid' | 'masonry';

interface GalleryPortfolioViewProps {
  previewMode: UIPreviewStateMode;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export default function GalleryPortfolioView({ previewMode }: GalleryPortfolioViewProps) {
  const [snapshot, setSnapshot] = useState<GallerySnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Mode Tampilan Portfolio: Album Proyek & Tahapan | Grid | Masonry
  const [layoutMode, setLayoutMode] = useState<PortfolioLayoutMode>('album');
  const [openedAlbumProjectId, setOpenedAlbumProjectId] = useState<string>('Semua');

  // Filter Multi-Kriteria Sesuai PROMPT 5
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'Semua' | DocumentationCategory>('Semua');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'Semua' | OperationalActivityType>(
    'Semua'
  );
  const [productFilter, setProductFilter] = useState<string>('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | OperationalStatus>('Semua');
  const [customerOrLocationFilter, setCustomerOrLocationFilter] = useState<string>('Semua');

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Modal Unggah Foto Dokumentasi
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState<string>('');
  const [uploadActivityId, setUploadActivityId] = useState<string>('NONE');
  const [uploadCategory, setUploadCategory] = useState<DocumentationCategory>('Pengukuran');
  const [uploadServicePhase, setUploadServicePhase] =
    useState<ServiceComparePhase>('Normal');
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Modal Kelompokkan / Ubah Metadata Foto
  const [regroupPhoto, setRegroupPhoto] = useState<GalleryPhotoItem | null>(null);
  const [regroupProjectId, setRegroupProjectId] = useState<string>('');
  const [regroupActivityId, setRegroupActivityId] = useState<string>('NONE');
  const [regroupCategory, setRegroupCategory] = useState<DocumentationCategory>('Hasil akhir');
  const [regroupServicePhase, setRegroupServicePhase] =
    useState<ServiceComparePhase>('Normal');
  const [regroupCaption, setRegroupCaption] = useState<string>('');

  const fetchGallerySnapshot = useCallback(async () => {
    setLoading((prev) => prev);
    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.ok && data) {
        setSnapshot(data);
      } else {
        setBannerNotice({
          type: 'error',
          text: data.error || 'Gagal memuat galeri dokumentasi proyek.',
        });
      }
    } catch {
      setBannerNotice({
        type: 'error',
        text: 'Gagal menghubungi server galeri dokumentasi.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchGallerySnapshot();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchGallerySnapshot]);

  const openUploadModal = (preselectedProjectId?: string, preselectedActivityId?: string) => {
    const defaultProj =
      snapshot?.projects.find((p) => p.id === preselectedProjectId) || snapshot?.projects[0];
    const projActs =
      snapshot?.activities.filter((a) => a.projectId === defaultProj?.id) || [];
    const defaultAct =
      projActs.find((a) => a.id === preselectedActivityId) || projActs[0];

    setUploadProjectId(defaultProj?.id || '');
    setUploadActivityId(defaultAct?.id || 'NONE');
    if (defaultAct?.activityType === 'Pengukuran') {
      setUploadCategory('Pengukuran');
    } else if (defaultAct?.activityType === 'Persiapan') {
      setUploadCategory('Persiapan');
    } else if (defaultAct?.activityType === 'Survey') {
      setUploadCategory('Survey');
    } else if (defaultAct?.activityType === 'Service' || defaultAct?.activityType === 'Perbaikan') {
      setUploadCategory('Service sebelum dan sesudah');
    } else {
      setUploadCategory('Proses pemasangan');
    }
    setUploadServicePhase('Normal');
    setUploadCaption('');
    setUploadFile(null);
    setUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadProjectId) {
      setBannerNotice({ type: 'error', text: 'Pilih proyek tujuan terlebih dahulu.' });
      return;
    }
    if (!uploadFile) {
      setBannerNotice({ type: 'error', text: 'Pilih file foto dari perangkat Anda.' });
      return;
    }

    setSubmitting(true);
    setBannerNotice(null);
    try {
      const formData = new FormData();
      formData.append('projectId', uploadProjectId);
      formData.append('activityId', uploadActivityId);
      formData.append('documentationCategory', uploadCategory);
      formData.append('servicePhase', uploadServicePhase);
      formData.append('caption', uploadCaption);
      formData.append('file', uploadFile);

      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({
          type: 'error',
          text: data.error || 'Gagal mengunggah foto dokumentasi.',
        });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setUploadModalOpen(false);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } catch {
      setBannerNotice({
        type: 'error',
        text: 'Terjadi kesalahan jaringan saat mengunggah foto.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openRegroupModal = (photo: GalleryPhotoItem) => {
    setRegroupPhoto(photo);
    setRegroupProjectId(photo.projectId);
    setRegroupActivityId(photo.activityId || 'NONE');
    setRegroupCategory(photo.documentationCategory);
    setRegroupServicePhase(photo.servicePhase);
    setRegroupCaption(photo.caption);
  };

  const handleSaveRegroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regroupPhoto) return;

    setSubmitting(true);
    setBannerNotice(null);
    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: regroupPhoto.id,
          projectId: regroupProjectId,
          activityId: regroupActivityId,
          documentationCategory: regroupCategory,
          servicePhase: regroupServicePhase,
          caption: regroupCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({
          type: 'error',
          text: data.error || 'Gagal memperbarui pengelompokan foto.',
        });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setRegroupPhoto(null);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setSubmitting(true);
    setBannerNotice(null);
    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerNotice({
          type: 'error',
          text: data.error || 'Gagal menghapus foto dokumentasi.',
        });
      } else {
        if (data.snapshot) setSnapshot(data.snapshot);
        setLightboxIndex(null);
        setBannerNotice({ type: 'success', text: data.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setCategoryFilter('Semua');
    setActivityTypeFilter('Semua');
    setProductFilter('Semua');
    setStatusFilter('Semua');
    setCustomerOrLocationFilter('Semua');
    setOpenedAlbumProjectId('Semua');
  };

  if (loading || previewMode === 'loading') {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-28 rounded-2xl bg-slate-200/70 animate-pulse" />
        <div className="h-96 rounded-2xl bg-slate-200/70 animate-pulse" />
      </div>
    );
  }

  const allPhotos = previewMode === 'empty' ? [] : snapshot?.photos || [];
  const allProjects = previewMode === 'empty' ? [] : snapshot?.projects || [];

  const filteredPhotos = filterGalleryPhotos(allPhotos, {
    searchQuery,
    projectId: openedAlbumProjectId,
    activityType: activityTypeFilter,
    productName: productFilter,
    status: statusFilter,
    customerOrLocation: customerOrLocationFilter,
    documentationCategory: categoryFilter,
  });

  // Kelompokkan album berdasarkan proyek & tahapan pekerjaan dari foto terfilter
  const filteredProjectsList = allProjects.filter((proj) => {
    if (openedAlbumProjectId !== 'Semua' && proj.id !== openedAlbumProjectId) {
      return false;
    }
    if (
      customerOrLocationFilter !== 'Semua' &&
      proj.customerName !== customerOrLocationFilter &&
      proj.customerCity !== customerOrLocationFilter
    ) {
      return false;
    }
    if (statusFilter !== 'Semua' && proj.status !== statusFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const hay = `${proj.projectCode} ${proj.title} ${proj.customerName} ${proj.installationAddress}`.toLowerCase();
      const hasMatchingPhoto = filteredPhotos.some((p) => p.projectId === proj.id);
      if (!hay.includes(q) && !hasMatchingPhoto) return false;
    }
    return true;
  });

  const activeLightboxPhoto =
    lightboxIndex !== null && filteredPhotos[lightboxIndex]
      ? filteredPhotos[lightboxIndex]
      : null;

  const selectedUploadAct = snapshot?.activities.find((a) => a.id === uploadActivityId);
  const uploadSupportsBeforeAfter = isBeforeAfterApplicable(
    uploadCategory,
    selectedUploadAct?.activityType
  );

  const selectedRegroupAct = snapshot?.activities.find((a) => a.id === regroupActivityId);
  const regroupSupportsBeforeAfter = isBeforeAfterApplicable(
    regroupCategory,
    selectedRegroupAct?.activityType
  );

  return (
    <div className="space-y-6">
      {/* Banner Umpan Balik */}
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

      {/* Header Portfolio & Kontrol Tampilan (Album Proyek | Grid | Masonry) + Tombol Unggah */}
      <div className="bg-white rounded-2xl p-6 border border-[#DCE6F2] shadow-xs space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-[20px] lg:text-[22px] font-bold text-[#102B50] tracking-[-0.015em]">
                Portfolio &amp; Album Dokumentasi Proyek ZIPBLIND
              </h3>
              <span className="px-3 py-1 rounded-full bg-[#F0F7FF] text-[#2368B5] text-[13px] font-semibold border border-[#DCE6F2]">
                Bucket: project-photos · Opsional per Aktivitas
              </span>
            </div>
            <p className="text-[14px] lg:text-[15px] font-normal text-[#475E7A] mt-1">
              Dokumentasi dikelompokkan berdasarkan proyek dan dipisahkan secara tegas per tahapan pekerjaan (Foto Pengukuran terpisah dari Foto Pemasangan).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Switcher Layout: Album Proyek, Grid Portfolio, Masonry Portfolio */}
            <div
              role="group"
              aria-label="Mode Tata Letak Galeri"
              className="inline-flex items-center bg-[#F1F6FC] p-1.5 rounded-xl border border-[#DCE6F2]"
            >
              <button
                type="button"
                onClick={() => setLayoutMode('album')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] font-semibold transition-colors cursor-pointer ${
                  layoutMode === 'album'
                    ? 'bg-[#102B50] text-white shadow-xs'
                    : 'text-[#475E7A] hover:text-[#102B50]'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Album Proyek &amp; Tahapan</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] font-semibold transition-colors cursor-pointer ${
                  layoutMode === 'grid'
                    ? 'bg-[#102B50] text-white shadow-xs'
                    : 'text-[#475E7A] hover:text-[#102B50]'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Grid Portfolio</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('masonry')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] font-semibold transition-colors cursor-pointer ${
                  layoutMode === 'masonry'
                    ? 'bg-[#102B50] text-white shadow-xs'
                    : 'text-[#475E7A] hover:text-[#102B50]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Masonry Portfolio</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchGallerySnapshot()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F4F8FD] hover:bg-[#E7F0FA] text-[#102B50] text-[14px] font-semibold border border-[#DCE6F2] cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#2368B5]" />
              <span>Muat Ulang</span>
            </button>

            <button
              type="button"
              onClick={() =>
                openUploadModal(
                  openedAlbumProjectId !== 'Semua' ? openedAlbumProjectId : undefined
                )
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Unggah Foto Dokumentasi</span>
            </button>
          </div>
        </div>

        {/* Filter Kategori Dokumentasi (8 Kategori Eksak PROMPT 5) */}
        <div className="pt-4 border-t border-[#EEF3F9] space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-[#102B50] mr-2 inline-flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-[#2368B5]" />
              <span>Kategori Dokumentasi:</span>
            </span>
            {(['Semua', ...GALLERY_DOCUMENTATION_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-[13.5px] font-semibold border transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#2368B5] text-white border-[#2368B5]'
                    : 'bg-[#F8FBFF] text-[#475E7A] border-[#DCE6F2] hover:text-[#102B50]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Bar Pencarian Proyek + Filter Jenis Aktivitas, Produk, Status, Pelanggan/Lokasi, dan Album Proyek */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            {/* 1. Pencarian Proyek */}
            <div className="relative xl:col-span-2">
              <Search className="w-4 h-4 text-[#475E7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari proyek, lokasi, atau keterangan foto..."
                aria-label="Cari Proyek di Galeri"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#DCE6F2] text-[14.5px] text-[#102B50] placeholder:text-[#7892B0] focus:outline-none focus:border-[#2368B5]"
              />
            </div>

            {/* 2. Filter Jenis Aktivitas */}
            <div>
              <select
                aria-label="Filter Jenis Aktivitas"
                value={activityTypeFilter}
                onChange={(e) =>
                  setActivityTypeFilter(e.target.value as 'Semua' | OperationalActivityType)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-semibold text-[#102B50] focus:outline-none focus:border-[#2368B5] cursor-pointer"
              >
                <option value="Semua">Semua Jenis Aktivitas</option>
                {OPERATIONAL_ACTIVITY_TYPES.map((act) => (
                  <option key={act} value={act}>
                    Aktivitas: {act}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Filter Produk */}
            <div>
              <select
                aria-label="Filter Produk"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-semibold text-[#102B50] focus:outline-none focus:border-[#2368B5] cursor-pointer"
              >
                <option value="Semua">Semua Produk Katalog</option>
                {snapshot?.products.map((prod) => (
                  <option key={prod.id} value={prod.name}>
                    Produk: {prod.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Filter Status */}
            <div>
              <select
                aria-label="Filter Status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'Semua' | OperationalStatus)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-semibold text-[#102B50] focus:outline-none focus:border-[#2368B5] cursor-pointer"
              >
                <option value="Semua">Semua Status</option>
                {OPERATIONAL_STATUS_LIST.map((st) => (
                  <option key={st} value={st}>
                    Status: {st}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Filter Pelanggan atau Lokasi */}
            <div>
              <select
                aria-label="Filter Pelanggan atau Lokasi"
                value={customerOrLocationFilter}
                onChange={(e) => setCustomerOrLocationFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14px] font-semibold text-[#102B50] focus:outline-none focus:border-[#2368B5] cursor-pointer"
              >
                <option value="Semua">Semua Pelanggan &amp; Lokasi</option>
                {snapshot?.customers.map((cust) => (
                  <option key={cust.id} value={cust.fullName}>
                    {cust.fullName} ({cust.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Indikator Filter Album Proyek Aktif */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[14px] text-[#475E7A]">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Total Foto Tersimpan di Database:{' '}
                <strong className="text-[#102B50] tabular-nums">{allPhotos.length} Foto</strong>
              </span>
              <span>·</span>
              <span>
                Menampilkan Hasil Filter:{' '}
                <strong className="text-[#2368B5] tabular-nums">
                  {filteredPhotos.length} Foto
                </strong>{' '}
                pada{' '}
                <strong className="text-[#102B50] tabular-nums">
                  {filteredProjectsList.length} Album Proyek
                </strong>
              </span>
              {openedAlbumProjectId !== 'Semua' && (
                <button
                  type="button"
                  onClick={() => setOpenedAlbumProjectId('Semua')}
                  className="ml-2 px-3 py-1 rounded-lg bg-[#E0F2FE] text-[#0369A1] text-[13px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Kembali ke Semua Album Proyek</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {(searchQuery ||
              categoryFilter !== 'Semua' ||
              activityTypeFilter !== 'Semua' ||
              productFilter !== 'Semua' ||
              statusFilter !== 'Semua' ||
              customerOrLocationFilter !== 'Semua' ||
              openedAlbumProjectId !== 'Semua') && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[13.5px] font-semibold text-[#2368B5] hover:underline cursor-pointer"
              >
                Reset Seluruh Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODE 1: TAMPILAN ALBUM BERDASARKAN PROYEK & TAHAPAN PEKERJAAN
         ==================================================================== */}
      {layoutMode === 'album' && (
        <div className="space-y-6">
          {filteredProjectsList.map((proj) => {
            const projPhotos = filteredPhotos.filter((p) => p.projectId === proj.id);
            const albumGroup = snapshot?.albums.find((a) => a.projectId === proj.id);

            // Kelompokkan foto proyek ini berdasarkan tahapan pekerjaan agar Foto Pengukuran terpisah dari Foto Pemasangan
            const stageBuckets = new Map<
              string,
              {
                stageLabel: string;
                activityType: OperationalActivityType;
                documentationCategory: DocumentationCategory;
                activityDate: string;
                productName: string;
                quantitySets: number;
                supportsBeforeAfter: boolean;
                photos: GalleryPhotoItem[];
              }
            >();

            for (const photo of projPhotos) {
              const key = `${photo.activityId || 'umum'}::${photo.activityType}::${photo.documentationCategory}`;
              const existing = stageBuckets.get(key);
              if (!existing) {
                stageBuckets.set(key, {
                  stageLabel: `Tahap ${photo.activityType} · Kategori: ${photo.documentationCategory}`,
                  activityType: photo.activityType,
                  documentationCategory: photo.documentationCategory,
                  activityDate: photo.activityDate,
                  productName: photo.productName,
                  quantitySets: photo.quantitySets,
                  supportsBeforeAfter: isBeforeAfterApplicable(
                    photo.documentationCategory,
                    photo.activityType
                  ),
                  photos: [photo],
                });
              } else {
                existing.photos.push(photo);
              }
            }

            const stagesArray = Array.from(stageBuckets.entries()).sort((a, b) =>
              a[1].activityDate.localeCompare(b[1].activityDate)
            );

            return (
              <div
                key={proj.id}
                className="bg-white rounded-3xl border border-[#DCE6F2] shadow-xs overflow-hidden"
              >
                {/* Header Album Proyek */}
                <div className="p-6 bg-gradient-to-r from-[#F8FBFF] to-[#F0F7FF] border-b border-[#DCE6F2] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg bg-[#102B50] text-white text-[13px] font-bold tabular-nums">
                        {proj.projectCode}
                      </span>
                      <span className="text-[14px] font-semibold text-[#2368B5]">
                        {proj.customerName}
                      </span>
                      <span className="text-[#CBD5E1]">•</span>
                      <span className="text-[13.5px] font-semibold text-[#087F8C]">
                        Status Proyek: {proj.status}
                      </span>
                    </div>
                    <h4 className="text-[19px] lg:text-[21px] font-bold text-[#102B50]">
                      {proj.title}
                    </h4>
                    <p className="text-[14px] font-normal text-[#475E7A] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#20B9A4] shrink-0" />
                      <span>
                        {proj.installationAddress} ({proj.customerCity})
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="px-4 py-2 rounded-xl bg-white border border-[#DCE6F2] text-[14px] font-semibold text-[#102B50] tabular-nums">
                      {projPhotos.length} Foto Dokumentasi ({stagesArray.length} Tahapan)
                    </div>
                    {openedAlbumProjectId !== proj.id ? (
                      <button
                        type="button"
                        onClick={() => setOpenedAlbumProjectId(proj.id)}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F0F7FF] text-[#2368B5] border border-[#DCE6F2] text-[14px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Fokus Album Ini</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenedAlbumProjectId('Semua')}
                        className="px-4 py-2.5 rounded-xl bg-[#E0F2FE] text-[#0369A1] text-[14px] font-semibold cursor-pointer"
                      >
                        Tampilkan Semua Proyek
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openUploadModal(proj.id)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[14px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Unggah Foto ke Proyek Ini</span>
                    </button>
                  </div>
                </div>

                {/* Isi Album Proyek: Dikelompokkan Berdasarkan Tahapan Pekerjaan */}
                <div className="p-6">
                  {stagesArray.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#F8FBFF] border border-dashed border-[#CBD5E1] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#EBF3FE] text-[#2368B5] flex items-center justify-center shrink-0">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h5 className="text-[16px] font-semibold text-[#102B50]">
                            Belum Ada Foto Dokumentasi yang Diunggah pada Proyek Ini
                          </h5>
                          <p className="text-[14px] font-normal text-[#475E7A] mt-0.5">
                            Sesuai spesifikasi, dokumentasi foto bersifat opsional (tidak menghalangi penyimpanan pekerjaan) dan tidak diisi foto demo palsu.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openUploadModal(proj.id)}
                        className="px-4 py-2.5 rounded-xl bg-[#102B50] hover:bg-[#1B3F70] text-white text-[14px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        + Unggah Dokumentasi Pertama
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {stagesArray.map(([stageKey, stage]) => (
                        <div
                          key={stageKey}
                          className="p-5 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EEF8] pb-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="px-3 py-1 rounded-lg bg-[#2368B5] text-white text-[13px] font-semibold">
                                Tahap: {stage.activityType}
                              </span>
                              <span className="px-3 py-1 rounded-lg bg-white border border-[#DCE6F2] text-[#102B50] text-[13px] font-semibold">
                                Kategori: {stage.documentationCategory}
                              </span>
                              <span className="text-[13.5px] font-medium text-[#475E7A] tabular-nums">
                                Tanggal: {stage.activityDate} · {stage.productName} ({stage.quantitySets} Set)
                              </span>
                              {stage.supportsBeforeAfter && (
                                <span className="px-2.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] text-[12.5px] font-semibold">
                                  Mode Perbandingan Before/After Aktif (Khusus Service/Perbaikan)
                                </span>
                              )}
                            </div>
                            <span className="text-[13.5px] font-semibold text-[#102B50] tabular-nums">
                              {stage.photos.length} Foto pada Tahap Ini
                            </span>
                          </div>

                          {/* Grid Thumbnail Foto di dalam Tahapan Ini */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {stage.photos.map((photo) => {
                              const globalIdx = filteredPhotos.findIndex(
                                (item) => item.id === photo.id
                              );
                              return (
                                <motion.div
                                  key={photo.id}
                                  whileHover={{ y: -3 }}
                                  className="group bg-white rounded-2xl border border-[#DCE6F2] overflow-hidden shadow-xs flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="relative h-52 w-full overflow-hidden bg-[#0D2346]">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={photo.imageUrl}
                                        alt={photo.caption}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                      />
                                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                                        <span className="px-2.5 py-1 rounded-lg bg-[#0D2346]/85 text-white text-[12px] font-semibold backdrop-blur-xs">
                                          {photo.documentationCategory}
                                        </span>
                                        {photo.servicePhase !== 'Normal' && (
                                          <span className="px-2.5 py-1 rounded-lg bg-[#087F8C] text-white text-[12px] font-semibold">
                                            {photo.servicePhase}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setLightboxIndex(globalIdx >= 0 ? globalIdx : 0)}
                                        aria-label={`Buka Lightbox ${photo.caption}`}
                                        className="absolute inset-0 bg-[#0D2346]/0 group-hover:bg-[#0D2346]/35 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                                      >
                                        <span className="px-4 py-2 rounded-xl bg-white text-[#102B50] text-[13.5px] font-semibold inline-flex items-center gap-1.5 shadow-md">
                                          <Eye className="w-4 h-4 text-[#2368B5]" />
                                          <span>Perbesar (Lightbox)</span>
                                        </span>
                                      </button>
                                    </div>

                                    <div className="p-4">
                                      <h6 className="text-[15px] font-semibold text-[#102B50] leading-snug line-clamp-2">
                                        {photo.caption}
                                      </h6>
                                      <p className="text-[13px] font-normal text-[#475E7A] mt-1 tabular-nums">
                                        {photo.fileName} · {formatFileSize(photo.fileSizeBytes)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="px-4 py-3 bg-[#F8FBFF] border-t border-[#EEF3F9] flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setLightboxIndex(globalIdx >= 0 ? globalIdx : 0)
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE6F2] text-[#102B50] hover:bg-[#F0F7FF] text-[12.5px] font-semibold cursor-pointer"
                                      >
                                        Lihat
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openRegroupModal(photo)}
                                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE6F2] text-[#2368B5] hover:bg-[#F0F7FF] text-[12.5px] font-semibold cursor-pointer"
                                      >
                                        Kelompokkan
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <a
                                        href={photo.downloadUrl}
                                        download={photo.fileName}
                                        aria-label={`Unduh foto ${photo.fileName}`}
                                        className="p-1.5 rounded-lg bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1]"
                                        title="Unduh Foto"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePhoto(photo.id)}
                                        aria-label={`Hapus foto ${photo.fileName}`}
                                        className="p-1.5 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer"
                                        title="Hapus Foto"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================================
          MODE 2 & 3: GRID PORTFOLIO DAN MASONRY PORTFOLIO
         ==================================================================== */}
      {(layoutMode === 'grid' || layoutMode === 'masonry') && (
        <div>
          {filteredPhotos.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-[#DCE6F2] text-center shadow-xs">
              <Camera className="w-10 h-10 text-[#475E7A] mx-auto mb-3" />
              <h4 className="text-[18px] font-semibold text-[#102B50]">
                Belum Ada Foto Dokumentasi yang Sesuai Filter
              </h4>
              <p className="text-[14.5px] font-normal text-[#475E7A] max-w-md mx-auto mt-1">
                Klik tombol &ldquo;Unggah Foto Dokumentasi&rdquo; di kanan atas untuk menambahkan dokumentasi proyek asli ke Supabase Storage / Bucket.
              </p>
            </div>
          ) : (
            <div
              className={
                layoutMode === 'masonry'
                  ? 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 space-y-5'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
              }
            >
              {filteredPhotos.map((photo, idx) => (
                <motion.div
                  key={photo.id}
                  whileHover={{ y: -4 }}
                  className={`group bg-white rounded-2xl border border-[#DCE6F2] overflow-hidden shadow-xs flex flex-col justify-between ${
                    layoutMode === 'masonry' ? 'break-inside-avoid mb-5' : ''
                  }`}
                >
                  <div>
                    <div
                      className={`relative w-full overflow-hidden bg-[#0D2346] ${
                        layoutMode === 'masonry' && idx % 2 === 1 ? 'h-64' : 'h-52'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0D2346]/85 text-white text-[12px] font-semibold">
                          {photo.documentationCategory}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-[#2368B5]/90 text-white text-[12px] font-semibold">
                          Tahap {photo.activityType}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(idx)}
                        className="absolute inset-0 bg-[#0D2346]/0 group-hover:bg-[#0D2346]/35 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <span className="px-4 py-2 rounded-xl bg-white text-[#102B50] text-[13.5px] font-semibold inline-flex items-center gap-1.5 shadow-md">
                          <Eye className="w-4 h-4 text-[#2368B5]" />
                          <span>Buka Lightbox</span>
                        </span>
                      </button>
                    </div>

                    <div className="p-5 space-y-1.5">
                      <div className="text-[13px] font-semibold text-[#2368B5] tabular-nums">
                        {photo.projectCode} · {photo.productName} ({photo.quantitySets} Set)
                      </div>
                      <h5 className="text-[16px] font-bold text-[#102B50] leading-snug">
                        {photo.projectTitle}
                      </h5>
                      <p className="text-[14px] font-medium text-[#102B50]">
                        {photo.caption}
                      </p>
                      <p className="text-[13px] font-normal text-[#475E7A]">
                        {photo.customerName} · {photo.customerCity}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 bg-[#F8FBFF] border-t border-[#EEF3F9] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openRegroupModal(photo)}
                      className="text-[13px] font-semibold text-[#2368B5] hover:underline cursor-pointer"
                    >
                      Kelompokkan / Ubah Tahap
                    </button>
                    <div className="flex items-center gap-2">
                      <a
                        href={photo.downloadUrl}
                        download={photo.fileName}
                        className="p-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1]"
                        title="Unduh Foto"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="p-1.5 rounded-lg bg-[#FEF2F2] text-[#DC2626] cursor-pointer"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          LIGHTBOX INTERAKTIF (Lihat, Navigasi, Unduh, Kelompokkan, Hapus)
         ==================================================================== */}
      {activeLightboxPhoto && lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lightbox Dokumentasi Proyek"
          className="fixed inset-0 z-50 bg-[#07152B]/90 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8"
        >
          <div className="bg-white rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl border border-[#DCE6F2] grid grid-cols-1 lg:grid-cols-12">
            {/* Area Gambar Lightbox */}
            <div className="lg:col-span-8 bg-[#07152B] relative flex items-center justify-center min-h-[360px] lg:min-h-[540px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeLightboxPhoto.imageUrl}
                alt={activeLightboxPhoto.caption}
                className="w-full h-full max-h-[520px] object-contain p-4"
              />

              {filteredPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + filteredPhotos.length) %
                          filteredPhotos.length
                      )
                    }
                    aria-label="Foto Sebelumnya"
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 hover:bg-white text-[#102B50] shadow-md cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length)
                    }
                    aria-label="Foto Berikutnya"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 hover:bg-white text-[#102B50] shadow-md cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Area Metadata & Aksi Lightbox */}
            <div className="lg:col-span-4 p-6 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#EEF3F9] pb-3">
                  <span className="text-[13.5px] font-bold text-[#2368B5] tabular-nums">
                    {activeLightboxPhoto.projectCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(null)}
                    aria-label="Tutup Lightbox"
                    className="p-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#102B50] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h4 className="text-[18px] font-bold text-[#102B50]">
                    {activeLightboxPhoto.projectTitle}
                  </h4>
                  <p className="text-[14.5px] font-medium text-[#475E7A] mt-1">
                    {activeLightboxPhoto.caption}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8FBFF] border border-[#DCE6F2] space-y-2 text-[13.5px]">
                  <div className="flex justify-between">
                    <span className="text-[#475E7A]">Kategori Dokumentasi:</span>
                    <strong className="font-semibold text-[#102B50]">
                      {activeLightboxPhoto.documentationCategory}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#475E7A]">Tahapan Pekerjaan:</span>
                    <strong className="font-semibold text-[#2368B5]">
                      {activeLightboxPhoto.activityType}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#475E7A]">Pelanggan:</span>
                    <strong className="font-semibold text-[#102B50]">
                      {activeLightboxPhoto.customerName}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#475E7A]">Produk &amp; Jumlah:</span>
                    <strong className="font-semibold text-[#102B50] tabular-nums">
                      {activeLightboxPhoto.productName} ({activeLightboxPhoto.quantitySets} Set)
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#475E7A]">File &amp; Ukuran:</span>
                    <strong className="font-semibold text-[#102B50] tabular-nums">
                      {formatFileSize(activeLightboxPhoto.fileSizeBytes)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-[#EEF3F9]">
                <a
                  href={activeLightboxPhoto.downloadUrl}
                  download={activeLightboxPhoto.fileName}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-ocean-blue text-white text-[14.5px] font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Foto Asli</span>
                </a>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeLightboxPhoto;
                      setLightboxIndex(null);
                      openRegroupModal(target);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#F0F7FF] text-[#2368B5] text-[13.5px] font-semibold cursor-pointer"
                  >
                    Kelompokkan Tahap
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(activeLightboxPhoto.id)}
                    className="py-2.5 px-4 rounded-xl bg-[#FEF2F2] text-[#DC2626] text-[13.5px] font-semibold cursor-pointer"
                  >
                    Hapus Foto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL UNGGAH FOTO DOKUMENTASI PROYEK
         ==================================================================== */}
      {uploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-upload-photo-title"
          className="fixed inset-0 z-50 bg-[#0A192F]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 lg:p-8 border border-[#DCE6F2] shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#EEF3F9] pb-4">
              <h3 id="modal-upload-photo-title" className="text-[20px] font-bold text-[#102B50]">
                Unggah Foto Dokumentasi Proyek
              </h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="p-2 rounded-xl bg-[#F1F5F9] text-[#475E7A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Pilih Proyek
                </label>
                <select
                  aria-label="Pilih Proyek Tujuan"
                  value={uploadProjectId}
                  onChange={(e) => {
                    const nextProjId = e.target.value;
                    setUploadProjectId(nextProjId);
                    const firstAct = snapshot?.activities.find(
                      (a) => a.projectId === nextProjId
                    );
                    setUploadActivityId(firstAct?.id || 'NONE');
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
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
                  Tahapan Pekerjaan / Aktivitas Proyek (Memisahkan Pengukuran &amp; Pemasangan)
                </label>
                <select
                  aria-label="Pilih Tahapan Aktivitas"
                  value={uploadActivityId}
                  onChange={(e) => setUploadActivityId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                >
                  <option value="NONE">Umum Proyek (Tanpa Ikatan Aktivitas Spesifik)</option>
                  {snapshot?.activities
                    .filter((a) => a.projectId === uploadProjectId)
                    .map((act) => (
                      <option key={act.id} value={act.id}>
                        [{act.activityType}] {act.title} ({act.startDate})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Kategori Dokumentasi
                  </label>
                  <select
                    aria-label="Pilih Kategori Dokumentasi"
                    value={uploadCategory}
                    onChange={(e) =>
                      setUploadCategory(e.target.value as DocumentationCategory)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  >
                    {GALLERY_DOCUMENTATION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Opsi Before/After HANYA ditampilkan jika sesuai (Service atau Perbaikan) */}
                {uploadSupportsBeforeAfter && (
                  <div>
                    <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                      Tahap Perbandingan Service
                    </label>
                    <select
                      value={uploadServicePhase}
                      onChange={(e) =>
                        setUploadServicePhase(e.target.value as ServiceComparePhase)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                    >
                      <option value="Normal">Dokumentasi Standar</option>
                      <option value="Sebelum Service">Sebelum Service (Before)</option>
                      <option value="Sesudah Service">Sesudah Service (After)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Pilih File Foto
                </label>
                <input
                  type="file"
                  accept="image/*"
                  aria-label="File Foto Dokumentasi"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] bg-[#F8FBFF] text-[14.5px] text-[#102B50]"
                />
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Keterangan / Caption Dokumentasi
                </label>
                <input
                  type="text"
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Contoh: Pengukuran bukaan jendela utama teras belakang"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EEF3F9]">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] text-[#475E7A] text-[14.5px] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold cursor-pointer"
                >
                  {submitting ? 'Mengunggah...' : 'Simpan & Unggah Foto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL KELOMPOKKAN / PINDAHKAN TAHAP DOKUMENTASI FOTO
         ==================================================================== */}
      {regroupPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-regroup-photo-title"
          className="fixed inset-0 z-50 bg-[#0A192F]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 lg:p-8 border border-[#DCE6F2] shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#EEF3F9] pb-4">
              <h3 id="modal-regroup-photo-title" className="text-[20px] font-bold text-[#102B50]">
                Kelompokkan &amp; Atur Tahapan Foto
              </h3>
              <button
                type="button"
                onClick={() => setRegroupPhoto(null)}
                className="p-2 rounded-xl bg-[#F1F5F9] text-[#475E7A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRegroup} className="space-y-4">
              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Proyek Album
                </label>
                <select
                  value={regroupProjectId}
                  onChange={(e) => {
                    const nextProjId = e.target.value;
                    setRegroupProjectId(nextProjId);
                    const firstAct = snapshot?.activities.find(
                      (a) => a.projectId === nextProjId
                    );
                    setRegroupActivityId(firstAct?.id || 'NONE');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                >
                  {snapshot?.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Tahapan Aktivitas Proyek
                </label>
                <select
                  value={regroupActivityId}
                  onChange={(e) => setRegroupActivityId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                >
                  <option value="NONE">Umum Proyek</option>
                  {snapshot?.activities
                    .filter((a) => a.projectId === regroupProjectId)
                    .map((act) => (
                      <option key={act.id} value={act.id}>
                        [{act.activityType}] {act.title} ({act.startDate})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                    Kategori Dokumentasi
                  </label>
                  <select
                    value={regroupCategory}
                    onChange={(e) =>
                      setRegroupCategory(e.target.value as DocumentationCategory)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                  >
                    {GALLERY_DOCUMENTATION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {regroupSupportsBeforeAfter && (
                  <div>
                    <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                      Tahap Perbandingan Service
                    </label>
                    <select
                      value={regroupServicePhase}
                      onChange={(e) =>
                        setRegroupServicePhase(e.target.value as ServiceComparePhase)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                    >
                      <option value="Normal">Dokumentasi Standar</option>
                      <option value="Sebelum Service">Sebelum Service (Before)</option>
                      <option value="Sesudah Service">Sesudah Service (After)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#102B50] mb-1.5">
                  Keterangan / Caption
                </label>
                <input
                  type="text"
                  value={regroupCaption}
                  onChange={(e) => setRegroupCaption(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6F2] text-[15px] text-[#102B50]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EEF3F9]">
                <button
                  type="button"
                  onClick={() => setRegroupPhoto(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] text-[#475E7A] text-[14.5px] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-ocean-blue text-white text-[15px] font-semibold cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pengelompokan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
