"use client";

import { useEffect, useState } from "react";
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

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: {
    id: number;
    name: string;
    size: string;
    pages: number;
    info: {
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
  }) => void;
};

export default function UploadPdfModal({ isOpen, onClose, onSave }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewFocus, setIsPreviewFocus] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "info">("upload");

  // Form state untuk informasi lampiran
  const [formInfo, setFormInfo] = useState({
    isCalk: false,
    romanPage: "",
    dividerTitle: "",
    footerNote: "",
    footerWidth: 91,
    offsetX: 0,
    positionY: 27,
    fontSize: 8,
    footerHeight: 20,
  });

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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setActiveTab("info"); // Otomatis pindah ke tab info setelah upload
  };

  const handleSave = () => {
    if (!selectedFile) return;

    onSave({
      id: Date.now(),
      name: selectedFile.name,
      size: (selectedFile.size / (1024 * 1024)).toFixed(2) + " MB",
      pages: 1,
      info: formInfo,
    });

    // Reset state
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsPreviewFocus(false);
    setActiveTab("upload");
    setFormInfo({
      isCalk: false,
      romanPage: "",
      dividerTitle: "",
      footerNote: "",
      footerWidth: 91,
      offsetX: 0,
      positionY: 27,
      fontSize: 8,
      footerHeight: 20,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-md transition-all duration-300"
      onClick={(e) => {
        if (!isPreviewFocus && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex ${
          isPreviewFocus ? "h-[95vh] max-w-7xl" : "h-[90vh] max-w-7xl"
        } w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-500 ease-out`}
      >
        {/* HEADER */}
        {!isPreviewFocus && (
          <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-gray-50 to-white px-8 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-2">
                <DocumentArrowUpIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-gray-900">
                  Tambah Lampiran PDF
                </h3>
                <p className="text-sm text-gray-500">
                  Unggah dokumen dan atur informasi lampiran
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

        {/* BODY - Dengan proporsi baru: kiri 60%, kanan 40% */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL - Lebih panjang (60%) */}
          {!isPreviewFocus && (
            <div className="w-full overflow-y-auto border-r border-gray-100 bg-linear-to-b from-gray-50/50 to-white lg:w-3/5">
              {/* Tab Navigation */}
              <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white/80 px-6 pt-4 backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "upload"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <DocumentArrowUpIcon className="h-5 w-5" />
                  Upload File
                </button>
                <button
                  onClick={() => setActiveTab("info")}
                  disabled={!selectedFile}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    !selectedFile
                      ? "cursor-not-allowed text-gray-300"
                      : activeTab === "info"
                        ? "border-b-2 border-indigo-600 text-indigo-600"
                        : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <InformationCircleIcon className="h-5 w-5" />
                  Informasi Lampiran
                  {selectedFile && !formInfo.isCalk && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-400"></span>
                  )}
                </button>
              </div>

              {/* Tab Content - Dengan padding lebih lega */}
              <div className="p-8">
                {activeTab === "upload" ? (
                  /* UPLOAD TAB */
                  <div className="space-y-6">
                    {!selectedFile ? (
                      <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/50 p-16 text-center transition-all duration-300 hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-lg">
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
                        <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-md transition-all hover:shadow-lg">
                          <div className="absolute inset-0 bg-linear-to-r from-indigo-500/0 to-indigo-500/0 transition-all group-hover:from-indigo-500/5"></div>
                          <div className="relative flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="rounded-lg bg-indigo-100 p-3">
                                <DocumentArrowUpIcon className="h-10 w-10 text-indigo-600" />
                              </div>
                              <div>
                                <p className="max-w-62.5 truncate text-base font-medium text-gray-900">
                                  {selectedFile.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {(selectedFile.size / (1024 * 1024)).toFixed(
                                    2,
                                  )}{" "}
                                  MB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedFile(null);
                                setPreviewUrl(null);
                                setActiveTab("upload");
                              }}
                              className="cursor-pointer rounded-lg p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
                            >
                              <XMarkIcon className="h-5 w-5" />
                            </button>
                          </div>
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

                        {/* Quick action ke tab info */}
                        <button
                          onClick={() => setActiveTab("info")}
                          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 py-4 text-base font-medium text-indigo-700 transition-all hover:bg-indigo-100"
                        >
                          <PencilIcon className="h-5 w-5" />
                          Lanjutkan ke Informasi Lampiran
                        </button>
                      </div>
                    )}

                    {/* Informasi tambahan */}
                    <div className="mt-8 rounded-xl bg-blue-50/50 p-6">
                      <h5 className="mb-3 text-base font-semibold text-blue-800">
                        ℹ️ Informasi Penting
                      </h5>
                      <ul className="space-y-3 text-sm text-blue-700">
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                          Format file yang didukung: PDF
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                          Ukuran maksimal: 10MB
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                          Isi informasi lampiran untuk detail dokumen
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  /* INFO TAB - Form Informasi Lampiran (lebih lega) */
                  <div className="space-y-8">
                    <div className="flex items-center gap-2">
                      <BookOpenIcon className="h-6 w-6 text-indigo-600" />
                      <h4 className="text-base font-medium tracking-wider text-gray-400 uppercase">
                        INFORMASI LAMPIRAN
                      </h4>
                    </div>

                    {/* Checkbox CALK */}
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-200 hover:bg-indigo-50/30">
                      <input
                        type="checkbox"
                        checked={formInfo.isCalk}
                        onChange={(e) =>
                          setFormInfo({ ...formInfo, isCalk: e.target.checked })
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

                    {/* Romawi Lampiran */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Romawi Lampiran
                      </label>
                      <input
                        type="text"
                        value={formInfo.romanPage}
                        onChange={(e) =>
                          setFormInfo({
                            ...formInfo,
                            romanPage: e.target.value,
                          })
                        }
                        placeholder="Contoh: I, II, III, IV"
                        className="w-full rounded-xl border border-gray-200 px-5 py-4 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                      />
                    </div>

                    {/* Judul Pembatas Lampiran */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Judul Pembatas Lampiran
                      </label>
                      <input
                        type="text"
                        value={formInfo.dividerTitle}
                        onChange={(e) =>
                          setFormInfo({
                            ...formInfo,
                            dividerTitle: e.target.value,
                          })
                        }
                        placeholder="Masukkan judul pembatas"
                        className="w-full rounded-xl border border-gray-200 px-5 py-4 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                      />
                    </div>

                    {/* Keterangan Footer Halaman */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Keterangan Footer Halaman
                      </label>
                      <textarea
                        value={formInfo.footerNote}
                        onChange={(e) =>
                          setFormInfo({
                            ...formInfo,
                            footerNote: e.target.value,
                          })
                        }
                        placeholder="Masukkan keterangan footer"
                        rows={4}
                        className="w-full rounded-xl border border-gray-200 px-5 py-4 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                      />
                    </div>

                    {/* Grid untuk settings footer - 3 kolom untuk tampilan lebih rapi */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Lebar Footer (%) */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Lebar Footer (%)
                        </label>
                        <input
                          type="number"
                          value={formInfo.footerWidth}
                          onChange={(e) =>
                            setFormInfo({
                              ...formInfo,
                              footerWidth: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>

                      {/* Offset X */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Offset X
                        </label>
                        <input
                          type="number"
                          value={formInfo.offsetX}
                          onChange={(e) =>
                            setFormInfo({
                              ...formInfo,
                              offsetX: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>

                      {/* Posisi Y */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Posisi Y
                        </label>
                        <input
                          type="number"
                          value={formInfo.positionY}
                          onChange={(e) =>
                            setFormInfo({
                              ...formInfo,
                              positionY: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>

                      {/* Font Size */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Font Size
                        </label>
                        <input
                          type="number"
                          value={formInfo.fontSize}
                          onChange={(e) =>
                            setFormInfo({
                              ...formInfo,
                              fontSize: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>

                      {/* Tinggi Footer */}
                      <div className="col-span-2 space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Tinggi Footer
                        </label>
                        <input
                          type="number"
                          value={formInfo.footerHeight}
                          onChange={(e) =>
                            setFormInfo({
                              ...formInfo,
                              footerHeight: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Preview card untuk settingan */}
                    <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
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
              </div>
            </div>
          )}

          {/* RIGHT PANEL - Preview lebih pendek (40%) */}
          <div
            className={`flex flex-1 flex-col overflow-hidden bg-linear-to-br from-gray-50 to-white transition-all duration-500 ${
              isPreviewFocus ? "lg:w-full" : "lg:w-2/5"
            }`}
          >
            {previewUrl ? (
              <>
                <div
                  className={`flex items-center justify-between border-b border-gray-100 px-6 py-4 transition-all ${
                    isPreviewFocus ? "bg-indigo-50/50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-600">
                      Preview Dokumen
                    </span>
                  </div>
                  <button
                    onClick={() => setIsPreviewFocus(!isPreviewFocus)}
                    className="group flex cursor-pointer items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:shadow-indigo-200"
                  >
                    {isPreviewFocus ? (
                      <>
                        <ChevronDownIcon className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                        Kembali ke Layout
                      </>
                    ) : (
                      <>
                        <ChevronUpIcon className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                        Fokus Preview
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
              <div className="flex flex-1 flex-col items-center justify-center text-sm text-gray-400">
                <div className="rounded-full bg-gray-100 p-8">
                  <DocumentArrowUpIcon className="h-16 w-16 text-gray-300" />
                </div>
                <p className="mt-4 text-lg">Preview akan muncul di sini</p>
                <p className="mt-2 text-base">Setelah Anda memilih file PDF</p>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        {!isPreviewFocus && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-8 py-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {selectedFile ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  File siap,{" "}
                  {activeTab === "info"
                    ? "informasi lengkap"
                    : "isi informasi lampiran"}
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-gray-300"></span>
                  Pilih file terlebih dahulu
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="cursor-pointer rounded-xl px-6 py-3 text-sm font-medium text-gray-600 transition-all hover:bg-gray-200/50 hover:text-gray-900"
              >
                Batal
              </button>
              <button
                disabled={!selectedFile || activeTab === "upload"}
                onClick={handleSave}
                className={`group relative cursor-pointer overflow-hidden rounded-xl px-8 py-3 text-sm font-medium text-white shadow-md transition-all ${
                  !selectedFile || activeTab === "upload"
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-linear-to-r from-indigo-600 to-indigo-700 hover:shadow-lg hover:shadow-indigo-200"
                }`}
              >
                <span className="relative z-10">
                  {activeTab === "upload"
                    ? "Lengkapi Informasi"
                    : "Simpan Dokumen"}
                </span>
                {selectedFile && activeTab === "info" && (
                  <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-indigo-700 to-indigo-800 transition-transform group-hover:translate-x-0"></div>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
