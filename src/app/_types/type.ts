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
  BELUM_DIBUAT = "belum-dibuat",
  DIBUAT = "dibuat",
  DRAFT = "draft",
  DIAJUKAN = "diajukan",
  DISAHKAN = "disahkan",
}

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

export interface LampiranCalk {
  id: string;
  nama: string;
  /** Halaman ke berapa (1-based, relatif dalam PDF CALK) lampiran ini dimulai */
  halamanMulai: number;
  /**
   * Berapa halaman lampiran ini — halaman-halaman ini TIDAK diberi nomor footer.
   * Diabaikan jika sampaiAkhir = true.
   */
  jumlahHalaman: number;
  /**
   * Jika true, lampiran ini dianggap mulai dari halamanMulai sampai halaman
   * terakhir PDF — user tidak perlu input jumlahHalaman.
   */
  sampaiAkhir: boolean;
}

export interface BabCalk {
  id: string;
  bab: string;
  judul: string;
  halamanMulai: number;
  subbabs: SubbabCalk[];
  /** Lampiran di dalam bab CALK ini yang tidak diberi nomor halaman footer */
  lampiranCalk: LampiranCalk[];
}

export interface LampiranPendukung {
  id: string;
  urutan: number;
  namaFileAsli: string;
  namaFileDiStorageLokal: string;
  fileUrl: string;
  judul: string;
  jumlahTotalLembar: number;
}

export interface LampiranUtama {
  id: string;
  urutan: number;
  /** URL PDF yang sudah diberi footer (ditampilkan & disimpan) */
  fileUrl: string;
  /** URL PDF asli tanpa footer — digunakan untuk re-apply footer saat urutan berubah */
  rawFileUrl: string;
  namaFileDiStorageLokal: string;
  /** Ukuran file dalam format human-readable, misal "2.34 MB" */
  ukuranFile: string;
  romawiLampiran: string;
  judulPembatasLampiran: string;
  footer: FooterConfig;
  jumlahHalaman: number;
  jumlahTotalLembar: number;
  isCALK: boolean;
  babs: BabCalk[];
}

export interface DokumenLaporan {
  id: string;
  jenisLaporan: JenisLaporan;
  tahun: number;
  nomor: number | null;
  tanggalPengesahan: string | null;
  status: StatusDokumenLaporan;
  batangTubuh: string | null;
  lampirans: LampiranUtama[];
  lampiransPendukung: LampiranPendukung[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export type DokumenLaporanInput = Omit<DokumenLaporan, "id" | "createdAt" | "updatedAt">;
export type DokumenLaporanUpdate = Partial<DokumenLaporanInput>;