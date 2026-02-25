"use client";

import { useEffect, useRef, useState } from "react";
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
} from "@/app/_types/type";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  isOpen: boolean;
  onClose: () => void;
  nextUrutan: number;
  startPage?: number;
  editData?: LampiranUtama;
  onSave: (lampiran: LampiranUtama) => void;
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

  useEffect(() => {
    if (isOpen) {
      setFormInfo(
        isEditMode ? lampiranToForm(editData!) : getDefaultForm(nextUrutan),
      );
      setPreviewUrl(editData?.fileUrl ?? null);
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

  if (!isOpen) return null;

  // ── handlers ───────────────────────────────────────────────────────────────

  // Rule 5.7: All interaction logic lives in the event handler — no bridging via state+effect.
  const handleFileChange = async (file: File | null) => {
    // Rule 7.8: Early return for null file.
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
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
        const ket = `Lampiran ${formInfo.romanPage} — ${formInfo.dividerTitle}`;
        const ks = Math.max(fs - 2, 6);
        page.drawText(ket, {
          x: re - font.widthOfTextAtSize(ket, ks) - 5,
          y: ly - ks - 3,
          size: ks,
          font,
          color: rgb(0.3, 0.3, 0.3),
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
        const ket = `Lampiran ${formInfo.romanPage} — ${formInfo.dividerTitle}`;
        const ks = Math.max(fs - 2, 6);
        const kw = font.widthOfTextAtSize(ket, ks);
        page.drawText(ket, {
          x: x + (bw - kw) / 2,
          y: y - ks - 3,
          size: ks,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
      counter++;
    });

    const blob = new Blob([new Uint8Array(await pdfDoc.save()).buffer], {
      type: "application/pdf",
    });
    return URL.createObjectURL(blob);
  };

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
      const fileUrl = rawUrl ? await applyFooterToPdf(rawUrl) : "";
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
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL */}
          {!isPreviewFocus && (
            <div className="w-full overflow-y-auto border-r border-gray-100 lg:w-3/5">
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
              </div>
            </div>
          )}

          {/* RIGHT PANEL */}
          <div
            className={`flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-gray-50 to-white transition-all duration-500 ${isPreviewFocus ? "w-full" : "lg:w-2/5"}`}
          >
            {previewUrl ? (
              <>
                <div
                  className={`flex items-center justify-between border-b border-gray-100 px-6 py-4 ${isPreviewFocus ? "bg-indigo-50/50" : "bg-white"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-gray-600">
                      Preview Dokumen
                    </span>
                  </div>
                  <button
                    onClick={() => setIsPreviewFocus(!isPreviewFocus)}
                    className="group flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg"
                  >
                    {isPreviewFocus ? (
                      <>
                        <ChevronDownIcon className="h-4 w-4" /> Kembali ke
                        Layout
                      </>
                    ) : (
                      <>
                        <ChevronUpIcon className="h-4 w-4" /> Fokus Preview
                      </>
                    )}
                  </button>
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