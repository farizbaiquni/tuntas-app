"use client";
import { useState } from "react";
import { JenisLaporan } from "@/app/_types/type";

interface BatangTubuhContentProps {
  value: string | null;
  jenisLaporan: JenisLaporan;
  onChange: (value: string | null) => void;
}

// Rule 6.3 / 7.4: Hoist static lookup map outside component to avoid recreating on every render.
// Rule 7.11: Use Map for O(1) lookups instead of switch statements evaluated at call time.
const LABEL_MAP: Record<JenisLaporan, { judul: string; sub: string }> = {
  [JenisLaporan.RAPERDA]: {
    judul: "Batang Tubuh Raperda",
    sub: "Rancangan Peraturan Daerah Kabupaten Kendal",
  },
  [JenisLaporan.PERDA]: {
    judul: "Batang Tubuh Perda",
    sub: "Peraturan Daerah Kabupaten Kendal",
  },
  [JenisLaporan.SALINAN_PERDA]: {
    judul: "Batang Tubuh Salinan Perda",
    sub: "Salinan Peraturan Daerah Kabupaten Kendal",
  },
  [JenisLaporan.RAPERBUP]: {
    judul: "Batang Tubuh Raperbup",
    sub: "Rancangan Peraturan Bupati Kendal",
  },
  [JenisLaporan.PERBUP]: {
    judul: "Batang Tubuh Perbup",
    sub: "Peraturan Bupati Kendal",
  },
  [JenisLaporan.SALINAN_PERBUP]: {
    judul: "Batang Tubuh Salinan Perbup",
    sub: "Salinan Peraturan Bupati Kendal",
  },
};

// Rule 6.3: Hoist static JSX (upload icon SVG) out of component to avoid re-creating on render.
const UploadIcon = (
  <svg
    className="h-7 w-7"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 16V4m0 0l-3 3m3-3l3 3"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" />
  </svg>
);

export default function BatangTubuhContent({
  value,
  jenisLaporan,
  onChange,
}: BatangTubuhContentProps) {
  // Rule 5.10: Use lazy state initialization — pass a function to useState so the
  // initial value is only computed once on mount, not on every re-render.
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => value);

  // Rule 7.4: O(1) map lookup instead of switch-case evaluated each render.
  const { judul, sub } = LABEL_MAP[jenisLaporan];

  // Rule 5.7: Keep interaction logic in event handlers, not in effects.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    // Rule 7.8: Early return to avoid unnecessary nesting.
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf") {
      alert("Hanya file PDF yang diperbolehkan.");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    onChange(url);
  };

  const handleDelete = () => {
    setPreviewUrl(null);
    onChange(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-7xl">
        {/* ================= HEADER ================= */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">{judul}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sub} — unggah dokumen PDF dan lakukan preview sebelum generate.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* ================= UPLOAD PANEL ================= */}
          <div className="col-span-1 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800">
                Upload Dokumen PDF
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Pastikan dokumen sesuai format.
              </p>
            </div>

            <label className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center transition hover:border-indigo-500 hover:bg-indigo-50">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 transition group-hover:bg-indigo-200">
                {UploadIcon}
              </div>
              <p className="text-sm font-medium text-gray-700">
                Klik untuk upload atau drag & drop
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Format PDF • Maksimal 10MB
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>

            {/* Rule 6.8: Use explicit boolean conditional rendering — avoids falsy short-circuit issues. */}
            {previewUrl !== null && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <div className="font-medium text-gray-700">✔ File siap</div>
                <div className="mt-1 truncate text-gray-500">
                  File PDF sudah diunggah
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-4">
              <button className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">
                Simpan
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Hapus
              </button>
            </div>
          </div>

          {/* ================= PREVIEW PANEL ================= */}
          <div className="col-span-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Preview Dokumen
              </h3>
            </div>
            <div className="bg-gray-300 p-4">
              {/* Rule 6.8: Explicit conditional rendering. */}
              {previewUrl !== null ? (
                <div className="overflow-hidden rounded-md border border-gray-400 shadow">
                  <iframe src={previewUrl} className="h-175 w-full bg-white" />
                </div>
              ) : (
                <div className="flex h-175 items-center justify-center text-sm text-gray-500">
                  Belum ada dokumen untuk ditampilkan.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}