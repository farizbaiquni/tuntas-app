"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
  InformationCircleIcon,
  BookOpenIcon,
  PencilIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";
import {
  LampiranUtama,
  LampiranCalk,
  BabCalk,
  SubbabCalk,
  HeaderTtdConfig,
  JenisLaporan,
} from "@/app/_types/type";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  isOpen: boolean;
  onClose: () => void;
  nextUrutan: number;
  startPage?: number;
  editData?: LampiranUtama;
  namaDaerah: string;
  namaKepalaDaerah: string;
  jenisLaporan: JenisLaporan;
  onSave: (lampiran: LampiranUtama | LampiranUtama[]) => void;
};

type FormInfo = {
  isCalk: boolean;
  lampiransCalk: LampiranCalk[];
  babs: BabCalk[];
  romanPage: string;
  dividerTitle: string;
  footerNote: string;
  footerWidth: number;
  offsetX: number;
  positionY: number;
  fontSize: number;
  footerHeight: number;
  enableCoverInduk: boolean;
  coverIndukRomawi: string;
  coverIndukJudul: string;
  headerTtd: HeaderTtdConfig;
};

type FormErrors = Partial<Record<"dividerTitle" | "footerNote", string>>;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// Rule 6.3 / 7.4: Hoist the numeral lookup table to module level — created once, never recreated.
const ROMAN_MAP: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function toRomawi(num: number): string {
  let result = "";
  let n = num;
  for (const [v, s] of ROMAN_MAP) {
    while (n >= v) {
      result += s;
      n -= v;
    }
  }
  return result;
}

function formatFileSize(bytes: number): string {
  // Rule 7.8: Early return for each size boundary — avoids evaluating lower branches.
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

async function readPdfPageCount(file: File): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), {
      ignoreEncryption: true,
    });
    return pdfDoc.getPageCount();
  } catch {
    return 0;
  }
}

const DEFAULT_HEADER_TTD: HeaderTtdConfig = {
  enabled: false,
  nomor: "",
  tanggal: "",
  header: { fontSize: 9, marginRight: 70, marginTop: 48 },
  ttd: { fontSize: 10, marginRight: 42, marginBottom: 72 },
};

// Helper: Title Case setiap kata kecuali romawi (semua huruf sama)
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const LABEL_JENIS_MAP: Record<JenisLaporan, string> = {
  [JenisLaporan.RAPERDA]:       "Rancangan Peraturan Daerah Kabupaten",
  [JenisLaporan.PERDA]:         "Peraturan Daerah Kabupaten",
  [JenisLaporan.SALINAN_PERDA]: "Salinan Peraturan Daerah Kabupaten",
  [JenisLaporan.RAPERBUP]:      "Rancangan Peraturan Bupati",
  [JenisLaporan.PERBUP]:        "Peraturan Bupati",
  [JenisLaporan.SALINAN_PERBUP]:"Salinan Peraturan Bupati",
};

function getDefaultForm(urutan: number): FormInfo {
  return {
    isCalk: false,
    lampiransCalk: [],
    babs: [],
    romanPage: toRomawi(urutan),
    dividerTitle: "",
    footerNote: "",
    footerWidth: 91,
    offsetX: 0,
    positionY: 27,
    fontSize: 8,
    footerHeight: 20,
    enableCoverInduk: false,
    coverIndukRomawi: "",
    coverIndukJudul: "",
    headerTtd: { ...DEFAULT_HEADER_TTD },
  };
}

function lampiranToForm(l: LampiranUtama): FormInfo {
  return {
    isCalk: l.isCALK,
    lampiransCalk: l.babs.flatMap((b) => b.lampiranCalk ?? []),
    babs: l.babs,
    romanPage: l.romawiLampiran,
    dividerTitle: l.judulPembatasLampiran,
    footerNote: l.footer.text,
    footerWidth: l.footer.width,
    offsetX: l.footer.position.x,
    positionY: l.footer.position.y,
    fontSize: l.footer.fontSize,
    footerHeight: l.footer.height,
    enableCoverInduk: false,
    coverIndukRomawi: "",
    coverIndukJudul: "",
    headerTtd: l.headerTtd ?? { ...DEFAULT_HEADER_TTD },
  };
}

function validate(form: FormInfo): FormErrors {
  const errors: FormErrors = {};
  if (!form.dividerTitle.trim())
    errors.dividerTitle = "Judul pembatas lampiran wajib diisi.";
  if (!form.footerNote.trim())
    errors.footerNote = "Keterangan footer wajib diisi.";
  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadLampiranUtamaModal({
  isOpen,
  onClose,
  nextUrutan,
  startPage = 1,
  editData,
  namaDaerah,
  namaKepalaDaerah,
  jenisLaporan,
  onSave,
}: Props) {
  const isEditMode = !!editData;

  // Rule 5.10: Lazy state initializers — the functions run only once on mount, not on re-renders.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    () => editData?.fileUrl ?? null,
  );
  const [isPreviewFocus, setIsPreviewFocus] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "info" | "daftarisi">(
    () => (isEditMode ? "info" : "upload"),
  );
  const [formInfo, setFormInfo] = useState<FormInfo>(() =>
    isEditMode ? lampiranToForm(editData!) : getDefaultForm(nextUrutan),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [pdfPageCount, setPdfPageCount] = useState<number>(
    () => editData?.jumlahHalaman ?? 0,
  );
  const [fileSize, setFileSize] = useState<string>(
    () => editData?.ukuranFile ?? "",
  );
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [headerTtdPreviewUrl, setHeaderTtdPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isGeneratingFooterPreview, setIsGeneratingFooterPreview] = useState(false);
  const [rawFileUrl, setRawFileUrl] = useState<string | null>(
    () => editData?.rawFileUrl ?? null,
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState(60); // persen
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const footerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormInfo(
        isEditMode ? lampiranToForm(editData!) : getDefaultForm(nextUrutan),
      );
      setPreviewUrl(editData?.fileUrl ?? null);
      setRawFileUrl(editData?.rawFileUrl ?? null);
      setSelectedFile(null);
      setErrors({});
      setActiveTab(isEditMode ? "info" : "upload");
      setIsPreviewFocus(false);
      setPdfPageCount(editData?.jumlahHalaman ?? 0);
      setFileSize(editData?.ukuranFile ?? "");
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Rule 8.2: Store the latest onClose in a ref so the effect doesn't re-subscribe
  // every time the parent re-renders and creates a new onClose reference.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPreviewFocus) setIsPreviewFocus(false);
        else onCloseRef.current();
      }
    };
    if (isOpen) {
      // Rule 4.2: Use passive listener — we never call preventDefault() in this handler,
      // so marking it passive allows the browser to optimize scroll/input performance.
      document.addEventListener("keydown", handler, { passive: true });
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "auto";
    };
    // Rule 5.6: Narrow deps — only re-subscribe when isOpen or isPreviewFocus changes,
    // not when onClose identity changes (handled via ref above).
  }, [isOpen, isPreviewFocus]);

  // ── Auto-refresh preview Header & TTD ──────────────────────────────────────
  // PENTING: semua hooks HARUS di atas `if (!isOpen) return null` — Rules of Hooks.

  // Ref placeholder untuk applyHeaderTtdToPdf — diisi setelah fungsi didefinisikan di bawah
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyHeaderTtdToPdfRef = useRef<(url: string) => Promise<string>>(async (u) => u);

  const generateHeaderTtdPreview = useCallback(async () => {
    const sourceUrl = previewUrl;
    if (!sourceUrl || !formInfo.headerTtd.enabled) {
      setHeaderTtdPreviewUrl(null);
      return;
    }
    setIsGeneratingPreview(true);
    try {
      const result = await applyHeaderTtdToPdfRef.current(sourceUrl);
      setHeaderTtdPreviewUrl(result);
    } catch (e) {
      console.error("Preview header TTD gagal:", e);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [previewUrl, formInfo.headerTtd]);

  const generatePreviewRef = useRef(generateHeaderTtdPreview);
  useEffect(() => { generatePreviewRef.current = generateHeaderTtdPreview; }, [generateHeaderTtdPreview]);

  useEffect(() => {
    if ((activeTab as string) !== "headerttd") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      generatePreviewRef.current();
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formInfo.headerTtd, activeTab]);

  // ── Debounce footer preview ─────────────────────────────────────────────────
  const applyFooterToPdfRef = useRef<(url: string) => Promise<string>>(async (u) => u);

  const generateFooterPreview = useCallback(async () => {
    const src = rawFileUrl;
    if (!src) return;
    setIsGeneratingFooterPreview(true);
    try {
      const result = await applyFooterToPdfRef.current(src);
      setPreviewUrl(result);
    } catch (e) {
      console.error("Footer preview gagal:", e);
    } finally {
      setIsGeneratingFooterPreview(false);
    }
  }, [rawFileUrl]);

  const generateFooterPreviewRef = useRef(generateFooterPreview);
  useEffect(() => { generateFooterPreviewRef.current = generateFooterPreview; }, [generateFooterPreview]);

  useEffect(() => {
    if (!rawFileUrl) return;
    if (footerDebounceRef.current) clearTimeout(footerDebounceRef.current);
    footerDebounceRef.current = setTimeout(() => {
      generateFooterPreviewRef.current();
    }, 800);
    return () => {
      if (footerDebounceRef.current) clearTimeout(footerDebounceRef.current);
    };
  }, [formInfo.footerNote, formInfo.footerWidth, formInfo.offsetX, formInfo.positionY, formInfo.fontSize, formInfo.footerHeight, rawFileUrl]);

  // ── Drag resize panel ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPanelWidth(Math.min(75, Math.max(25, pct)));
    };
    const onMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  // ── handlers ───────────────────────────────────────────────────────────────

  // Rule 5.7: All interaction logic lives in the event handler — no bridging via state+effect.
  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    const raw = URL.createObjectURL(file);
    setRawFileUrl(raw);
    setPreviewUrl(raw);
    setFileSize(formatFileSize(file.size));
    setActiveTab("info");
    setIsReadingPdf(true);
    setPdfPageCount(await readPdfPageCount(file));
    setIsReadingPdf(false);
  };

  const handleFieldChange = <K extends keyof FormInfo>(
    key: K,
    value: FormInfo[K],
  ) => {
    setFormInfo((prev) => ({ ...prev, [key]: value }));
    if (key === "dividerTitle" || key === "footerNote") {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const applyFooterToPdf = async (sourceUrl: string): Promise<string> => {
    const bytes = await (await fetch(sourceUrl)).arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    const skipRanges = formInfo.lampiransCalk.map((lc) => ({
      from: lc.halamanMulai,
      to: lc.sampaiAkhir ? total : lc.halamanMulai + lc.jumlahHalaman - 1,
    }));

    let counter = startPage;
    pages.forEach((page, idx) => {
      if (skipRanges.some((r) => idx + 1 >= r.from && idx + 1 <= r.to)) return;
      const { width: pw } = page.getSize();
      const bw = (pw * formInfo.footerWidth) / 100;
      const x = (pw - bw) / 2 + formInfo.offsetX;
      const y = formInfo.positionY;
      const fs = formInfo.fontSize;
      if (formInfo.isCalk) {
        const ly = y + 20;
        const lbl = `Halaman ${counter}`;
        const lw = font.widthOfTextAtSize(lbl, fs);
        const re = pw - 100;
        page.drawText(lbl, {
          x: re - lw - 5,
          y: ly,
          size: fs,
          font,
          color: rgb(0, 0, 0),
        });
      } else {
        page.drawRectangle({
          x,
          y,
          width: bw,
          height: formInfo.footerHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        page.drawText(formInfo.footerNote, {
          x: x + 10,
          y: y + formInfo.footerHeight / 2 - fs / 2,
          size: fs,
          font,
          color: rgb(0, 0, 0),
          maxWidth: bw - 120,
        });
        const lbl = `Halaman ${counter}`;
        const lw = font.widthOfTextAtSize(lbl, fs);
        page.drawText(lbl, {
          x: x + bw - lw - 10,
          y: y + formInfo.footerHeight / 2 - fs / 2,
          size: fs,
          font,
          color: rgb(0, 0, 0),
        });
      }
      counter++;
    });

    const blob = new Blob([new Uint8Array(await pdfDoc.save()).buffer], {
      type: "application/pdf",
    });
    return URL.createObjectURL(blob);
  };
  applyFooterToPdfRef.current = applyFooterToPdf;

  /**
   * Terapkan header (pojok kanan atas hal. 1) dan TTD (pojok kanan bawah hal. terakhir)
   * ke PDF yang sudah ada. Bersifat overlay/menimpa — teks putih di-draw dulu sebagai
   * "penghapus" lebar, kemudian teks baru di-draw di atasnya.
   */
  const applyHeaderTtdToPdf = async (sourceUrl: string): Promise<string> => {
    const cfg = formInfo.headerTtd;
    if (!cfg.enabled) return sourceUrl;

    const bytes = await (await fetch(sourceUrl)).arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    if (pages.length === 0) return sourceUrl;

    const fs = cfg.header.fontSize;
    const lineH = fs + 5;

    // ── HEADER (halaman pertama, pojok kanan atas) ──────────────────────────
    const firstPage = pages[0];
    const { width: pw, height: ph } = firstPage.getSize();

    // Baris pertama: "LAMPIRAN {romawi}  :  {judul peraturan}"
    // Baris 2-3: label + titik dua SEJAJAR dengan titik dua baris pertama
    // Teknik: ukur lebar label terpanjang, pad dengan spasi agar ":" sejajar.
    const labelLampiran = `Lampiran ${formInfo.romanPage}`;
    const labelNomor    = "Nomor";
    const labelTanggal  = "Tanggal";

    // Lebar label terpanjang di antara ketiganya
    const maxLabelW = Math.max(
      font.widthOfTextAtSize(labelLampiran, fs),
      font.widthOfTextAtSize(labelNomor,    fs),
      font.widthOfTextAtSize(labelTanggal,  fs),
    );

    // Fungsi padding: tambah spasi sampai lebar label mencapai maxLabelW
    const padLabel = (label: string): string => {
      let padded = label;
      while (font.widthOfTextAtSize(padded + " ", fs) <= maxLabelW + 2) {
        padded += " ";
      }
      return padded;
    };

    const col1W = maxLabelW + font.widthOfTextAtSize("  :  ", fs);

    const headerRows: Array<{ label: string; value: string; bold: boolean }> = [
      {
        label: labelLampiran,
        value: `${toTitleCase(LABEL_JENIS_MAP[jenisLaporan])} ${toTitleCase(namaDaerah)}`,
        bold: false,
      },
      { label: labelNomor,   value: cfg.nomor   || "", bold: false },
      { label: labelTanggal, value: cfg.tanggal || "", bold: false },
    ];

    // Hitung lebar teks terpanjang per baris lengkap
    const rowTexts = headerRows.map(
      (r) => `${padLabel(r.label)}  :  ${r.value}`,
    );
    const maxRowW = rowTexts.reduce(
      (m, t) => Math.max(m, font.widthOfTextAtSize(t, fs)),
      0,
    );
    const blockW = maxRowW + 16;
    const blockH = headerRows.length * lineH + 8;

    // Posisi: pojok kanan - marginRight adalah tepi KANAN blok, bukan kiri
    const hx = pw - cfg.header.marginRight - blockW;
    const hy = ph - cfg.header.marginTop;

    // Overlay putih mentok kiri dan kanan halaman — menimpa header lama sepenuhnya
    firstPage.drawRectangle({
      x: 0,
      y: hy - blockH - 8,
      width: pw,
      height: blockH + 16,
      color: rgb(1, 1, 1),
      opacity: 1,
    });

    headerRows.forEach((row, i) => {
      const paddedLabel = padLabel(row.label);
      const lineY = hy - lineH * (i + 1) + (lineH - fs);

      // Gambar label
      firstPage.drawText(paddedLabel, {
        x: hx,
        y: lineY,
        size: fs,
        font: row.bold ? font : fontReg,
        color: rgb(0, 0, 0),
      });

      // Gambar "  :  " dan value di posisi kolom yang tetap
      const colonX = hx + maxLabelW;
      firstPage.drawText("  :  ", {
        x: colonX,
        y: lineY,
        size: fs,
        font: fontReg,
        color: rgb(0, 0, 0),
      });

      if (row.value) {
        firstPage.drawText(row.value, {
          x: colonX + font.widthOfTextAtSize("  :  ", fs),
          y: lineY,
          size: fs,
          font: fontReg,
          color: rgb(0, 0, 0),
        });
      }
    });

    // ── TTD (halaman terakhir, pojok kanan bawah) ───────────────────────────
    const lastPage = pages[pages.length - 1];
    const { width: lpw } = lastPage.getSize();
    const ttdFs = cfg.ttd.fontSize;
    const ttdLineH = ttdFs + 5;

    // 5 baris: BUPATI + 3 baris kosong (ruang TTD) + nama — semua BOLD & KAPITAL
    const ttdLines = [
      `BUPATI ${namaDaerah.toUpperCase()}`,
      "", "", "",
      namaKepalaDaerah.toUpperCase(),
    ];

    const line0W = font.widthOfTextAtSize(ttdLines[0], ttdFs);
    const line4W = font.widthOfTextAtSize(ttdLines[4], ttdFs);
    const maxTW = Math.max(line0W, line4W);
    const ttdBlockW = maxTW + 16;
    const ttdBlockH = ttdLines.length * ttdLineH + 8;

    const tx = lpw - cfg.ttd.marginRight - ttdBlockW;
    const ty = cfg.ttd.marginBottom;

    lastPage.drawRectangle({
      x: 0,
      y: ty - 8,
      width: lpw,
      height: ttdBlockH + 16,
      color: rgb(1, 1, 1),
      opacity: 1,
    });

    ttdLines.forEach((line, i) => {
      if (!line) return;
      const lineW = font.widthOfTextAtSize(line, ttdFs);
      const centeredX = tx + (maxTW - lineW) / 2;
      lastPage.drawText(line, {
        x: centeredX,
        y: ty + ttdBlockH - ttdLineH * (i + 1),
        size: ttdFs,
        font,
        color: rgb(0, 0, 0),
      });
    });

    const blob = new Blob([new Uint8Array(await pdfDoc.save()).buffer], {
      type: "application/pdf",
    });
    return URL.createObjectURL(blob);
  };
  // Isi ref agar generateHeaderTtdPreview bisa memanggil fungsi ini
  applyHeaderTtdToPdfRef.current = applyHeaderTtdToPdf;

  const handleSave = async () => {
    // Rule 7.8: Early return for missing file in add mode.
    if (!isEditMode && !selectedFile) return;
    const errs = validate(formInfo);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setActiveTab("info");
      return;
    }

    setIsSaving(true);
    try {
      const rawUrl = selectedFile
        ? URL.createObjectURL(selectedFile)
        : isEditMode
          ? editData!.rawFileUrl
          : "";
      const footerUrl = rawUrl ? await applyFooterToPdf(rawUrl) : "";
      const fileUrl = footerUrl ? await applyHeaderTtdToPdf(footerUrl) : "";
      const footer = {
        text: formInfo.footerNote,
        width: formInfo.footerWidth,
        height: formInfo.footerHeight,
        position: { x: formInfo.offsetX, y: formInfo.positionY },
        fontSize: formInfo.fontSize,
      };
      // Merge lampiransCalk into babs[0] (persisted separately for skip-range logic)
      const babsCalk: BabCalk[] = formInfo.isCalk
        ? formInfo.babs
            .map((b, i) =>
              i === 0 ? { ...b, lampiranCalk: formInfo.lampiransCalk } : b,
            )
            .concat(
              formInfo.babs.length === 0
                ? [
                    {
                      id: crypto.randomUUID(),
                      bab: "1",
                      judul: "",
                      halamanMulai: 1,
                      subbabs: [],
                      lampiranCalk: formInfo.lampiransCalk,
                    },
                  ]
                : [],
            )
        : [];

      const lampiran: LampiranUtama = isEditMode
        ? {
            ...editData!,
            romawiLampiran: formInfo.romanPage,
            judulPembatasLampiran: formInfo.dividerTitle,
            isCALK: formInfo.isCalk,
            footer,
            babs: formInfo.isCalk ? babsCalk : editData!.babs,
            fileUrl: fileUrl || editData!.fileUrl,
            rawFileUrl: rawUrl || editData!.rawFileUrl,
            headerTtd: formInfo.headerTtd,
            ...(selectedFile && {
              namaFileDiStorageLokal: selectedFile.name,
              ukuranFile: fileSize,
              jumlahHalaman: pdfPageCount,
            }),
          }
        : {
            id: crypto.randomUUID(),
            urutan: nextUrutan,
            fileUrl,
            rawFileUrl: rawUrl,
            namaFileDiStorageLokal: selectedFile!.name,
            ukuranFile: fileSize,
            romawiLampiran: formInfo.romanPage || toRomawi(nextUrutan),
            judulPembatasLampiran: formInfo.dividerTitle,
            footer,
            jumlahHalaman: pdfPageCount,
            jumlahTotalLembar: 0,
            isCALK: formInfo.isCalk,
            babs: babsCalk,
            isCoverInduk: false,
            headerTtd: formInfo.headerTtd,
          };

      onSave(lampiran);
      onClose();
    } catch (e) {
      console.error("Gagal apply footer:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = (hasError?: boolean) =>
    `w-full rounded-xl border px-5 py-4 text-base transition-all focus:outline-none focus:ring-1 ${
      hasError
        ? "border-red-400 focus:border-red-400 focus:ring-red-400"
        : "border-gray-200 focus:border-indigo-400 focus:ring-indigo-400"
    }`;

  // Rule 5.3: Simple boolean expression with primitive result — not wrapped in useMemo.
  const isDisabled = (!isEditMode && !selectedFile) || isReadingPdf || isSaving;

  // Rule 5.1: Derived boolean — computed during render with no extra state.
  const hasErrors = Object.keys(errors).length > 0;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-md"
      onClick={(e) => {
        if (!isPreviewFocus && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex ${isPreviewFocus ? "h-[95vh]" : "h-[90vh]"} w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-500`}
      >
        {/* HEADER */}
        {!isPreviewFocus && (
          <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-8 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-2">
                <DocumentArrowUpIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-gray-900">
                  {isEditMode ? "Edit Lampiran PDF" : "Tambah Lampiran PDF"}
                </h3>
                <p className="text-sm text-gray-500">
                  {isEditMode
                    ? "Ubah informasi atau ganti file lampiran"
                    : "Unggah dokumen dan atur informasi lampiran"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-xl p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* BODY */}
        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL */}
          {!isPreviewFocus && (
            <div
              className="overflow-y-auto border-r border-gray-100"
              style={{ width: `${leftPanelWidth}%`, flexShrink: 0 }}
            >
              {/* Tabs */}
              <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white/90 px-6 pt-4 backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "upload" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <DocumentArrowUpIcon className="h-5 w-5" />
                  {isEditMode ? "Ganti File" : "Upload File"}
                </button>
                <button
                  onClick={() => setActiveTab("info")}
                  disabled={!isEditMode && !selectedFile}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${!isEditMode && !selectedFile ? "cursor-not-allowed text-gray-300" : activeTab === "info" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <InformationCircleIcon className="h-5 w-5" />
                  Informasi Lampiran
                  {hasErrors && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </button>
                {formInfo.isCalk && (
                  <button
                    onClick={() => setActiveTab("daftarisi")}
                    disabled={!isEditMode && !selectedFile}
                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${!isEditMode && !selectedFile ? "cursor-not-allowed text-gray-300" : activeTab === "daftarisi" ? "border-b-2 border-amber-500 text-amber-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <BookOpenIcon className="h-5 w-5" />
                    Daftar Isi CALK
                    <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      {formInfo.babs.length}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab("headerttd" as any)}
                  disabled={!isEditMode && !selectedFile}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${!isEditMode && !selectedFile ? "cursor-not-allowed text-gray-300" : activeTab === ("headerttd" as any) ? "border-b-2 border-violet-600 text-violet-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <PencilIcon className="h-5 w-5" />
                  Header & TTD
                  {formInfo.headerTtd.enabled && (
                    <span className="ml-1 h-2 w-2 rounded-full bg-violet-500" />
                  )}
                </button>
              </div>

              {/* Tab content */}
              <div className="p-8">
                {/* ── TAB UPLOAD ── */}
                {activeTab === "upload" && (
                  <div className="space-y-6">
                    {!selectedFile && !isEditMode ? (
                      <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/50 p-16 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-lg">
                        <div className="mb-4 rounded-full bg-indigo-50 p-6 transition-all group-hover:scale-110 group-hover:bg-indigo-100">
                          <DocumentArrowUpIcon className="h-14 w-14 text-indigo-500" />
                        </div>
                        <span className="text-lg font-medium text-gray-700">
                          Klik untuk memilih file PDF
                        </span>
                        <span className="mt-2 text-base text-gray-400">
                          atau seret dan lepas file di sini
                        </span>
                        <span className="mt-6 rounded-full bg-gray-100 px-5 py-2 text-sm font-medium text-gray-600">
                          Maksimal 10MB
                        </span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) =>
                            handleFileChange(e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="rounded-lg bg-indigo-100 p-3">
                                <DocumentArrowUpIcon className="h-10 w-10 text-indigo-600" />
                              </div>
                              <div>
                                <p className="max-w-xs truncate text-base font-medium text-gray-900">
                                  {selectedFile
                                    ? selectedFile.name
                                    : editData?.namaFileDiStorageLokal}
                                </p>
                                {!selectedFile && isEditMode && (
                                  <p className="text-xs text-gray-400">
                                    File saat ini
                                  </p>
                                )}
                              </div>
                            </div>
                            {selectedFile && (
                              <button
                                onClick={() => {
                                  setSelectedFile(null);
                                  setPdfPageCount(editData?.jumlahHalaman ?? 0);
                                  setPreviewUrl(editData?.fileUrl ?? null);
                                  setFileSize(editData?.ukuranFile ?? "");
                                  if (!isEditMode) setActiveTab("upload");
                                }}
                                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm">
                            <div>
                              <p className="text-xs text-gray-400">
                                Ukuran File
                              </p>
                              <p className="font-medium text-gray-700">
                                {fileSize || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">
                                Jumlah Halaman
                              </p>
                              <p className="font-medium text-gray-700">
                                {isReadingPdf ? (
                                  <span className="text-indigo-500">
                                    Membaca...
                                  </span>
                                ) : pdfPageCount > 0 ? (
                                  `${pdfPageCount} halaman`
                                ) : (
                                  "—"
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                        {isEditMode && (
                          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/20">
                            <PencilIcon className="h-5 w-5 text-gray-400" />
                            <span className="text-sm text-gray-500">
                              Klik untuk mengganti file PDF
                            </span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                handleFileChange(e.target.files?.[0] ?? null)
                              }
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB INFO ── */}
                {activeTab === "info" && (
                  <div className="space-y-6">
                    {/* File summary */}
                    {(selectedFile || isEditMode) && (
                      <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="rounded-lg bg-indigo-100 p-2">
                          <DocumentArrowUpIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {selectedFile
                              ? selectedFile.name
                              : editData?.namaFileDiStorageLokal}
                          </p>
                          <p className="text-xs text-gray-400">
                            {isReadingPdf ? (
                              <span className="text-indigo-500">
                                Membaca...
                              </span>
                            ) : pdfPageCount > 0 ? (
                              `${pdfPageCount} halaman`
                            ) : (
                              "—"
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* CALK checkbox */}
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-200 hover:bg-indigo-50/30">
                      <input
                        type="checkbox"
                        checked={formInfo.isCalk}
                        onChange={(e) =>
                          handleFieldChange("isCalk", e.target.checked)
                        }
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-base font-medium text-gray-700">
                          Apakah lampiran CALK
                        </span>
                        <p className="text-sm text-gray-500">
                          Centang jika ini adalah lampiran CALK — penomoran
                          halaman meneruskan lampiran sebelumnya
                        </p>
                      </div>
                    </label>

                    {/* Lampiran CALK section */}
                    {formInfo.isCalk && (
                      <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
                            <BookOpenIcon className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-amber-800">
                              Lampiran CALK (tanpa nomor halaman)
                            </p>
                            <p className="mt-0.5 text-xs text-amber-600">
                              Halaman lampiran di dalam CALK ini yang{" "}
                              <strong>tidak</strong> diberi nomor footer.
                              Centang <strong>&quot;s/d akhir&quot;</strong>{" "}
                              jika lampiran dimulai dari halaman tertentu hingga
                              akhir PDF.
                            </p>
                          </div>
                        </div>

                        {formInfo.lampiransCalk.length > 0 && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-[1fr_90px_80px_90px_36px] gap-2 px-1 text-xs font-medium text-amber-700">
                              <span>Nama Lampiran</span>
                              <span className="text-center">Hal. Mulai</span>
                              <span className="text-center">s/d Akhir</span>
                              <span className="text-center">Jml Hal.</span>
                              <span />
                            </div>
                            {formInfo.lampiransCalk.map((lc, idx) => {
                              const jumlahAuto = lc.sampaiAkhir
                                ? Math.max(
                                    0,
                                    pdfPageCount - lc.halamanMulai + 1,
                                  )
                                : lc.jumlahHalaman;
                              return (
                                <div
                                  key={lc.id}
                                  className="grid grid-cols-[1fr_90px_80px_90px_36px] items-center gap-2"
                                >
                                  <input
                                    type="text"
                                    value={lc.nama}
                                    placeholder="Nama lampiran"
                                    onChange={(e) => {
                                      const u = [...formInfo.lampiransCalk];
                                      u[idx] = { ...lc, nama: e.target.value };
                                      handleFieldChange("lampiransCalk", u);
                                    }}
                                    className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-300 focus:outline-none"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={pdfPageCount || 9999}
                                    value={lc.halamanMulai}
                                    onChange={(e) => {
                                      const u = [...formInfo.lampiransCalk];
                                      u[idx] = {
                                        ...lc,
                                        halamanMulai:
                                          parseInt(e.target.value) || 1,
                                      };
                                      handleFieldChange("lampiransCalk", u);
                                    }}
                                    className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-center text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-300 focus:outline-none"
                                  />
                                  <label
                                    className="flex cursor-pointer flex-col items-center gap-1"
                                    title="Dari halaman ini hingga akhir PDF — tidak perlu isi jumlah halaman"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={lc.sampaiAkhir}
                                      onChange={(e) => {
                                        const u = [...formInfo.lampiransCalk];
                                        u[idx] = {
                                          ...lc,
                                          sampaiAkhir: e.target.checked,
                                        };
                                        handleFieldChange("lampiransCalk", u);
                                      }}
                                      className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
                                    />
                                    <span className="text-[10px] whitespace-nowrap text-amber-600">
                                      s/d akhir
                                    </span>
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={lc.sampaiAkhir}
                                    value={jumlahAuto || ""}
                                    onChange={(e) => {
                                      const u = [...formInfo.lampiransCalk];
                                      u[idx] = {
                                        ...lc,
                                        jumlahHalaman:
                                          parseInt(e.target.value) || 1,
                                      };
                                      handleFieldChange("lampiransCalk", u);
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-center text-sm focus:ring-1 focus:outline-none ${lc.sampaiAkhir ? "cursor-not-allowed border-amber-100 bg-amber-50 text-amber-500" : "border-amber-200 bg-white focus:border-amber-400 focus:ring-amber-300"}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleFieldChange(
                                        "lampiransCalk",
                                        formInfo.lampiransCalk.filter(
                                          (_, i) => i !== idx,
                                        ),
                                      )
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-400 transition hover:bg-amber-100 hover:text-red-500"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })}
                            <div className="flex justify-end pt-1 text-xs text-amber-700">
                              Total halaman tanpa nomor:{" "}
                              <strong className="ml-1">
                                {formInfo.lampiransCalk.reduce(
                                  (s, lc) =>
                                    s +
                                    (lc.sampaiAkhir
                                      ? Math.max(
                                          0,
                                          pdfPageCount - lc.halamanMulai + 1,
                                        )
                                      : lc.jumlahHalaman || 0),
                                  0,
                                )}{" "}
                                halaman
                              </strong>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleFieldChange("lampiransCalk", [
                              ...formInfo.lampiransCalk,
                              {
                                id: crypto.randomUUID(),
                                nama: "",
                                halamanMulai: pdfPageCount || 1,
                                jumlahHalaman: 1,
                                sampaiAkhir: true,
                              },
                            ])
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-white/60 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:border-amber-400 hover:bg-amber-50"
                        >
                          <span className="text-lg leading-none">+</span>
                          Tambah Lampiran CALK
                        </button>
                      </div>
                    )}

                    {/* Romawi */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Romawi Lampiran
                      </label>
                      <input
                        type="text"
                        value={formInfo.romanPage}
                        onChange={(e) =>
                          handleFieldChange("romanPage", e.target.value)
                        }
                        placeholder="Contoh: I, II, III"
                        className={inputCls()}
                      />
                    </div>

                    {/* Judul */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Judul Pembatas Lampiran{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formInfo.dividerTitle}
                        onChange={(e) =>
                          handleFieldChange("dividerTitle", e.target.value)
                        }
                        placeholder="Masukkan judul pembatas"
                        className={inputCls(!!errors.dividerTitle)}
                      />
                      {errors.dividerTitle && (
                        <p className="text-sm text-red-500">
                          {errors.dividerTitle}
                        </p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Keterangan Footer Halaman{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formInfo.footerNote}
                        onChange={(e) =>
                          handleFieldChange("footerNote", e.target.value)
                        }
                        placeholder="Masukkan keterangan footer"
                        rows={4}
                        className={inputCls(!!errors.footerNote)}
                      />
                      {errors.footerNote && (
                        <p className="text-sm text-red-500">
                          {errors.footerNote}
                        </p>
                      )}
                    </div>

                    {/* Grid settings */}
                    <div className="grid grid-cols-3 gap-4">
                      {(
                        [
                          { label: "Lebar Footer (%)", key: "footerWidth" },
                          { label: "Offset X", key: "offsetX" },
                          { label: "Posisi Y", key: "positionY" },
                          { label: "Font Size", key: "fontSize" },
                        ] as { label: string; key: keyof FormInfo }[]
                      ).map(({ label, key }) => (
                        <div key={key} className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {label}
                          </label>
                          <input
                            type="number"
                            value={formInfo[key] as number}
                            onChange={(e) =>
                              handleFieldChange(
                                key,
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                          />
                        </div>
                      ))}
                      <div className="col-span-2 space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Tinggi Footer
                        </label>
                        <input
                          type="number"
                          value={formInfo.footerHeight}
                          onChange={(e) =>
                            handleFieldChange(
                              "footerHeight",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Preview settings */}
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <ArrowsPointingOutIcon className="h-5 w-5 text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-700">
                          Preview Setting:
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm text-gray-600">
                        <div>Lebar Footer: {formInfo.footerWidth}%</div>
                        <div>Offset X: {formInfo.offsetX}</div>
                        <div>Posisi Y: {formInfo.positionY}</div>
                        <div>Font Size: {formInfo.fontSize}px</div>
                        <div className="col-span-2">
                          Tinggi Footer: {formInfo.footerHeight}px
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB DAFTAR ISI CALK ── */}
                {activeTab === "daftarisi" && (
                  <div className="space-y-6">
                    {/* Header info */}
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
                        <BookOpenIcon className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Input Bab & Subbab CALK
                        </p>
                        <p className="mt-0.5 text-xs text-amber-600">
                          Tambahkan bab dan subbab beserta nomor halaman awal
                          (relatif dalam PDF ini). Data ini digunakan untuk
                          membuat daftar isi saat generate dokumen.
                        </p>
                      </div>
                    </div>

                    {/* Bab list */}
                    <div className="space-y-3">
                      {formInfo.babs.map((bab, babIdx) => (
                        <div
                          key={bab.id}
                          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                        >
                          {/* Bab header row */}
                          <div className="flex items-center gap-3 bg-gray-50 px-4 py-3">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                              {babIdx + 1}
                            </span>
                            {/* Nomor bab */}
                            <input
                              type="text"
                              value={bab.bab}
                              onChange={(e) => {
                                const u = [...formInfo.babs];
                                u[babIdx] = { ...bab, bab: e.target.value };
                                handleFieldChange("babs", u);
                              }}
                              placeholder="No. (I, II, ...)"
                              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                            />
                            {/* Judul bab */}
                            <input
                              type="text"
                              value={bab.judul}
                              onChange={(e) => {
                                const u = [...formInfo.babs];
                                u[babIdx] = { ...bab, judul: e.target.value };
                                handleFieldChange("babs", u);
                              }}
                              placeholder="Judul bab..."
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                            />
                            {/* Hal. mulai */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-400">
                                Hal.
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={bab.halamanMulai}
                                onChange={(e) => {
                                  const u = [...formInfo.babs];
                                  u[babIdx] = {
                                    ...bab,
                                    halamanMulai: parseInt(e.target.value) || 1,
                                  };
                                  handleFieldChange("babs", u);
                                }}
                                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                              />
                            </div>
                            {/* Hapus bab */}
                            <button
                              type="button"
                              onClick={() => {
                                handleFieldChange(
                                  "babs",
                                  formInfo.babs.filter((_, i) => i !== babIdx),
                                );
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Subbab list */}
                          <div className="divide-y divide-gray-50 px-4 py-2">
                            {bab.subbabs.map((sub, subIdx) => (
                              <div
                                key={sub.id}
                                className="flex items-center gap-2 py-2"
                              >
                                <span className="w-4 flex-shrink-0 text-center text-xs text-gray-300">
                                  —
                                </span>
                                {/* Nomor subbab */}
                                <input
                                  type="text"
                                  value={sub.subbab}
                                  onChange={(e) => {
                                    const u = [...formInfo.babs];
                                    const subs = [...bab.subbabs];
                                    subs[subIdx] = {
                                      ...sub,
                                      subbab: e.target.value,
                                    };
                                    u[babIdx] = { ...bab, subbabs: subs };
                                    handleFieldChange("babs", u);
                                  }}
                                  placeholder="No. (1, 2, ...)"
                                  className="w-16 rounded-lg border border-gray-100 px-2 py-1 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-300 focus:outline-none"
                                />
                                {/* Judul subbab */}
                                <input
                                  type="text"
                                  value={sub.judul}
                                  onChange={(e) => {
                                    const u = [...formInfo.babs];
                                    const subs = [...bab.subbabs];
                                    subs[subIdx] = {
                                      ...sub,
                                      judul: e.target.value,
                                    };
                                    u[babIdx] = { ...bab, subbabs: subs };
                                    handleFieldChange("babs", u);
                                  }}
                                  placeholder="Judul subbab..."
                                  className="flex-1 rounded-lg border border-gray-100 px-3 py-1 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-300 focus:outline-none"
                                />
                                {/* Hal. mulai subbab */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-gray-400">
                                    Hal.
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={sub.halamanMulai}
                                    onChange={(e) => {
                                      const u = [...formInfo.babs];
                                      const subs = [...bab.subbabs];
                                      subs[subIdx] = {
                                        ...sub,
                                        halamanMulai:
                                          parseInt(e.target.value) || 1,
                                      };
                                      u[babIdx] = { ...bab, subbabs: subs };
                                      handleFieldChange("babs", u);
                                    }}
                                    className="w-16 rounded-lg border border-gray-100 px-2 py-1 text-center text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-300 focus:outline-none"
                                  />
                                </div>
                                {/* Hapus subbab */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const u = [...formInfo.babs];
                                    u[babIdx] = {
                                      ...bab,
                                      subbabs: bab.subbabs.filter(
                                        (_, i) => i !== subIdx,
                                      ),
                                    };
                                    handleFieldChange("babs", u);
                                  }}
                                  className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-200 transition hover:bg-red-50 hover:text-red-400"
                                >
                                  <XMarkIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}

                            {/* Tambah subbab */}
                            <button
                              type="button"
                              onClick={() => {
                                const u = [...formInfo.babs];
                                const newSub: SubbabCalk = {
                                  id: crypto.randomUUID(),
                                  subbab: (bab.subbabs.length + 1).toString(),
                                  judul: "",
                                  halamanMulai: bab.halamanMulai,
                                };
                                u[babIdx] = {
                                  ...bab,
                                  subbabs: [...bab.subbabs, newSub],
                                };
                                handleFieldChange("babs", u);
                              }}
                              className="flex w-full items-center gap-1.5 py-2 text-xs font-medium text-amber-600 transition hover:text-amber-700"
                            >
                              <span className="text-sm leading-none">+</span>
                              Tambah subbab
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tambah bab */}
                    <button
                      type="button"
                      onClick={() => {
                        const newBab: BabCalk = {
                          id: crypto.randomUUID(),
                          bab: (formInfo.babs.length + 1).toString(),
                          judul: "",
                          halamanMulai: 1,
                          subbabs: [],
                          lampiranCalk: [],
                        };
                        handleFieldChange("babs", [...formInfo.babs, newBab]);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/30 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50"
                    >
                      <span className="text-lg leading-none">+</span>
                      Tambah Bab
                    </button>

                    {formInfo.babs.length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-gray-400">
                        <BookOpenIcon className="h-10 w-10 text-gray-200" />
                        <p className="text-sm">
                          Belum ada bab. Klik &quot;Tambah Bab&quot; untuk
                          mulai.
                        </p>
                        <p className="text-xs text-gray-300">
                          Nomor halaman bersifat relatif dalam PDF ini.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB HEADER & TTD ── */}
                {activeTab === ("headerttd" as any) && (
                  <div className="space-y-6">
                    {/* Toggle aktifkan */}
                    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-5">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={formInfo.headerTtd.enabled}
                          onChange={(e) =>
                            handleFieldChange("headerTtd", {
                              ...formInfo.headerTtd,
                              enabled: e.target.checked,
                            })
                          }
                          className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <div>
                          <span className="text-base font-medium text-gray-800">
                            Aktifkan Header & Tanda Tangan
                          </span>
                          <p className="text-sm text-gray-500">
                            Header di pojok kanan atas hal. pertama + TTD di pojok kanan bawah hal. terakhir. Bersifat overlay — menimpa konten lama.
                          </p>
                        </div>
                      </label>
                    </div>

                    {formInfo.headerTtd.enabled && (
                      <>
                        {/* ── ISI HEADER ── */}
                        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
                          <h3 className="text-sm font-semibold text-gray-700">Isi Header</h3>
                          <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-600 leading-relaxed">
                            <div>Lampiran {formInfo.romanPage}&nbsp;&nbsp;:&nbsp;&nbsp;{toTitleCase(LABEL_JENIS_MAP[jenisLaporan])} {toTitleCase(namaDaerah)}</div>
                            <div>Nomor&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;{formInfo.headerTtd.nomor || "....."}</div>
                            <div>Tanggal&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;{formInfo.headerTtd.tanggal || "....."}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="block text-sm font-medium text-gray-700">Nomor</label>
                              <input
                                type="text"
                                value={formInfo.headerTtd.nomor}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    nomor: e.target.value,
                                  })
                                }
                                placeholder="Kosongkan jika belum ada"
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-violet-400 focus:ring-1 focus:ring-violet-400 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                              <input
                                type="text"
                                value={formInfo.headerTtd.tanggal}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    tanggal: e.target.value,
                                  })
                                }
                                placeholder="Contoh: 9 Juli 2026"
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-violet-400 focus:ring-1 focus:ring-violet-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* ── POSISI & UKURAN HEADER ── */}
                        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
                          <h3 className="text-sm font-semibold text-gray-700">Posisi Header (hal. pertama)</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-gray-600">Jarak dari kanan (pt)</label>
                              <input
                                type="number"
                                value={formInfo.headerTtd.header.marginRight}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    header: { ...formInfo.headerTtd.header, marginRight: Number(e.target.value) },
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-gray-600">Jarak dari atas (pt)</label>
                              <input
                                type="number"
                                value={formInfo.headerTtd.header.marginTop}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    header: { ...formInfo.headerTtd.header, marginTop: Number(e.target.value) },
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-gray-600">Ukuran font (pt)</label>
                              <input
                                type="number"
                                value={formInfo.headerTtd.header.fontSize}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    header: { ...formInfo.headerTtd.header, fontSize: Number(e.target.value) },
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* ── POSISI & UKURAN TTD ── */}
                        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
                          <h3 className="text-sm font-semibold text-gray-700">Posisi Tanda Tangan (hal. terakhir)</h3>
                          <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-600 leading-relaxed text-center">
                            <div className="font-bold">BUPATI {namaDaerah.toUpperCase()}</div>
                            <div className="my-4 text-gray-300">[ ruang TTD ]</div>
                            <div className="font-bold">{namaKepalaDaerah.toUpperCase()}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-gray-600">Jarak dari kanan (pt)</label>
                              <input
                                type="number"
                                value={formInfo.headerTtd.ttd.marginRight}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    ttd: { ...formInfo.headerTtd.ttd, marginRight: Number(e.target.value) },
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-gray-600">Jarak dari bawah (pt)</label>
                              <input
                                type="number"
                                value={formInfo.headerTtd.ttd.marginBottom}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    ttd: { ...formInfo.headerTtd.ttd, marginBottom: Number(e.target.value) },
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-gray-600">Ukuran font (pt)</label>
                              <input
                                type="number"
                                value={formInfo.headerTtd.ttd.fontSize}
                                onChange={(e) =>
                                  handleFieldChange("headerTtd", {
                                    ...formInfo.headerTtd,
                                    ttd: { ...formInfo.headerTtd.ttd, fontSize: Number(e.target.value) },
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DRAG DIVIDER */}
          {!isPreviewFocus && (
            <div
              onMouseDown={() => setIsDragging(true)}
              className={`group relative z-10 flex w-2 flex-shrink-0 cursor-col-resize items-center justify-center bg-gray-100 transition-colors hover:bg-indigo-200 ${isDragging ? "bg-indigo-300" : ""}`}
            >
              <div className={`h-12 w-1 rounded-full transition-colors ${isDragging ? "bg-indigo-500" : "bg-gray-300 group-hover:bg-indigo-400"}`} />
            </div>
          )}

          {/* RIGHT PANEL */}
          <div
            className={`flex flex-col overflow-hidden bg-gradient-to-br from-gray-50 to-white transition-colors duration-200 ${isDragging ? "select-none" : ""}`}
            style={{ flex: 1 }}
          >
            {/* Saat tab headerttd: tampilkan preview hasil header+TTD */}
            {(activeTab as string) === "headerttd" ? (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
                  <div className="flex items-center gap-3">
                    {isGeneratingPreview ? (
                      <div className="h-2 w-2 animate-ping rounded-full bg-violet-400" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-violet-500" />
                    )}
                    <span className="text-sm font-medium text-gray-600">
                      {isGeneratingPreview ? "Memperbarui preview..." : "Preview Header & TTD"}
                    </span>
                  </div>
                  <button
                    onClick={generateHeaderTtdPreview}
                    disabled={isGeneratingPreview || !previewUrl}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Refresh
                  </button>
                  {headerTtdPreviewUrl && (
                    <button
                      onClick={() => window.open(headerTtdPreviewUrl, "_blank")}
                      title="Buka fullscreen di tab baru"
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Fullscreen
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-hidden bg-gray-200 p-2">
                  {headerTtdPreviewUrl ? (
                    <iframe
                      src={headerTtdPreviewUrl}
                      className="h-full w-full rounded-lg bg-white shadow-inner"
                      title="Preview Header & TTD"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
                      <svg className="h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      <p className="text-sm">
                        {!previewUrl
                          ? "Upload file PDF terlebih dahulu"
                          : !formInfo.headerTtd.enabled
                            ? "Aktifkan Header & TTD untuk melihat preview"
                            : "Preview akan muncul otomatis..."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : previewUrl ? (
              <>
                <div
                  className={`flex items-center justify-between border-b border-gray-100 px-6 py-4 ${isPreviewFocus ? "bg-indigo-50/50" : "bg-white"}`}
                >
                  <div className="flex items-center gap-3">
                    {isGeneratingFooterPreview ? (
                      <div className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                    ) : (
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    )}
                    <span className="text-sm font-medium text-gray-600">
                      Preview Dokumen
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {previewUrl && (
                      <button
                        onClick={() => window.open(previewUrl, "_blank")}
                        title="Buka fullscreen di tab baru"
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        Fullscreen
                      </button>
                    )}
                    <button
                      onClick={() => setIsPreviewFocus(!isPreviewFocus)}
                      className="group flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg"
                    >
                      {isPreviewFocus ? (
                        <>
                          <ChevronDownIcon className="h-4 w-4" /> Kembali ke Layout
                        </>
                      ) : (
                        <>
                          <ChevronUpIcon className="h-4 w-4" /> Fokus Preview
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden bg-gray-100 p-2">
                  <iframe
                    src={previewUrl}
                    className="h-full w-full rounded-lg bg-white shadow-inner"
                    title="PDF Preview"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-gray-400">
                <div className="rounded-full bg-gray-100 p-8">
                  <DocumentArrowUpIcon className="h-16 w-16 text-gray-300" />
                </div>
                <p className="mt-4 text-lg">Preview akan muncul di sini</p>
                <p className="mt-2 text-sm">Setelah Anda memilih file PDF</p>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        {!isPreviewFocus && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-8 py-5">
            <div className="flex items-center gap-2 text-sm">
              {hasErrors ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-red-500">
                    Harap lengkapi field yang wajib diisi
                  </span>
                </>
              ) : isSaving ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                  <span className="text-gray-500">
                    Menerapkan footer ke PDF...
                  </span>
                </>
              ) : isReadingPdf ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                  <span className="text-gray-500">
                    Membaca informasi PDF...
                  </span>
                </>
              ) : isEditMode || selectedFile ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-gray-500">
                    {activeTab === "info"
                      ? "Siap disimpan"
                      : "Isi informasi lampiran"}
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-gray-300" />
                  <span className="text-gray-400">
                    Pilih file terlebih dahulu
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="cursor-pointer rounded-xl px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                disabled={isDisabled}
                onClick={handleSave}
                className={`rounded-xl px-8 py-3 text-sm font-medium text-white shadow-md transition-all ${isDisabled ? "cursor-not-allowed bg-gray-400" : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:shadow-lg hover:shadow-indigo-200"}`}
              >
                {isSaving
                  ? "Menerapkan footer..."
                  : isReadingPdf
                    ? "Membaca PDF..."
                    : isEditMode
                      ? "Simpan Perubahan"
                      : "Simpan Dokumen"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}