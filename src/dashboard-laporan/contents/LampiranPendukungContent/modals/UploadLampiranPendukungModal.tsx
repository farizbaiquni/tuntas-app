"use client";

import { useEffect, useState, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import { LampiranPendukung } from "@/app/_types/type";

// ─── Props ────────────────────────────────────────────────────────────────────

interface UploadLampiranPendukungModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextUrutan: number;
  editData?: LampiranPendukung;
  onSave: (lampiran: LampiranPendukung) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
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

function fileNameToJudul(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadLampiranPendukungModal({
  isOpen,
  onClose,
  nextUrutan,
  editData,
  onSave,
}: UploadLampiranPendukungModalProps) {
  const isEditMode = !!editData;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(editData?.fileUrl ?? null);
  const [judul, setJudul] = useState<string>(editData?.judul ?? "");
  const [pageCount, setPageCount] = useState<number>(editData?.jumlahTotalLembar ?? 0);
  const [fileSize, setFileSize] = useState<string>("");
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [judulError, setJudulError] = useState<string>("");

  // Reset state setiap kali modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewUrl(editData?.fileUrl ?? null);
      setJudul(editData?.judul ?? "");
      setPageCount(editData?.jumlahTotalLembar ?? 0);
      setFileSize("");
      setIsReadingPdf(false);
      setIsSaving(false);
      setIsDragOver(false);
      setJudulError("");
    }
  }, [isOpen, editData]);

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── File processing ──────────────────────────────────────────────────────

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      alert("Hanya file PDF yang diperbolehkan.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("Ukuran file maksimal 50MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFileSize(formatFileSize(file.size));

    // Auto-isi judul dari nama file
    if (!judul || judul === editData?.judul) {
      setJudul(fileNameToJudul(file.name));
    }

    setIsReadingPdf(true);
    const count = await readPdfPageCount(file);
    setPageCount(count);
    setIsReadingPdf(false);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!judul.trim()) {
      setJudulError("Judul wajib diisi.");
      return;
    }
    if (!isEditMode && !selectedFile) return;

    setIsSaving(true);
    try {
      const fileUrl = selectedFile
        ? URL.createObjectURL(selectedFile)
        : editData!.fileUrl;

      const lampiran: LampiranPendukung = isEditMode
        ? {
            ...editData!,
            judul: judul.trim(),
            fileUrl: selectedFile ? fileUrl : editData!.fileUrl,
            namaFileAsli: selectedFile ? selectedFile.name : editData!.namaFileAsli,
            namaFileDiStorageLokal: selectedFile ? selectedFile.name : editData!.namaFileDiStorageLokal,
            jumlahTotalLembar: pageCount,
          }
        : {
            id: crypto.randomUUID(),
            urutan: nextUrutan,
            namaFileAsli: selectedFile!.name,
            namaFileDiStorageLokal: selectedFile!.name,
            fileUrl,
            judul: judul.trim(),
            jumlahTotalLembar: pageCount,
          };

      onSave(lampiran);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = (isEditMode || !!selectedFile) && !isReadingPdf && !isSaving && judul.trim().length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <svg className="h-5 w-5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">
                {isEditMode ? "Edit Lampiran Pendukung" : "Tambah Lampiran Pendukung"}
              </h3>
              <p className="text-sm text-gray-400">
                {isEditMode ? "Ubah judul atau ganti file PDF" : "Upload dokumen PDF pendukung laporan"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: Upload + Info ── */}
          <div className="flex w-[340px] flex-shrink-0 flex-col gap-5 overflow-y-auto border-r border-gray-100 bg-gray-50/40 p-6">

            {/* Drop zone */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">File PDF</p>
              <label
                className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                  isDragOver
                    ? "border-violet-400 bg-violet-50"
                    : selectedFile || (isEditMode && previewUrl)
                    ? "border-violet-300 bg-violet-50/60"
                    : "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/40"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {selectedFile || (isEditMode && previewUrl) ? (
                  // File loaded state
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
                      <svg className="h-7 w-7 text-violet-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-violet-700">
                        {selectedFile ? selectedFile.name : editData?.namaFileAsli}
                      </p>
                      {fileSize && (
                        <p className="mt-0.5 text-xs text-violet-400">{fileSize}</p>
                      )}
                      {isReadingPdf ? (
                        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-violet-500">
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Membaca halaman...
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-violet-400">{pageCount} halaman</p>
                      )}
                    </div>
                    <p className="text-[11px] text-violet-400 underline decoration-dashed">
                      Klik atau drop untuk ganti file
                    </p>
                  </div>
                ) : (
                  // Empty state
                  <div className="flex flex-col items-center gap-3">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                      isDragOver ? "bg-violet-200" : "bg-gray-100 group-hover:bg-violet-100"
                    }`}>
                      <svg className={`h-7 w-7 transition-colors ${
                        isDragOver ? "text-violet-600" : "text-gray-400 group-hover:text-violet-500"
                      }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {isDragOver ? "Lepaskan file di sini" : "Klik atau drag & drop"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Format PDF · Maksimal 50MB</p>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>

            {/* Judul */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Judul Dokumen <span className="text-red-400 normal-case">*</span>
              </label>
              <textarea
                value={judul}
                onChange={(e) => {
                  setJudul(e.target.value);
                  if (e.target.value.trim()) setJudulError("");
                }}
                placeholder="Masukkan judul dokumen pendukung..."
                rows={3}
                className={`w-full resize-none rounded-xl border px-4 py-3 text-sm text-gray-800 transition focus:outline-none focus:ring-1 ${
                  judulError
                    ? "border-red-300 focus:border-red-400 focus:ring-red-300"
                    : "border-gray-200 focus:border-violet-400 focus:ring-violet-300"
                }`}
              />
              {judulError && (
                <p className="mt-1 text-xs text-red-500">{judulError}</p>
              )}
            </div>

            {/* Info file (jika sudah ada) */}
            {(selectedFile || (isEditMode && editData)) && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs">
                <p className="mb-2 font-semibold text-gray-500">Informasi File</p>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400">Nama file</span>
                    <span className="max-w-[160px] truncate text-right font-medium text-gray-700">
                      {selectedFile ? selectedFile.name : editData?.namaFileAsli}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Jumlah halaman</span>
                    <span className="font-medium text-gray-700">
                      {isReadingPdf ? (
                        <span className="animate-pulse text-violet-500">Membaca...</span>
                      ) : (
                        `${pageCount} halaman`
                      )}
                    </span>
                  </div>
                  {fileSize && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ukuran</span>
                      <span className="font-medium text-gray-700">{fileSize}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Urutan</span>
                    <span className="font-medium text-gray-700">
                      {isEditMode ? editData!.urutan : nextUrutan}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  canSave
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-200 hover:bg-violet-700 active:scale-95"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
                }`}
              >
                {isSaving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {isEditMode ? "Simpan Perubahan" : "Tambahkan"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── RIGHT: Preview ── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-3">
              <h4 className="text-sm font-semibold text-gray-600">Preview Dokumen</h4>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Buka di tab baru
                </a>
              )}
            </div>

            <div className="flex-1 overflow-hidden bg-gray-200 p-4">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="h-full w-full rounded-xl border border-gray-300 bg-white shadow-sm"
                  title="Preview PDF"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100">
                    <svg className="h-10 w-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-400">Belum ada file</p>
                    <p className="mt-1 text-xs text-gray-300">Upload file PDF untuk melihat preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}