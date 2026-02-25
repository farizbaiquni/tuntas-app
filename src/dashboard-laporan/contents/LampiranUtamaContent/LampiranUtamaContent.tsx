"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { JenisLaporan, LampiranUtama } from "@/app/_types/type";
import UploadLampiranUtamaModal from "./modals/UploadLampiranModal";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LampiranUtamaPageProps {
  lampirans: LampiranUtama[];
  jenisLaporan: JenisLaporan;
  tahun: number;
  nomor: number | null;
  onAdd: (lampiran: LampiranUtama) => void;
  onUpdate: (id: string, updated: Partial<LampiranUtama>) => void;
  onRemove: (id: string) => void;
  onReorder: (reordered: LampiranUtama[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Rule 6.3 / 7.4: Hoist static lookup maps to module level.
// Rule 7.11: Use Map/Record for O(1) lookups instead of switch-case evaluated on every call.
const LABEL_PERATURAN_MAP: Record<JenisLaporan, string> = {
  [JenisLaporan.RAPERDA]: "RANCANGAN PERATURAN DAERAH KABUPATEN KENDAL",
  [JenisLaporan.PERDA]: "PERATURAN DAERAH KABUPATEN KENDAL",
  [JenisLaporan.SALINAN_PERDA]: "PERATURAN DAERAH KABUPATEN KENDAL",
  [JenisLaporan.RAPERBUP]: "RANCANGAN PERATURAN BUPATI KENDAL",
  [JenisLaporan.PERBUP]: "PERATURAN BUPATI KENDAL",
  [JenisLaporan.SALINAN_PERBUP]: "PERATURAN BUPATI KENDAL",
};

const SHORT_LABEL_MAP: Record<JenisLaporan, string> = {
  [JenisLaporan.RAPERDA]: "RAPERDA",
  [JenisLaporan.PERDA]: "PERDA",
  [JenisLaporan.SALINAN_PERDA]: "SALINAN PERDA",
  [JenisLaporan.RAPERBUP]: "RAPERBUP",
  [JenisLaporan.PERBUP]: "PERBUP",
  [JenisLaporan.SALINAN_PERBUP]: "SALINAN PERBUP",
};

// ─── Drag Handle Icon ─────────────────────────────────────────────────────────

// Rule 6.3: Hoist static repeated JSX (dot grid) to module-level constants.
const DOT = <span className="block h-[3px] w-[3px] rounded-full bg-current" />;
const DOT_ROW = (
  <div className="flex gap-[3px]">
    {DOT}
    {DOT}
  </div>
);

// Rule 5.5: Extract to memoized component so it only re-renders when isDragging changes.
const DragHandle = memo(function DragHandle({ isDragging }: { isDragging: boolean }) {
  return (
    <div
      title="Drag untuk mengubah urutan"
      className={`flex cursor-grab flex-col items-center justify-center gap-[3px] rounded-md p-1.5 transition-all active:cursor-grabbing ${
        isDragging
          ? "text-indigo-500"
          : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
      }`}
    >
      {DOT_ROW}
      {DOT_ROW}
      {DOT_ROW}
    </div>
  );
});

// Rule 6.3: Hoist constant outside component to avoid redeclaring on every render.
const ITEMS_PER_PAGE = 8;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LampiranUtamaContent({
  lampirans,
  jenisLaporan,
  tahun,
  nomor,
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

  // ─── Filter & Pagination ──────────────────────────────────────────────────

  const filteredLampirans = useMemo(
    () =>
      lampirans.filter((l) =>
        l.judulPembatasLampiran.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, lampirans],
  );

  // Rule 5.3: Simple arithmetic with primitive result — do NOT wrap in useMemo.
  const totalPages = Math.ceil(filteredLampirans.length / ITEMS_PER_PAGE);

  // Rule 5.1: Derive paginated slice directly during render; no extra state needed.
  const paginatedLampirans = filteredLampirans.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
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

  // ─── reapplyFootersFrom ───────────────────────────────────────────────────

  const reapplyFootersFrom = useCallback(
    async (sorted: LampiranUtama[], fromIdx: number) => {
      // Rule 7.6: Combine flatMap+reduce into a single pass to count skipped pages.
      const halamanBernomorOf = (l: LampiranUtama): number => {
        const totalPdf = l.jumlahHalaman || 0;
        let totalSkip = 0;
        for (const b of l.babs) {
          for (const lc of b.lampiranCalk ?? []) {
            totalSkip += lc.sampaiAkhir
              ? Math.max(0, totalPdf - lc.halamanMulai + 1)
              : lc.jumlahHalaman || 0;
          }
        }
        return Math.max(0, totalPdf - totalSkip);
      };

      let startPage = 1;
      for (let i = 0; i < fromIdx; i++) {
        startPage += halamanBernomorOf(sorted[i]);
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

          const totalPages_count = pages.length;

          const skipRanges: Array<{ from: number; to: number }> =
            lampiran.babs.flatMap((bab) =>
              (bab.lampiranCalk ?? []).map((lc) => ({
                from: lc.halamanMulai,
                to: lc.sampaiAkhir
                  ? totalPages_count
                  : lc.halamanMulai + lc.jumlahHalaman - 1,
              })),
            );

          let pageCounter = startPage;
          pages.forEach((page, idx) => {
            const pdfPage = idx + 1;
            const isSkipped = skipRanges.some(
              (r) => pdfPage >= r.from && pdfPage <= r.to,
            );
            if (isSkipped) return;

            const { width: pageWidth } = page.getSize();
            const boxWidth = (pageWidth * footer.width) / 100;
            const xPos = (pageWidth - boxWidth) / 2 + footer.position.x;
            const yPos = footer.position.y;

            if (isCALK) {
              const marginRight = 100;
              const lineY = yPos + 20;
              const label = `Halaman ${pageCounter}`;
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
              const label = `Halaman ${pageCounter}`;
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

            pageCounter++;
          });

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([new Uint8Array(pdfBytes).buffer], {
            type: "application/pdf",
          });
          onUpdate(lampiran.id, { fileUrl: URL.createObjectURL(blob) });
        } catch (e) {
          console.error(`Failed to re-apply footer for ${lampiran.id}:`, e);
        }

        startPage += halamanBernomorOf(lampiran);
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
      // Rule 7.8: Early return for no-op drops.
      if (dragId === targetId) return;

      // Rule 7.12: toSorted() instead of [...arr] + .sort() to avoid double allocation.
      const arr = lampirans.toSorted((a, b) => a.urutan - b.urutan);
      const fromIdx = arr.findIndex((l) => l.id === dragId);
      const toIdx = arr.findIndex((l) => l.id === targetId);
      const mutable = [...arr];
      const [moved] = mutable.splice(fromIdx, 1);
      mutable.splice(toIdx, 0, moved);

      const reordered = mutable.map((l, i) => ({ ...l, urutan: i + 1 }));
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
      // Rule 5.9: Functional setState to avoid stale closure on editingUrutan.
      setEditingUrutan((prev) => {
        const next = { ...prev };
        delete next[lampiran.id];
        return next;
      });

      const newUrutan = parseInt(rawValue);
      const total = lampirans.length;
      // Rule 7.8: Early return for invalid / no-op values.
      if (
        isNaN(newUrutan) ||
        newUrutan < 1 ||
        newUrutan > total ||
        newUrutan === lampiran.urutan
      )
        return;

      // Rule 7.12: Use toSorted() for immutability — does not mutate the lampirans prop.
      const sorted = lampirans.toSorted((a, b) => a.urutan - b.urutan);
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
      // Rule 7.12: toSorted() instead of [...arr].sort() for immutability.
      const sorted = lampirans.toSorted((a, b) => a.urutan - b.urutan);
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

  // Rule 7.6: Inline helper to avoid repeated closure allocation on hot path.
  const halamanDiberiNomorOf = (l: LampiranUtama): number => {
    const halamanSkip = l.babs
      .flatMap((b) => b.lampiranCalk ?? [])
      .reduce((sum, lc) => {
        const jumlah = lc.sampaiAkhir
          ? Math.max(0, l.jumlahHalaman - lc.halamanMulai + 1)
          : lc.jumlahHalaman || 0;
        return sum + jumlah;
      }, 0);
    return l.jumlahHalaman - halamanSkip;
  };

  const startPageForNew = useMemo(() => {
    // Rule 7.12: toSorted() for immutability.
    const sorted = lampirans.toSorted((a, b) => a.urutan - b.urutan);
    return sorted.reduce((acc, l) => acc + halamanDiberiNomorOf(l), 1);
  }, [lampirans]);

  const getStartPageForEdit = (lampiran: LampiranUtama): number => {
    // Rule 7.12: toSorted() for immutability.
    const sorted = lampirans.toSorted((a, b) => a.urutan - b.urutan);
    let page = 1;
    for (const l of sorted) {
      // Rule 7.8: Early return pattern.
      if (l.id === lampiran.id) break;
      page += halamanDiberiNomorOf(l);
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
                  Re-applying footer…
                </span>
              ) : null}
            </div>
          {/* Rule 5.1: Derive totalHalaman inline — no separate state needed for this simple sum. */}
          <p className="mt-0.5 text-sm text-gray-400">
            {lampirans.length} lampiran ·{" "}
            {lampirans.reduce((s, l) => s + (l.jumlahHalaman || 0), 0)}{" "}
            halaman total
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
                placeholder="Cari lampiran..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-56 rounded-xl border border-gray-200 bg-gray-50 py-2 pr-4 pl-9 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-300 focus:outline-none"
              />
            </div>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
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

        {/* ── INFO KONTEKS PERATURAN ── */}
        <div className="border-b border-gray-100 bg-indigo-50/40 px-6 py-3">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-600">
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
                  d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                />
              </svg>
              <span className="font-medium">Konteks dari Informasi Umum:</span>
            </div>
            <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">
              {SHORT_LABEL_MAP[jenisLaporan]}
            </span>
            <span className="truncate text-indigo-500">
              {LABEL_PERATURAN_MAP[jenisLaporan]}
            </span>
            <span className="text-indigo-400">·</span>
            <span className="text-indigo-500">Tahun {tahun}</span>
            <span className="text-indigo-400">·</span>
            <span className="text-indigo-500">
              {nomor ? (
                `Nomor ${nomor}`
              ) : (
                <span className="text-amber-500">Nomor belum diset</span>
              )}
            </span>
          </div>
        </div>

        {/* TABLE */}
        {filteredLampirans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <svg
                className="h-8 w-8 text-gray-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400">
              {search
                ? `Tidak ditemukan lampiran untuk "${search}"`
                : "Belum ada lampiran"}
            </p>
            {!search && (
              <p className="mt-1 text-xs text-gray-300">
                Klik tombol Tambah Lampiran untuk mulai
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Header tabel */}
            <div className="grid grid-cols-[40px_48px_32px_1fr_120px_80px_80px_80px_100px] items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-6 py-2.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              <span />
              <span>Urutan</span>
              <span>ROM.</span>
              <span>Judul Lampiran</span>
              <span>File</span>
              <span className="text-center">Hal.</span>
              <span className="text-center">CALK</span>
              <span className="text-center">Ukuran</span>
              <span className="text-right">Aksi</span>
            </div>

            <div className="divide-y divide-gray-50">
              {paginatedLampirans.map((lampiran) => (
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
                  className={`grid grid-cols-[40px_48px_32px_1fr_120px_80px_80px_80px_100px] items-center gap-3 px-6 py-3.5 transition-all ${
                    dragOverId === lampiran.id
                      ? "bg-indigo-50 ring-2 ring-indigo-300 ring-inset"
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
                      className="w-10 rounded-lg border border-gray-200 bg-white py-1 text-center text-sm font-bold text-gray-700 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                    />
                  </div>

                  {/* Romawi */}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600">
                    {lampiran.romawiLampiran}
                  </span>

                  {/* Judul */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {lampiran.judulPembatasLampiran}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {lampiran.namaFileDiStorageLokal}
                    </p>
                  </div>

                  {/* File size */}
                  <span className="truncate text-xs text-gray-500">
                    {lampiran.ukuranFile}
                  </span>

                  {/* Halaman */}
                  <span className="text-center text-sm font-semibold text-gray-700">
                    {lampiran.jumlahHalaman || "—"}
                  </span>

                  {/* CALK */}
                  <div className="flex justify-center">
                    {lampiran.isCALK ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        CALK
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>

                  {/* Ukuran */}
                  <span className="text-center text-xs text-gray-400">
                    {lampiran.jumlahTotalLembar || "—"} lbr
                  </span>

                  {/* Aksi */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setPreviewLampiran(lampiran)}
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
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                <p className="text-xs text-gray-400">
                  {filteredLampirans.length} lampiran · Halaman {currentPage}{" "}
                  dari {totalPages}
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
                            ? "border-indigo-600 bg-indigo-600 text-white"
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
          </>
        )}
      </div>

      {/* Modal Upload/Edit */}
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

      {/* Modal Preview PDF */}
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