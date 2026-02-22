"use client";

import { useMemo, useRef, useState } from "react";
import UploadLampiranUtamaModal from "./modals/UploadLampiranModal";

type FileItem = {
  id: number;
  name: string;
  size: string;
  pages: number;
};

export default function LampiranPendukungContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const itemsPerPage = 8;

  // ✅ Data awal pure (tidak pakai Math.random)
  const [files, setFiles] = useState<FileItem[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Lampiran-Dokumen-${i + 1}.pdf`,
      size: `${(1 + i * 0.3).toFixed(2)} MB`,
      pages: (i + 3) * 2,
    })),
  );

  const filteredFiles = useMemo(() => {
    return files.filter((file) =>
      file.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, files]);

  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);

  const paginatedFiles = filteredFiles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // =============================
  // Upload Handler
  // =============================
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    const newFile: FileItem = {
      id: Date.now(),
      name: uploadedFile.name,
      size: (uploadedFile.size / (1024 * 1024)).toFixed(2) + " MB",
      pages: 1, // default (karena belum baca isi pdf)
    };

    setFiles((prev) => [newFile, ...prev]);
    setCurrentPage(1);
  };

  const handleDelete = (id: number) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Lampiran Pendukung
          </h2>
          <p className="text-sm text-gray-500">
            Daftar dokumen PDF yang telah diunggah.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Cari dokumen..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-56 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />

          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            + Tambah PDF
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="max-h-105 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-gray-600">
            <tr>
              <th className="w-12 px-6 py-3 text-center font-medium">No</th>
              <th className="px-6 py-3 text-center font-medium">Nama File</th>
              <th className="px-6 py-3 text-center font-medium">Ukuran</th>
              <th className="px-6 py-3 text-center font-medium">Halaman</th>
              <th className="px-6 py-3 text-center font-medium">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {paginatedFiles.map((file, index) => (
              <tr key={file.id} className="transition hover:bg-gray-50">
                <td className="px-6 py-3 text-center text-gray-500">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>

                <td className="px-6 py-3 text-center font-medium text-gray-800">
                  {file.name}
                </td>

                <td className="px-6 py-3 text-center text-gray-500">
                  {file.size}
                </td>

                <td className="px-6 py-3 text-center text-gray-500">
                  {file.pages} hlm
                </td>

                <td className="px-6 py-3 text-center">
                  <div className="flex justify-center gap-4 text-xs font-medium">
                    <button className="text-indigo-600 hover:text-indigo-800">
                      Preview
                    </button>
                    <button className="text-gray-600 hover:text-gray-800">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 text-sm text-gray-500">
        <span>
          Showing {(currentPage - 1) * itemsPerPage + 1}–
          {Math.min(currentPage * itemsPerPage, filteredFiles.length)} of{" "}
          {filteredFiles.length} files
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="rounded-md border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
          >
            Prev
          </button>

          <span className="font-medium text-gray-700">{currentPage}</span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="rounded-md border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <UploadLampiranUtamaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(newFile) => {
          setFiles((prev) => [newFile, ...prev]);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
