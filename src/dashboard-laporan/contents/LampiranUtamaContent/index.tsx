"use client";

import { useCallback, useMemo, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { LampiranUtama } from "@/app/_types/type"; // sesuaikan path
import UploadLampiranUtamaModal from "./modals/UploadLampiranModal";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LampiranUtamaPageProps {
  lampirans: LampiranUtama[];
  onAdd: (lampiran: LampiranUtama) => void;
  onUpdate: (id: string, updated: Partial<LampiranUtama>) => void;
  onRemove: (id: string) => void;
  onReorder: (reordered: LampiranUtama[]) => void;
}

// ─── Drag Handle Icon ─────────────────────────────────────────────────────────

function DragHandle({ isDragging }: { isDragging: boolean }) {
  return (
    <div
      title="Drag untuk mengubah urutan"
      className={`flex cursor-grab flex-col items-center justify-center gap-[3px] rounded-md p-1.5 transition-all active:cursor-grabbing ${
        isDragging
          ? "text-indigo-500"
          : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
      }`}
    >
      {/* 6 dot grid — universal drag icon */}
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function LampiranUtamaPage({
  lampirans,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
}: LampiranUtamaPageProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingUrutan, setEditingUrutan] = useState<Record<string, string>>(
    {},
  );
  const [isReapplying, setIsReapplying] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LampiranUtama | undefined>(
    undefined,
  );
  const [previewLampiran, setPreviewLampiran] = useState<LampiranUtama | null>(
    null,
  );

  const itemsPerPage = 8;

  // ─── Filter & Pagination ──────────────────────────────────────────────────

  const filteredLampirans = useMemo(
    () =>
      lampirans.filter((l) =>
        l.judulPembatasLampiran.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, lampirans],
  );

  const totalPages = Math.ceil(filteredLampirans.length / itemsPerPage);

  const paginatedLampirans = filteredLampirans.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // ─── Modal handlers ───────────────────────────────────────────────────────

  const handleModalSave = (lampiran: LampiranUtama) => {
    if (editTarget) {
      onUpdate(lampiran.id, lampiran);
    } else {
      onAdd(lampiran);
    }
    setCurrentPage(1);
    setEditTarget(undefined);
  };

  const handleOpenEdit = (lampiran: LampiranUtama) => {
    setEditTarget(lampiran);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditTarget(undefined);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditTarget(undefined);
  };

  // ─── reapplyFootersFrom — DIDEKLARASIKAN PERTAMA ──────────────────────────

  const reapplyFootersFrom = useCallback(
    async (sorted: LampiranUtama[], fromIdx: number) => {
      let startPage = 1;
      for (let i = 0; i < fromIdx; i++) {
        startPage += sorted[i].jumlahHalaman || 0;
      }

      for (let i = fromIdx; i < sorted.length; i++) {
        const lampiran = sorted[i];
        if (!lampiran.rawFileUrl) continue;

        try {
          const res = await fetch(lampiran.rawFileUrl);
          const bytes = await res.arrayBuffer();

          const pdfDoc = await PDFDocument.load(bytes, {
            ignoreEncryption: true,
          });
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const pages = pdfDoc.getPages();
          const { footer, romawiLampiran, judulPembatasLampiran, isCALK } =
            lampiran;

          pages.forEach((page, idx) => {
            const { width: pageWidth } = page.getSize();
            const boxWidth = (pageWidth * footer.width) / 100;
            const xPos = (pageWidth - boxWidth) / 2 + footer.position.x;
            const yPos = footer.position.y;

            if (isCALK) {
              const marginRight = 100;
              const lineY = yPos + 20;
              const label = `Halaman ${startPage + idx}`;
              const lw = font.widthOfTextAtSize(label, footer.fontSize);
              const rightEdge = pageWidth - marginRight;
              page.drawText(label, {
                x: rightEdge - lw - 5,
                y: lineY,
                size: footer.fontSize,
                font,
                color: rgb(0, 0, 0),
              });
              const ket = `Lampiran ${romawiLampiran} — ${judulPembatasLampiran}`;
              const ks = Math.max(footer.fontSize - 2, 6);
              const kw = font.widthOfTextAtSize(ket, ks);
              page.drawText(ket, {
                x: rightEdge - kw - 5,
                y: lineY - ks - 3,
                size: ks,
                font,
                color: rgb(0.3, 0.3, 0.3),
              });
            } else {
              page.drawRectangle({
                x: xPos,
                y: yPos,
                width: boxWidth,
                height: footer.height,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1,
              });
              page.drawText(footer.text, {
                x: xPos + 10,
                y: yPos + footer.height / 2 - footer.fontSize / 2,
                size: footer.fontSize,
                font,
                color: rgb(0, 0, 0),
                maxWidth: boxWidth - 120,
              });
              const label = `Halaman ${startPage + idx}`;
              const lw = font.widthOfTextAtSize(label, footer.fontSize);
              page.drawText(label, {
                x: xPos + boxWidth - lw - 10,
                y: yPos + footer.height / 2 - footer.fontSize / 2,
                size: footer.fontSize,
                font,
                color: rgb(0, 0, 0),
              });
              const ket = `Lampiran ${romawiLampiran} — ${judulPembatasLampiran}`;
              const ks = Math.max(footer.fontSize - 2, 6);
              const kw = font.widthOfTextAtSize(ket, ks);
              page.drawText(ket, {
                x: xPos + (boxWidth - kw) / 2,
                y: yPos - ks - 3,
                size: ks,
                font,
                color: rgb(0.3, 0.3, 0.3),
              });
            }
          });

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([new Uint8Array(pdfBytes).buffer], {
            type: "application/pdf",
          });
          onUpdate(lampiran.id, { fileUrl: URL.createObjectURL(blob) });
        } catch (e) {
          console.error(`Failed to re-apply footer for ${lampiran.id}:`, e);
        }

        startPage += lampiran.jumlahHalaman || 0;
      }
    },
    [onUpdate],
  );

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

      const arr = [...lampirans];
      const fromIdx = arr.findIndex((l) => l.id === dragId);
      const toIdx = arr.findIndex((l) => l.id === targetId);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);

      const reordered = arr.map((l, i) => ({ ...l, urutan: i + 1 }));
      onReorder(reordered);
      setDragOverId(null);
      setDraggingId(null);

      reapplyFootersFrom(reordered, Math.min(fromIdx, toIdx));
    },
    [lampirans, onReorder, reapplyFootersFrom],
  );

  // ─── Ubah urutan via input angka ─────────────────────────────────────────

  const handleUrutanCommit = useCallback(
    async (lampiran: LampiranUtama, rawValue: string) => {
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

      const sorted = [...lampirans].sort((a, b) => a.urutan - b.urutan);
      const oldIdx = sorted.findIndex((l) => l.id === lampiran.id);
      const newIdx = newUrutan - 1;

      const reordered = [...sorted];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);

      const reindexed = reordered.map((l, i) => ({ ...l, urutan: i + 1 }));
      onReorder(reindexed);

      setIsReapplying(true);
      await reapplyFootersFrom(reindexed, Math.min(oldIdx, newIdx));
      setIsReapplying(false);
    },
    [lampirans, onReorder, reapplyFootersFrom],
  );

  // ─── Hapus ────────────────────────────────────────────────────────────────

  const handleRemove = useCallback(
    (lampiran: LampiranUtama) => {
      const sorted = [...lampirans].sort((a, b) => a.urutan - b.urutan);
      const removedIdx = sorted.findIndex((l) => l.id === lampiran.id);
      onRemove(lampiran.id);
      const remaining = sorted
        .filter((l) => l.id !== lampiran.id)
        .map((l, i) => ({ ...l, urutan: i + 1 }));
      if (removedIdx < remaining.length) {
        reapplyFootersFrom(remaining, removedIdx);
      }
    },
    [lampirans, onRemove, reapplyFootersFrom],
  );

  // ─── Hitung startPage ─────────────────────────────────────────────────────

  const startPageForNew = useMemo(() => {
    const sorted = [...lampirans].sort((a, b) => a.urutan - b.urutan);
    return sorted.reduce((acc, l) => acc + (l.jumlahHalaman || 0), 1);
  }, [lampirans]);

  const getStartPageForEdit = (lampiran: LampiranUtama): number => {
    const sorted = [...lampirans].sort((a, b) => a.urutan - b.urutan);
    let page = 1;
    for (const l of sorted) {
      if (l.id === lampiran.id) break;
      page += l.jumlahHalaman || 0;
    }
    return page;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-800">
                Lampiran Utama
              </h2>

              {/* Badge status re-apply */}
              {isReapplying ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
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
                  Memperbarui penomoran...
                </span>
              ) : lampirans.length > 1 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-500">
                  {/* drag icon mini */}
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <circle cx="5" cy="4" r="1.2" />
                    <circle cx="11" cy="4" r="1.2" />
                    <circle cx="5" cy="8" r="1.2" />
                    <circle cx="11" cy="8" r="1.2" />
                    <circle cx="5" cy="12" r="1.2" />
                    <circle cx="11" cy="12" r="1.2" />
                  </svg>
                  Drag atau edit angka untuk mengurutkan
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-gray-400">
              {lampirans.length === 0
                ? "Belum ada lampiran. Mulai dengan menambah PDF."
                : `${lampirans.length} lampiran · penomoran halaman otomatis berurutan`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Cari lampiran..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-52 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              onClick={handleOpenAdd}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              + Tambah PDF
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                {/* Kolom drag handle */}
                <th className="w-8 px-2 py-3" />
                <th
                  className="w-16 px-3 py-3 text-center font-medium"
                  title="Klik angka untuk mengubah urutan langsung"
                >
                  No
                  <span className="ml-1 text-[10px] font-normal text-gray-400">
                    (edit)
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium">Nama File</th>
                <th className="px-4 py-3 text-center font-medium">Romawi</th>
                <th className="px-4 py-3 text-center font-medium">Ukuran</th>
                <th className="px-4 py-3 text-center font-medium">Halaman</th>
                <th className="px-4 py-3 text-center font-medium">CALK</th>
                <th className="px-4 py-3 text-center font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {paginatedLampirans.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-16 text-center text-sm text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="h-10 w-10 text-gray-200"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                        />
                      </svg>
                      <span>Belum ada lampiran.</span>
                      <button
                        onClick={handleOpenAdd}
                        className="text-indigo-500 underline underline-offset-2 hover:text-indigo-700"
                      >
                        + Tambah PDF sekarang
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLampirans.map((lampiran) => {
                  const isBeingDragged = draggingId === lampiran.id;
                  const isDropTarget = dragOverId === lampiran.id;

                  return (
                    <tr
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
                      className={`group transition-all duration-150 select-none ${
                        isBeingDragged
                          ? "opacity-40 shadow-lg"
                          : isDropTarget
                            ? "bg-indigo-50"
                            : "hover:bg-gray-50"
                      }`}
                    >
                      {/* ── Drag handle ── */}
                      <td
                        className={`px-2 py-3 ${isDropTarget ? "border-l-2 border-indigo-400" : ""}`}
                      >
                        <DragHandle isDragging={isBeingDragged} />
                      </td>

                      {/* ── No / Urutan input ── */}
                      <td className="px-3 py-3 text-center">
                        <div className="group/num relative inline-flex">
                          <input
                            type="number"
                            min={1}
                            max={lampirans.length}
                            disabled={isReapplying}
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
                              else if (e.key === "Escape") {
                                setEditingUrutan((prev) => {
                                  const next = { ...prev };
                                  delete next[lampiran.id];
                                  return next;
                                });
                              }
                            }}
                            title="Ketik angka urutan baru, tekan Enter"
                            className={`w-10 rounded-md border py-1 text-center text-sm font-bold transition-all focus:ring-2 focus:outline-none ${
                              isReapplying
                                ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                                : "cursor-text border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 focus:border-indigo-400 focus:ring-indigo-200"
                            }`}
                          />
                          {/* Tooltip hint — muncul saat hover, hilang saat focus */}
                          {!isReapplying && (
                            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-[10px] whitespace-nowrap text-white opacity-0 transition-opacity group-hover/num:opacity-100">
                              Klik untuk edit urutan
                              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ── Nama file ── */}
                      <td className="max-w-[220px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* PDF icon */}
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50">
                            <svg
                              className="h-4 w-4 text-red-400"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V12Z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-800">
                              {lampiran.namaFileDiStorageLokal}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {lampiran.judulPembatasLampiran}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* ── Romawi ── */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-bold tracking-wide text-gray-600">
                          {lampiran.romawiLampiran}
                        </span>
                      </td>

                      {/* ── Ukuran ── */}
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {lampiran.ukuranFile || "—"}
                      </td>

                      {/* ── Jumlah halaman ── */}
                      <td className="px-4 py-3 text-center">
                        {lampiran.jumlahHalaman > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <svg
                              className="h-3 w-3 text-gray-400"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
                              />
                            </svg>
                            {lampiran.jumlahHalaman} hlm
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* ── CALK ── */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            lampiran.isCALK
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {lampiran.isCALK ? "CALK" : "—"}
                        </span>
                      </td>

                      {/* ── Aksi ── */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setPreviewLampiran(lampiran)}
                            title="Preview PDF"
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600"
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
                                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
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
                            title="Edit lampiran"
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
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
                            onClick={() => handleRemove(lampiran)}
                            title="Hapus lampiran"
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {filteredLampirans.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 text-sm text-gray-500">
            <span>
              {(currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, filteredLampirans.length)}{" "}
              dari {filteredLampirans.length} lampiran
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
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-md border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Tambah / Edit ── */}
      <UploadLampiranUtamaModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        nextUrutan={lampirans.length + 1}
        startPage={
          editTarget ? getStartPageForEdit(editTarget) : startPageForNew
        }
        editData={editTarget}
        onSave={handleModalSave}
      />

      {/* ── Modal Preview PDF ── */}
      {previewLampiran && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewLampiran(null);
          }}
        >
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div>
                <p className="font-semibold text-gray-800">
                  {previewLampiran.judulPembatasLampiran}
                </p>
                <p className="text-xs text-gray-500">
                  {previewLampiran.namaFileDiStorageLokal}
                </p>
              </div>
              <button
                onClick={() => setPreviewLampiran(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 bg-gray-200 p-3">
              <iframe
                src={previewLampiran.fileUrl}
                className="h-full w-full rounded-lg bg-white"
                title={previewLampiran.judulPembatasLampiran}
              />
            </div>
            <div className="flex items-center gap-6 border-t border-gray-200 bg-gray-50 px-6 py-3 text-xs text-gray-500">
              <span>
                Romawi: <strong>{previewLampiran.romawiLampiran}</strong>
              </span>
              <span>
                Halaman: <strong>{previewLampiran.jumlahHalaman || "—"}</strong>
              </span>
              <span>
                CALK:{" "}
                <strong
                  className={previewLampiran.isCALK ? "text-emerald-600" : ""}
                >
                  {previewLampiran.isCALK ? "Ya" : "Tidak"}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
