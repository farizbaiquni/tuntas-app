"use client";

import { useEffect, useState } from "react";
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
  EyeIcon,
} from "@heroicons/react/24/outline";
import { LampiranUtama } from "@/app/_types/type";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  isOpen: boolean;
  onClose: () => void;
  nextUrutan: number;
  /** Nomor halaman awal untuk penomoran berkelanjutan (default: 1) */
  startPage?: number;
  editData?: LampiranUtama;
  onSave: (lampiran: LampiranUtama) => void;
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FormInfo = {
  isCalk: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRomawi(num: number): string {
  const map: [number, string][] = [
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
  let result = "";
  let n = num;
  for (const [value, numeral] of map) {
    while (n >= value) {
      result += numeral;
      n -= value;
    }
  }
  return result;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function readPdfPageCount(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
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

// ─── Core: render footer ke PDFDocument ──────────────────────────────────────

async function buildPdfWithFooter(
  bytes: ArrayBuffer,
  form: FormInfo,
  startPage: number = 1,
): Promise<string> {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const {
    footerWidth,
    footerHeight,
    offsetX,
    positionY,
    fontSize,
    footerNote,
    romanPage,
    dividerTitle,
    isCalk,
  } = form;

  pages.forEach((page, idx) => {
    const { width: pageWidth } = page.getSize();
    const boxWidth = (pageWidth * footerWidth) / 100;
    const xPos = (pageWidth - boxWidth) / 2 + offsetX;
    const yPos = positionY;

    if (isCalk) {
      // CALK: nomor halaman di kanan + keterangan di bawah (tanpa kotak)
      const marginRight = 100;
      const lineY = yPos + 20;
      const pageLabel = `Halaman ${startPage + idx}`;
      const labelW = font.widthOfTextAtSize(pageLabel, fontSize);
      const rightEdge = pageWidth - marginRight;

      page.drawText(pageLabel, {
        x: rightEdge - labelW - 5,
        y: lineY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      const ket = `Lampiran ${romanPage} — ${dividerTitle}`;
      const ketSize = Math.max(fontSize - 2, 6);
      const ketW = font.widthOfTextAtSize(ket, ketSize);
      page.drawText(ket, {
        x: rightEdge - ketW - 5,
        y: lineY - ketSize - 3,
        size: ketSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    } else {
      // Non-CALK: kotak + teks kiri + nomor halaman kanan + keterangan di bawah
      page.drawRectangle({
        x: xPos,
        y: yPos,
        width: boxWidth,
        height: footerHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      page.drawText(footerNote, {
        x: xPos + 10,
        y: yPos + footerHeight / 2 - fontSize / 2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: boxWidth - 120,
      });

      const pageLabel = `Halaman ${startPage + idx}`;
      const labelW = font.widthOfTextAtSize(pageLabel, fontSize);
      page.drawText(pageLabel, {
        x: xPos + boxWidth - labelW - 10,
        y: yPos + footerHeight / 2 - fontSize / 2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      const ket = `Lampiran ${romanPage} — ${dividerTitle}`;
      const ketSize = Math.max(fontSize - 2, 6);
      const ketW = font.widthOfTextAtSize(ket, ketSize);
      page.drawText(ket, {
        x: xPos + (boxWidth - ketW) / 2,
        y: yPos - ketSize - 3,
        size: ketSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes).buffer], {
    type: "application/pdf",
  });
  return URL.createObjectURL(blob);
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    editData?.fileUrl ?? null,
  );
  const [isPreviewFocus, setIsPreviewFocus] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "info">(
    isEditMode ? "info" : "upload",
  );
  const [formInfo, setFormInfo] = useState<FormInfo>(() =>
    isEditMode ? lampiranToForm(editData!) : getDefaultForm(nextUrutan),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // Data yang dibaca otomatis dari PDF
  const [pdfPageCount, setPdfPageCount] = useState<number>(
    editData?.jumlahHalaman ?? 0,
  );
  const [fileSize, setFileSize] = useState<string>(editData?.ukuranFile ?? "");
  const [isReadingPdf, setIsReadingPdf] = useState(false);

  // State untuk footer
  const [rawFileBytes, setRawFileBytes] = useState<ArrayBuffer | null>(null);
  const [footerApplied, setFooterApplied] = useState(false);
  const [isApplyingFooter, setIsApplyingFooter] = useState(false);

  // Reset saat modal dibuka ulang
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
      setRawFileBytes(null);
      setFooterApplied(false);
      setIsApplyingFooter(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPreviewFocus) setIsPreviewFocus(false);
        else onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, isPreviewFocus, onClose]);

  if (!isOpen) return null;

  // ─── File change: simpan bytes asli, tampilkan preview tanpa footer ─────────

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    setSelectedFile(file);
    setFileSize(formatFileSize(file.size));
    setFooterApplied(false);
    setActiveTab("info");

    const bytes = await file.arrayBuffer();
    setRawFileBytes(bytes);

    const originalBlob = new Blob([bytes], { type: "application/pdf" });
    setPreviewUrl(URL.createObjectURL(originalBlob));

    setIsReadingPdf(true);
    const pageCount = await readPdfPageCount(file);
    setPdfPageCount(pageCount);
    setIsReadingPdf(false);
  };

  // ─── Apply footer ke preview (dipanggil manual atau otomatis saat save) ─────

  const applyFooterToPreview = async (): Promise<string | null> => {
    const bytes =
      rawFileBytes ??
      (isEditMode && editData?.fileUrl
        ? await fetch(editData.fileUrl).then((r) => r.arrayBuffer())
        : null);

    if (!bytes) return null;

    const validationErrors = validate(formInfo);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setActiveTab("info");
      return null;
    }

    setIsApplyingFooter(true);
    try {
      const blobUrl = await buildPdfWithFooter(bytes, formInfo, startPage);
      setPreviewUrl(blobUrl);
      setFooterApplied(true);
      return blobUrl;
    } finally {
      setIsApplyingFooter(false);
    }
  };

  // ─── Form handlers ────────────────────────────────────────────────────────

  const handleFieldChange = <K extends keyof FormInfo>(
    key: K,
    value: FormInfo[K],
  ) => {
    setFormInfo((prev) => ({ ...prev, [key]: value }));
    // Reset footerApplied jika field footer berubah agar user tahu perlu re-apply
    if (
      [
        "dividerTitle",
        "footerNote",
        "footerWidth",
        "offsetX",
        "positionY",
        "fontSize",
        "footerHeight",
        "romanPage",
        "isCalk",
      ].includes(key)
    ) {
      setFooterApplied(false);
    }
    if (key === "dividerTitle" || key === "footerNote") {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  // ─── Save: auto-apply footer jika belum, lalu simpan ─────────────────────

  const handleSave = async () => {
    if (!isEditMode && !selectedFile) return;

    const validationErrors = validate(formInfo);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setActiveTab("info");
      return;
    }

    // Apply footer otomatis jika belum (atau jika form berubah setelah apply)
    let finalUrl = previewUrl;
    if (!footerApplied) {
      finalUrl = await applyFooterToPreview();
      if (!finalUrl) return; // validasi gagal di dalam applyFooterToPreview
    }

    const lampiran: LampiranUtama = isEditMode
      ? {
          ...editData!,
          romawiLampiran: formInfo.romanPage,
          judulPembatasLampiran: formInfo.dividerTitle,
          isCALK: formInfo.isCalk,
          footer: {
            text: formInfo.footerNote,
            width: formInfo.footerWidth,
            height: formInfo.footerHeight,
            position: { x: formInfo.offsetX, y: formInfo.positionY },
            fontSize: formInfo.fontSize,
          },
          ...(selectedFile && {
            fileUrl: finalUrl ?? editData!.fileUrl,
            rawFileUrl: URL.createObjectURL(
              new Blob([rawFileBytes!], { type: "application/pdf" }),
            ),
            namaFileDiStorageLokal: selectedFile.name,
            ukuranFile: fileSize,
            jumlahHalaman: pdfPageCount,
          }),
        }
      : {
          id: crypto.randomUUID(),
          urutan: nextUrutan,
          fileUrl: finalUrl ?? "",
          rawFileUrl: URL.createObjectURL(
            new Blob([rawFileBytes!], { type: "application/pdf" }),
          ),
          namaFileDiStorageLokal: selectedFile!.name,
          ukuranFile: fileSize,
          romawiLampiran: formInfo.romanPage || toRomawi(nextUrutan),
          judulPembatasLampiran: formInfo.dividerTitle,
          footer: {
            text: formInfo.footerNote,
            width: formInfo.footerWidth,
            height: formInfo.footerHeight,
            position: { x: formInfo.offsetX, y: formInfo.positionY },
            fontSize: formInfo.fontSize,
          },
          jumlahHalaman: pdfPageCount,
          jumlahTotalLembar: 0,
          isCALK: formInfo.isCalk,
          babs: [],
        };

    onSave(lampiran);
    onClose();
  };

  // ─── Shared classes ───────────────────────────────────────────────────────

  const inputCls = (hasError?: boolean) =>
    `w-full rounded-xl border px-5 py-4 text-base transition-all focus:outline-none focus:ring-1 ${
      hasError
        ? "border-red-400 focus:border-red-400 focus:ring-red-400"
        : "border-gray-200 focus:border-indigo-400 focus:ring-indigo-400"
    }`;

  // ─── Render ───────────────────────────────────────────────────────────────

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
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "upload"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <DocumentArrowUpIcon className="h-5 w-5" />
                  {isEditMode ? "Ganti File" : "Upload File"}
                </button>
                <button
                  onClick={() => setActiveTab("info")}
                  disabled={!isEditMode && !selectedFile}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    !isEditMode && !selectedFile
                      ? "cursor-not-allowed text-gray-300"
                      : activeTab === "info"
                        ? "border-b-2 border-indigo-600 text-indigo-600"
                        : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <InformationCircleIcon className="h-5 w-5" />
                  Informasi Lampiran
                  {Object.keys(errors).length > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </button>
              </div>

              <div className="p-8">
                {/* TAB UPLOAD */}
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
                                  setRawFileBytes(null);
                                  setFooterApplied(false);
                                  setPdfPageCount(editData?.jumlahHalaman ?? 0);
                                  setFileSize(editData?.ukuranFile ?? "");
                                  if (!isEditMode) {
                                    setPreviewUrl(null);
                                    setActiveTab("upload");
                                  } else {
                                    setPreviewUrl(editData!.fileUrl);
                                  }
                                }}
                                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>

                          {(selectedFile || isEditMode) && (
                            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400">
                                  Ukuran File
                                </span>
                                <span className="mt-0.5 text-sm font-medium text-gray-700">
                                  {fileSize || "—"}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400">
                                  Jumlah Halaman
                                </span>
                                <span className="mt-0.5 text-sm font-medium text-gray-700">
                                  {isReadingPdf ? (
                                    <span className="inline-flex items-center gap-1 text-indigo-500">
                                      <svg
                                        className="h-3 w-3 animate-spin"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                        />
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8v8z"
                                        />
                                      </svg>
                                      Membaca...
                                    </span>
                                  ) : pdfPageCount > 0 ? (
                                    `${pdfPageCount} halaman`
                                  ) : (
                                    "—"
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-5 text-sm font-medium text-indigo-600 transition-all hover:border-indigo-300 hover:bg-indigo-50/50">
                          <DocumentArrowUpIcon className="h-5 w-5" />
                          Ganti file
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) =>
                              handleFileChange(e.target.files?.[0] ?? null)
                            }
                          />
                        </label>

                        <button
                          onClick={() => setActiveTab("info")}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 py-4 text-base font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          <PencilIcon className="h-5 w-5" />
                          Lanjutkan ke Informasi Lampiran
                        </button>
                      </div>
                    )}

                    <div className="mt-8 rounded-xl bg-blue-50/50 p-6">
                      <h5 className="mb-3 text-base font-semibold text-blue-800">
                        ℹ️ Informasi Penting
                      </h5>
                      <ul className="space-y-3 text-sm text-blue-700">
                        {[
                          "Format file yang didukung: PDF",
                          "Ukuran maksimal: 10MB",
                          "Footer diterapkan otomatis saat menyimpan",
                        ].map((t) => (
                          <li key={t} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* TAB INFO */}
                {activeTab === "info" && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-2">
                      <BookOpenIcon className="h-6 w-6 text-indigo-600" />
                      <h4 className="text-base font-medium tracking-wider text-gray-400 uppercase">
                        INFORMASI LAMPIRAN
                      </h4>
                    </div>

                    {(selectedFile || isEditMode) && (
                      <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                        <div>
                          <span className="text-xs text-gray-400">
                            Ukuran File
                          </span>
                          <p className="mt-0.5 font-medium text-gray-700">
                            {fileSize || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400">
                            Jumlah Halaman
                          </span>
                          <p className="mt-0.5 font-medium text-gray-700">
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

                    {/* CALK */}
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
                          Centang jika ini adalah lampiran CALK
                        </p>
                      </div>
                    </label>

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

                    {/* Judul — WAJIB */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Judul Pembatas Lampiran
                        <span className="ml-1 text-red-500">*</span>
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

                    {/* Footer — WAJIB */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Keterangan Footer Halaman
                        <span className="ml-1 text-red-500">*</span>
                      </label>
                      <textarea
                        value={formInfo.footerNote}
                        onChange={(e) =>
                          handleFieldChange("footerNote", e.target.value)
                        }
                        placeholder="Masukkan keterangan footer"
                        rows={3}
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

                    {/* Preview setting — compact */}
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <ArrowsPointingOutIcon className="h-4 w-4 text-indigo-600" />
                        <span className="text-xs font-medium text-indigo-700">
                          Preview Setting
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                        <div>Lebar: {formInfo.footerWidth}%</div>
                        <div>Offset X: {formInfo.offsetX}</div>
                        <div>Posisi Y: {formInfo.positionY}</div>
                        <div>Font: {formInfo.fontSize}px</div>
                        <div className="col-span-2">
                          Tinggi: {formInfo.footerHeight}px
                        </div>
                      </div>
                    </div>

                    {/* Tombol Apply Footer */}
                    <button
                      onClick={() => applyFooterToPreview()}
                      disabled={isApplyingFooter || isReadingPdf}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        footerApplied
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      {isApplyingFooter ? (
                        <>
                          <svg
                            className="h-4 w-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8z"
                            />
                          </svg>
                          Menerapkan Footer...
                        </>
                      ) : footerApplied ? (
                        <>
                          <EyeIcon className="h-4 w-4" />
                          Footer diterapkan — Klik untuk refresh preview
                        </>
                      ) : (
                        <>
                          <EyeIcon className="h-4 w-4" />
                          Apply Footer & Lihat Preview
                        </>
                      )}
                    </button>

                    {footerApplied && (
                      <p className="text-center text-xs text-green-600">
                        ✓ Preview sudah menampilkan footer. Atau langsung klik
                        &quot;Simpan&quot;.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RIGHT PANEL - Preview */}
          <div
            className={`flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-gray-50 to-white transition-all duration-500 ${
              isPreviewFocus ? "w-full" : "lg:w-2/5"
            }`}
          >
            {previewUrl ? (
              <>
                <div
                  className={`flex items-center justify-between border-b border-gray-100 px-6 py-4 ${
                    isPreviewFocus ? "bg-indigo-50/50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${footerApplied ? "bg-green-500" : "animate-pulse bg-blue-400"}`}
                    />
                    <span className="text-sm font-medium text-gray-600">
                      {footerApplied
                        ? "Preview dengan footer"
                        : "Preview PDF asli"}
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

        {/* FOOTER — lebih pendek */}
        {!isPreviewFocus && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-8 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              {Object.keys(errors).length > 0 ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-red-500">
                    Harap lengkapi field yang wajib diisi
                  </span>
                </>
              ) : isReadingPdf ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                  <span className="text-gray-500">
                    Membaca informasi PDF...
                  </span>
                </>
              ) : isApplyingFooter ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                  <span className="text-gray-500">Menerapkan footer...</span>
                </>
              ) : isEditMode || selectedFile ? (
                <>
                  <span
                    className={`h-2 w-2 rounded-full ${footerApplied ? "bg-green-500" : "bg-yellow-400"}`}
                  />
                  <span className="text-gray-500">
                    {footerApplied
                      ? "Footer diterapkan, siap disimpan"
                      : "Footer akan diterapkan otomatis saat simpan"}
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
                className="cursor-pointer rounded-xl px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                disabled={
                  (!isEditMode && !selectedFile) ||
                  isReadingPdf ||
                  isApplyingFooter
                }
                onClick={handleSave}
                className={`rounded-xl px-8 py-2 text-sm font-medium text-white shadow-md transition-all ${
                  (!isEditMode && !selectedFile) ||
                  isReadingPdf ||
                  isApplyingFooter
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:shadow-lg hover:shadow-indigo-200"
                }`}
              >
                {isReadingPdf
                  ? "Membaca PDF..."
                  : isApplyingFooter
                    ? "Menerapkan Footer..."
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
