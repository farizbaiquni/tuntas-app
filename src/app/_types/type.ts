export enum MenuDahboard {
  INFORMASI_UMUM = "Informasi Umum",
  BATANG_TUBUH = "Batang Tubuh",
  LAMPIRAN_UTAMA = "Lampiran Utama",
  LAMPIRAN_PENDUKUNG = "Lampiran Pendukung",
  PREVIEW = "Preview",
  GENERATE = "Generate",
}

export enum JenisLaporan {
  RAPERDA = "raperda",
  RAPERBUP = "raperbup",
  PERDA = "perda",
  PERBUP = "perbup",
  SALINAN_PERDA = "salinan-perda",
  SALINAN_PERBUP = "salinan-perbup",
}

export enum StatusDokumenLaporan {
  BELUM_DIBUAT = "belum-dibuat", // gunakan kebab-case konsisten
  DIBUAT = "dibuat",
  DRAFT = "draft", // pertimbangkan tambahan status
  DIAJUKAN = "diajukan",
  DISAHKAN = "disahkan",
}

// Types untuk sub-structures
export interface FooterConfig {
  text: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  fontSize: number;
}

export interface SubbabCalk {
  id: string;
  subbab: string;
  judul: string;
  halamanMulai: number;
}

export interface BabCalk {
  id: string;
  bab: string;
  judul: string;
  halamanMulai: number;
  subbabs: SubbabCalk[]; // tidak perlu optional jika array bisa kosong []
}

export interface LampiranPendukung {
  id: string;
  urutan: number;
  namaFileAsli: string;
  namaFileDiStorageLokal: string;
  fileUrl: string; // lebih baik dari File object
  judul: string;
  jumlahTotalLembar: number;
}

export interface LampiranUtama {
  id: string;
  urutan: number;
  fileUrl: string;
  namaFileDiStorageLokal: string;
  romawiLampiran: string;
  judulPembatasLampiran: string;
  footer: FooterConfig;
  jumlahHalaman: number;
  jumlahTotalLembar: number;
  isCALK: boolean;
  babs: BabCalk[]; // tidak perlu optional
}

export interface DokumenLaporan {
  id: string;
  jenisLaporan: JenisLaporan;
  tahun: number;
  nomor: number | null;
  tanggalPengesahan: string | null; // ISO 8601 string
  status: StatusDokumenLaporan;
  batangTubuh: string | null;
  lampirans: LampiranUtama[];
  lampiransPendukung: LampiranPendukung[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface SubbabCalkType {
  id: string;
  subbab: string;
  judul: string;
  halamanMulai: number;
}

// Helper types
export type DokumenLaporanInput = Omit<
  DokumenLaporan,
  "id" | "createdAt" | "updatedAt"
>;
export type DokumenLaporanUpdate = Partial<DokumenLaporanInput>;
