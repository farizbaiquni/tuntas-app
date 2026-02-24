"use client";

import { useCallback, useMemo, useState } from "react";
import { LampiranPendukung } from "@/app/_types/type";
import UploadLampiranPendukungModal from "./modals/UploadLampiranPendukungModal";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LampiranPendukungProps {
  lampirans: LampiranPendukung[];
  onAdd: (lampiran: LampiranPendukung) => void;
  onUpdate: (id: string, updated: Partial<LampiranPendukung>) => void;
  onRemove: (id: string) => void;
  onReorder: (reordered: LampiranPendukung[]) => void;
}

// ─── Drag Handle ─────────────────────────────────────────────────────────────

function DragHandle({ isDragging }: { isDragging: boolean }) {
  return (
    <div
      title="Drag untuk mengubah urutan"
      className={`flex cursor-grab flex-col items-center justify-center gap-[3px] rounded-md p-1.5 transition-all active:cursor-grabbing ${
        isDragging
          ? "text-violet-500"
          : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
      }`}
    >
      <div className="flex gap-[3px]">
        <span className="block h-[3px] w-[3px] rounded-full bg-current" />
        <span className="block h-[3px] w-[3px] rounded-full bg-current" />
      </div>
      <div className="flex gap-[3px]">
        <span className="block h-[3px] w-[3px] rounded-full bg-current" />
        <span className="block h-[3px] w-[3px] rounded-full bg-current" />
      </div>
      <div className="flex gap-[3px]">
        <span className="block h-[3px] w-[3px] rounded-full bg-current" />
        <span className="block h-[3px] w-[3px] rounded-full bg-current" />
      </div>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewPdfModal({
  lampiran,
  onClose,
}: {
  lampiran: LampiranPendukung;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100">
              <svg
                className="h-5 w-5 text-violet-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-800">
                {lampiran.judul}
              </p>
              <p className="text-xs text-gray-400">{lampiran.namaFileAsli}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={lampiran.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
              Buka di tab baru
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        {/* PDF iframe */}
        <div className="flex-1 bg-gray-200 p-3">
          <iframe
            src={lampiran.fileUrl}
            className="h-full w-full rounded-xl border border-gray-300 bg-white shadow-sm"
            title={lampiran.judul}
          />
        </div>
        {/* Footer info */}
        <div className="flex items-center gap-6 border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-500">
          <span>
            Urutan: <strong className="text-gray-700">{lampiran.urutan}</strong>
          </span>
          <span>
            Halaman:{" "}
            <strong className="text-gray-700">
              {lampiran.jumlahTotalLembar || "—"}
            </strong>
          </span>
          <span className="truncate text-gray-400">
            File: {lampiran.namaFileDiStorageLokal}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Konfirmasi Hapus ─────────────────────────────────────────────────────────

function DeleteConfirmModal({
  lampiran,
  onConfirm,
  onCancel,
}: {
  lampiran: LampiranPendukung;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-6 py-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
            <svg
              className="h-6 w-6 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            Hapus Lampiran Pendukung?
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            <span className="font-medium text-gray-700">
              &quot;{lampiran.judul}&quot;
            </span>{" "}
            akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-95"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LampiranPendukungContent({
  lampirans,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
}: LampiranPendukungProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingUrutan, setEditingUrutan] = useState<Record<string, string>>(
    {},
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LampiranPendukung | undefined>(
    undefined,
  );
  const [previewTarget, setPreviewTarget] = useState<LampiranPendukung | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<LampiranPendukung | null>(
    null,
  );

  const itemsPerPage = 8;

  // ─── Filter & Pagination ──────────────────────────────────────────────────

  const sorted = useMemo(
    () => [...lampirans].sort((a, b) => a.urutan - b.urutan),
    [lampirans],
  );

  const filtered = useMemo(
    () =>
      sorted.filter(
        (l) =>
          l.judul.toLowerCase().includes(search.toLowerCase()) ||
          l.namaFileAsli.toLowerCase().includes(search.toLowerCase()),
      ),
    [sorted, search],
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const totalHalaman = useMemo(
    () => lampirans.reduce((s, l) => s + (l.jumlahTotalLembar || 0), 0),
    [lampirans],
  );

  // ─── Modal handlers ───────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditTarget(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (l: LampiranPendukung) => {
    setEditTarget(l);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditTarget(undefined);
  };

  const handleModalSave = (lampiran: LampiranPendukung) => {
    if (editTarget) {
      onUpdate(lampiran.id, lampiran);
    } else {
      onAdd(lampiran);
    }
    setCurrentPage(1);
    setEditTarget(undefined);
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    onRemove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, onRemove]);

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("dragId", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData("dragId");
      if (dragId === targetId) return;

      const arr = [...sorted];
      const fromIdx = arr.findIndex((l) => l.id === dragId);
      const toIdx = arr.findIndex((l) => l.id === targetId);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);

      onReorder(arr.map((l, i) => ({ ...l, urutan: i + 1 })));
      setDragOverId(null);
      setDraggingId(null);
    },
    [sorted, onReorder],
  );

  // ─── Ubah urutan manual ───────────────────────────────────────────────────

  const handleUrutanCommit = useCallback(
    (lampiran: LampiranPendukung, rawValue: string) => {
      setEditingUrutan((prev) => {
        const next = { ...prev };
        delete next[lampiran.id];
        return next;
      });

      const newUrutan = parseInt(rawValue);
      const total = lampirans.length;
      if (
        isNaN(newUrutan) ||
        newUrutan < 1 ||
        newUrutan > total ||
        newUrutan === lampiran.urutan
      )
        return;

      const arr = [...sorted];
      const oldIdx = arr.findIndex((l) => l.id === lampiran.id);
      const newIdx = newUrutan - 1;
      const [moved] = arr.splice(oldIdx, 1);
      arr.splice(newIdx, 0, moved);

      onReorder(arr.map((l, i) => ({ ...l, urutan: i + 1 })));
    },
    [lampirans.length, sorted, onReorder],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Modals ── */}
      <UploadLampiranPendukungModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        nextUrutan={lampirans.length + 1}
        editData={editTarget}
        onSave={handleModalSave}
      />

      {previewTarget && (
        <PreviewPdfModal
          lampiran={previewTarget}
          onClose={() => setPreviewTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          lampiran={deleteTarget}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── MAIN CARD ── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Lampiran Pendukung
            </h2>
            <p className="mt-0.5 text-sm text-gray-400">
              {lampirans.length} dokumen ·{" "}
              {totalHalaman > 0
                ? `${totalHalaman} halaman total`
                : "belum ada halaman"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                type="text"
                placeholder="Cari dokumen..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-52 rounded-xl border border-gray-200 bg-gray-50 py-2 pr-4 pl-9 text-sm text-gray-700 placeholder-gray-400 focus:border-violet-400 focus:bg-white focus:ring-1 focus:ring-violet-300 focus:outline-none"
              />
            </div>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Tambah Lampiran
            </button>
          </div>
        </div>

        {/* KONTEN KOSONG */}
        {lampirans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-50">
              <svg
                className="h-10 w-10 text-violet-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-400">
              Belum ada lampiran pendukung
            </p>
            <p className="mt-1 text-sm text-gray-300">
              Klik tombol &quot;Tambah Lampiran&quot; untuk mengunggah dokumen
              PDF pendukung
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-6 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Tambah Lampiran Pendukung
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100">
              <svg
                className="h-7 w-7 text-gray-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400">
              Tidak ditemukan hasil untuk &quot;{search}&quot;
            </p>
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-xs text-violet-500 hover:underline"
            >
              Hapus pencarian
            </button>
          </div>
        ) : (
          <>
            {/* TABLE HEADER */}
            <div className="grid grid-cols-[40px_56px_1fr_160px_80px_100px] items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-6 py-2.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              <span />
              <span>Urutan</span>
              <span>Judul Dokumen</span>
              <span>File</span>
              <span className="text-center">Halaman</span>
              <span className="text-right">Aksi</span>
            </div>

            {/* TABLE ROWS */}
            <div className="divide-y divide-gray-50">
              {paginated.map((lampiran) => (
                <div
                  key={lampiran.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lampiran.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverId(lampiran.id);
                  }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => handleDrop(e, lampiran.id)}
                  className={`grid grid-cols-[40px_56px_1fr_160px_80px_100px] items-center gap-3 px-6 py-4 transition-all ${
                    dragOverId === lampiran.id
                      ? "bg-violet-50 ring-2 ring-violet-300 ring-inset"
                      : draggingId === lampiran.id
                        ? "opacity-40"
                        : "hover:bg-gray-50/80"
                  }`}
                >
                  {/* Drag handle */}
                  <DragHandle isDragging={draggingId === lampiran.id} />

                  {/* Urutan input */}
                  <div className="flex items-center justify-center">
                    <input
                      type="number"
                      min={1}
                      max={lampirans.length}
                      value={
                        editingUrutan[lampiran.id] !== undefined
                          ? editingUrutan[lampiran.id]
                          : lampiran.urutan
                      }
                      onChange={(e) =>
                        setEditingUrutan((prev) => ({
                          ...prev,
                          [lampiran.id]: e.target.value,
                        }))
                      }
                      onBlur={(e) =>
                        handleUrutanCommit(lampiran, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          (e.target as HTMLInputElement).blur();
                      }}
                      className="w-12 rounded-lg border border-gray-200 bg-white py-1 text-center text-sm font-bold text-gray-700 focus:border-violet-400 focus:ring-1 focus:ring-violet-300 focus:outline-none"
                    />
                  </div>

                  {/* Judul */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {lampiran.judul}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {lampiran.namaFileAsli}
                    </p>
                  </div>

                  {/* Nama file lokal */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="h-3.5 w-3.5 flex-shrink-0 text-red-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Z" />
                      </svg>
                      <span className="truncate text-xs text-gray-500">
                        {lampiran.namaFileDiStorageLokal}
                      </span>
                    </div>
                  </div>

                  {/* Halaman */}
                  <div className="text-center">
                    <span className="text-sm font-semibold text-gray-700">
                      {lampiran.jumlahTotalLembar || "—"}
                    </span>
                    {lampiran.jumlahTotalLembar > 0 && (
                      <p className="text-[10px] text-gray-400">hal.</p>
                    )}
                  </div>

                  {/* Aksi */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setPreviewTarget(lampiran)}
                      title="Preview"
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-sky-50 hover:text-sky-600"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(lampiran)}
                      title="Edit"
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-violet-50 hover:text-violet-600"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(lampiran)}
                      title="Hapus"
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                <p className="text-xs text-gray-400">
                  {filtered.length} dokumen · Halaman {currentPage} dari{" "}
                  {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          p === currentPage
                            ? "border-violet-600 bg-violet-600 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* SUMMARY FOOTER */}
            <div className="border-t border-gray-100 bg-gray-50/40 px-6 py-3">
              <div className="flex items-center gap-6 text-xs text-gray-500">
                <span className="font-medium">
                  {lampirans.length} Lampiran Pendukung
                </span>
                <span className="text-gray-300">·</span>
                <span>{totalHalaman} halaman total</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">
                  Drag baris untuk mengubah urutan, atau edit angka di kolom
                  Urutan
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
