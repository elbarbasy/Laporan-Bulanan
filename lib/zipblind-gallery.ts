/**
 * Modul Logika Bisnis & Struktur Album Galeri Dokumentasi Proyek ZIPBLIND (Tahap 5 — PROMPT 5)
 * Mencakup:
 * - 8 Kategori Dokumentasi sesuai spesifikasi
 * - Pengelompokan Album berdasarkan Proyek dan pemisahan tegas antar Tahapan Pekerjaan
 *   (Foto Pengukuran terpisah dari Foto Pemasangan meskipun berada pada proyek yang sama)
 * - Aturan Before/After yang HANYA diaktifkan untuk Service atau Perbaikan
 * - Filter multi-kriteria (Pencarian Proyek, Jenis Aktivitas, Produk, Status, Pelanggan/Lokasi, Kategori)
 */

import type { OperationalActivityType, OperationalStatus } from './zipblind-operational';

export type DbPhotoCategory =
  | 'Sebelum Pemasangan'
  | 'Proses Pekerjaan'
  | 'Hasil Akhir'
  | 'Lainnya';

export type DocumentationCategory =
  | 'Survey'
  | 'Pengukuran'
  | 'Persiapan'
  | 'Proses pemasangan'
  | 'Hasil akhir'
  | 'Service sebelum dan sesudah'
  | 'Pengiriman'
  | 'Lainnya';

export type ServiceComparePhase = 'Normal' | 'Sebelum Service' | 'Sesudah Service';

export const GALLERY_DOCUMENTATION_CATEGORIES: DocumentationCategory[] = [
  'Survey',
  'Pengukuran',
  'Persiapan',
  'Proses pemasangan',
  'Hasil akhir',
  'Service sebelum dan sesudah',
  'Pengiriman',
  'Lainnya',
];

export interface GalleryPhotoItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  projectStatus: OperationalStatus;
  customerId: string;
  customerName: string;
  customerCity: string;
  installationAddress: string;
  activityId: string | null;
  activityCode: string | null;
  activityType: OperationalActivityType;
  activityTitle: string;
  activityDate: string;
  activityStatus: OperationalStatus;
  productName: string;
  quantitySets: number;
  documentationCategory: DocumentationCategory;
  servicePhase: ServiceComparePhase;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  caption: string;
  imageUrl: string;
  downloadUrl: string;
  uploadedAt: string;
}

export interface ProjectStageGroup {
  stageKey: string;
  stageTitle: string;
  activityId: string | null;
  activityCode: string | null;
  activityType: OperationalActivityType;
  activityDate: string;
  activityStatus: OperationalStatus;
  documentationCategory: DocumentationCategory;
  productName: string;
  quantitySets: number;
  supportsBeforeAfter: boolean;
  photos: GalleryPhotoItem[];
}

export interface ProjectAlbumGroup {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  projectStatus: OperationalStatus;
  customerId: string;
  customerName: string;
  customerCity: string;
  installationAddress: string;
  primaryProductName: string;
  totalProjectSets: number;
  totalPhotos: number;
  coverPhotoUrl: string | null;
  stageGroups: ProjectStageGroup[];
}

/**
 * Memetakan 8 kategori dokumentasi PROMPT 5 ke ENUM database PostgreSQL (`photo_category_enum`)
 * tanpa mengubah struktur skema database PROMPT 2.
 */
export function mapDocCategoryToDbEnum(
  docCategory: DocumentationCategory
): DbPhotoCategory {
  switch (docCategory) {
    case 'Survey':
    case 'Pengukuran':
    case 'Persiapan':
      return 'Sebelum Pemasangan';
    case 'Proses pemasangan':
      return 'Proses Pekerjaan';
    case 'Hasil akhir':
      return 'Hasil Akhir';
    case 'Service sebelum dan sesudah':
    case 'Pengiriman':
    case 'Lainnya':
    default:
      return 'Lainnya';
  }
}

/**
 * ATURAN BISNIS PROMPT 5:
 * Jangan memaksakan format Before/After untuk semua proyek.
 * Gunakan hanya jika sesuai, misalnya untuk service atau perbaikan.
 */
export function isBeforeAfterApplicable(
  docCategory: DocumentationCategory,
  activityType?: OperationalActivityType | string | null
): boolean {
  if (docCategory === 'Service sebelum dan sesudah') {
    return true;
  }
  if (activityType === 'Service' || activityType === 'Perbaikan') {
    return true;
  }
  return false;
}

/**
 * Menyematkan metadata kategori dokumentasi (8 kategori) dan fase service pada caption database
 * secara transparan.
 */
export function encodePhotoCaptionWithMetadata(params: {
  documentationCategory: DocumentationCategory;
  servicePhase?: ServiceComparePhase;
  caption?: string | null;
}): string {
  const cleanCaption = String(params.caption || '')
    .replace(/^\[DOC:[^\]]+\]\s*/i, '')
    .trim();
  const phase =
    isBeforeAfterApplicable(params.documentationCategory) && params.servicePhase
      ? params.servicePhase
      : 'Normal';
  return `[DOC:${params.documentationCategory}|${phase}] ${cleanCaption}`.trim();
}

/**
 * Mengekstrak kategori dokumentasi (8 kategori), fase Before/After (jika relevan),
 * serta caption bersih dari baris database `public.project_photos`.
 */
export function decodePhotoCaptionMetadata(
  dbCategory: DbPhotoCategory,
  storedCaption: string | null | undefined
): {
  documentationCategory: DocumentationCategory;
  servicePhase: ServiceComparePhase;
  cleanCaption: string;
} {
  const raw = String(storedCaption || '').trim();
  const match = raw.match(/^\[DOC:([^|\]]+)\|([^\]]+)\]\s*(.*)$/i);
  if (match) {
    const parsedCat = match[1].trim() as DocumentationCategory;
    const parsedPhase = match[2].trim() as ServiceComparePhase;
    const cleanCaption = match[3].trim();
    const validCat = GALLERY_DOCUMENTATION_CATEGORIES.includes(parsedCat)
      ? parsedCat
      : 'Lainnya';
    const validPhase: ServiceComparePhase =
      parsedPhase === 'Sebelum Service' || parsedPhase === 'Sesudah Service'
        ? parsedPhase
        : 'Normal';

    return {
      documentationCategory: validCat,
      servicePhase: validPhase,
      cleanCaption,
    };
  }

  // Fallback pemetaan langsung dari ENUM database
  let fallbackCategory: DocumentationCategory = 'Lainnya';
  if (dbCategory === 'Sebelum Pemasangan') fallbackCategory = 'Pengukuran';
  else if (dbCategory === 'Proses Pekerjaan') fallbackCategory = 'Proses pemasangan';
  else if (dbCategory === 'Hasil Akhir') fallbackCategory = 'Hasil akhir';

  return {
    documentationCategory: fallbackCategory,
    servicePhase: 'Normal',
    cleanCaption: raw,
  };
}

export interface GalleryFilterCriteria {
  searchQuery?: string;
  projectId?: string; // 'Semua' atau UUID proyek
  activityType?: 'Semua' | OperationalActivityType;
  productName?: string; // 'Semua' atau nama produk
  status?: 'Semua' | OperationalStatus;
  customerOrLocation?: string; // 'Semua' atau customerId / kota
  documentationCategory?: 'Semua' | DocumentationCategory;
}

/**
 * Memfilter daftar foto dokumentasi berdasarkan:
 * - Pencarian proyek / caption / lokasi
 * - Filter jenis aktivitas
 * - Filter produk
 * - Filter status
 * - Filter pelanggan atau lokasi
 * - Filter kategori dokumentasi
 */
export function filterGalleryPhotos(
  photos: GalleryPhotoItem[],
  criteria: GalleryFilterCriteria
): GalleryPhotoItem[] {
  const q = (criteria.searchQuery || '').trim().toLowerCase();

  return photos.filter((photo) => {
    if (criteria.projectId && criteria.projectId !== 'Semua') {
      if (photo.projectId !== criteria.projectId) return false;
    }

    if (criteria.activityType && criteria.activityType !== 'Semua') {
      if (photo.activityType !== criteria.activityType) return false;
    }

    if (criteria.productName && criteria.productName !== 'Semua') {
      if (photo.productName.toLowerCase() !== criteria.productName.toLowerCase()) {
        return false;
      }
    }

    if (criteria.status && criteria.status !== 'Semua') {
      if (
        photo.activityStatus !== criteria.status &&
        photo.projectStatus !== criteria.status
      ) {
        return false;
      }
    }

    if (
      criteria.customerOrLocation &&
      criteria.customerOrLocation !== 'Semua'
    ) {
      const target = criteria.customerOrLocation.toLowerCase();
      const matchCustomer =
        photo.customerId.toLowerCase() === target ||
        photo.customerName.toLowerCase().includes(target) ||
        photo.customerCity.toLowerCase().includes(target) ||
        photo.installationAddress.toLowerCase().includes(target);
      if (!matchCustomer) return false;
    }

    if (
      criteria.documentationCategory &&
      criteria.documentationCategory !== 'Semua'
    ) {
      if (photo.documentationCategory !== criteria.documentationCategory) {
        return false;
      }
    }

    if (q) {
      const searchable = [
        photo.projectCode,
        photo.projectTitle,
        photo.customerName,
        photo.customerCity,
        photo.installationAddress,
        photo.activityType,
        photo.activityTitle,
        photo.documentationCategory,
        photo.productName,
        photo.caption,
        photo.fileName,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    return true;
  });
}

/**
 * ATURAN STRUKTUR ALBUM PROMPT 5:
 * - Dokumentasi dikelompokkan berdasarkan proyek dan tahapan pekerjaan.
 * - Foto pengukuran harus terpisah dari foto pemasangan meskipun berasal dari proyek yang sama.
 * - Tidak adanya foto tidak menghalangi penyimpanan pekerjaan (proyek tanpa foto tetap memiliki album proyek).
 */
export function buildProjectAlbumsWithStages(
  projectsList: Array<{
    id: string;
    projectCode: string;
    title: string;
    status: OperationalStatus;
    customerId: string;
    customerName: string;
    customerCity: string;
    installationAddress: string;
    primaryProductName: string;
    totalQuantitySets: number;
  }>,
  photos: GalleryPhotoItem[]
): ProjectAlbumGroup[] {
  return projectsList.map((proj) => {
    const projPhotos = photos.filter((p) => p.projectId === proj.id);
    const stageMap = new Map<string, ProjectStageGroup>();

    for (const photo of projPhotos) {
      // Kunci pemisahan tahapan: memisahkan berdasarkan jenis aktivitas + kategori dokumentasi + activityId
      // sehingga Foto Pengukuran dan Foto Pemasangan SELALU berada di grup tahapan yang terpisah!
      const stageKey = `${photo.activityId || 'general'}::${photo.activityType}::${photo.documentationCategory}`;

      let stage = stageMap.get(stageKey);
      if (!stage) {
        stage = {
          stageKey,
          stageTitle: `${photo.documentationCategory} — Tahap ${photo.activityType}`,
          activityId: photo.activityId,
          activityCode: photo.activityCode,
          activityType: photo.activityType,
          activityDate: photo.activityDate,
          activityStatus: photo.activityStatus,
          documentationCategory: photo.documentationCategory,
          productName: photo.productName,
          quantitySets: photo.quantitySets,
          supportsBeforeAfter: isBeforeAfterApplicable(
            photo.documentationCategory,
            photo.activityType
          ),
          photos: [],
        };
        stageMap.set(stageKey, stage);
      }
      stage.photos.push(photo);
    }

    const stageGroups = Array.from(stageMap.values()).sort((a, b) =>
      a.activityDate.localeCompare(b.activityDate)
    );

    return {
      projectId: proj.id,
      projectCode: proj.projectCode,
      projectTitle: proj.title,
      projectStatus: proj.status,
      customerId: proj.customerId,
      customerName: proj.customerName,
      customerCity: proj.customerCity,
      installationAddress: proj.installationAddress,
      primaryProductName: proj.primaryProductName,
      totalProjectSets: proj.totalQuantitySets,
      totalPhotos: projPhotos.length,
      coverPhotoUrl: projPhotos[0]?.imageUrl || null,
      stageGroups,
    };
  });
}
