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

  // Modal tambah / edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LampiranUtama | undefined>(
    undefined,
  );

  // Modal preview PDF
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

  // ─── Handlers ─────────────────────────────────────────────────────────────

  /** Tambah baru dari modal */
  const handleModalSave = (lampiran: LampiranUtama) => {
    if (editTarget) {
      // Mode edit → update
      onUpdate(lampiran.id, lampiran);
    } else {
      // Mode tambah → add
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

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("dragId", id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData("dragId");
    if (dragId === targetId) return;

    const reordered = [...lampirans];
    const fromIdx = reordered.findIndex((l) => l.id === dragId);
    const toIdx = reordered.findIndex((l) => l.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const reorderedWithUrutan = reordered.map((l, i) => ({
      ...l,
      urutan: i + 1,
    }));
    onReorder(reorderedWithUrutan);
    setDragOverId(null);

    // Re-apply footer dari posisi pertama yang berubah
    const changedFrom = Math.min(fromIdx, toIdx);
    reapplyFootersFrom(reorderedWithUrutan, changedFrom);
  };

  // ─── Re-apply footer untuk semua lampiran mulai dari index tertentu ────────

  /**
   * Setelah hapus atau reorder, halaman lampiran yang terdampak berubah.
   * Fungsi ini re-generate footer dari rawFileUrl dengan startPage yang benar,
   * lalu memanggil onUpdate untuk setiap lampiran yang berubah.
   *
   * @param sorted  Array lampiran yang sudah diurutkan berdasarkan urutan
   * @param fromIdx Index pertama yang perlu di-update (0-based dari sorted)
   */
  const reapplyFootersFrom = useCallback(
    async (sorted: LampiranUtama[], fromIdx: number) => {
      // Hitung startPage untuk lampiran di fromIdx
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

          // Re-apply footer dengan startPage yang baru
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
          const newFileUrl = URL.createObjectURL(blob);

          onUpdate(lampiran.id, { fileUrl: newFileUrl });
        } catch (e) {
          console.error(
            `Failed to re-apply footer for lampiran ${lampiran.id}:`,
            e,
          );
        }

        startPage += lampiran.jumlahHalaman || 0;
      }
    },
    [onUpdate],
  );

  // ─── Hitung startPage untuk lampiran baru ─────────────────────────────────

  /** Total halaman semua lampiran yang sudah ada (urut berdasarkan urutan) */
  const startPageForNew = useMemo(() => {
    const sorted = [...lampirans].sort((a, b) => a.urutan - b.urutan);
    return sorted.reduce((acc, l) => acc + (l.jumlahHalaman || 0), 1);
  }, [lampirans]);

  /**
   * startPage untuk lampiran yang sedang di-edit:
   * total halaman lampiran-lampiran SEBELUM lampiran ini (berdasarkan urutan).
   */
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
            <h2 className="text-lg font-semibold text-gray-800">
              Lampiran Utama
            </h2>
            <p className="text-sm text-gray-500">
              Daftar lampiran utama dokumen. Drag baris untuk mengurutkan.
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
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="w-10 px-4 py-3 text-center font-medium">No</th>
                <th className="px-4 py-3 text-left font-medium">Nama File</th>
                <th className="px-4 py-3 text-center font-medium">Romawi</th>
                <th className="px-4 py-3 text-center font-medium">Ukuran</th>
                <th className="px-4 py-3 text-center font-medium">
                  Jml Halaman
                </th>
                <th className="px-4 py-3 text-center font-medium">CALK</th>
                <th className="px-4 py-3 text-center font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {paginatedLampirans.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-14 text-center text-sm text-gray-400"
                  >
                    Belum ada lampiran. Klik &quot;
                    <span className="font-medium text-indigo-500">
                      + Tambah PDF
                    </span>
                    &quot; untuk mengunggah.
                  </td>
                </tr>
              ) : (
                paginatedLampirans.map((lampiran, index) => (
                  <tr
                    key={lampiran.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lampiran.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(lampiran.id);
                    }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => handleDrop(e, lampiran.id)}
                    className={`cursor-grab transition select-none hover:bg-gray-50 active:cursor-grabbing ${
                      dragOverId === lampiran.id
                        ? "border-l-4 border-l-indigo-500 bg-indigo-50"
                        : ""
                    }`}
                  >
                    {/* No */}
                    <td className="px-4 py-3 text-center text-gray-400">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>

                    {/* Nama file */}
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate font-medium text-gray-800">
                        {lampiran.namaFileDiStorageLokal}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {lampiran.judulPembatasLampiran}
                      </p>
                    </td>

                    {/* Romawi */}
                    <td className="px-4 py-3 text-center font-semibold text-gray-600">
                      {lampiran.romawiLampiran}
                    </td>

                    {/* Ukuran */}
                    <td className="px-4 py-3 text-center text-gray-500">
                      {lampiran.ukuranFile || "—"}
                    </td>

                    {/* Jumlah halaman */}
                    <td className="px-4 py-3 text-center text-gray-500">
                      {lampiran.jumlahHalaman > 0
                        ? `${lampiran.jumlahHalaman} hlm`
                        : "—"}
                    </td>

                    {/* CALK */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          lampiran.isCALK
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {lampiran.isCALK ? "Ya" : "Tidak"}
                      </span>
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3 text-xs font-medium">
                        <button
                          onClick={() => setPreviewLampiran(lampiran)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleOpenEdit(lampiran)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            // Hitung index lampiran yang dihapus di array terurut
                            const sorted = [...lampirans].sort(
                              (a, b) => a.urutan - b.urutan,
                            );
                            const removedIdx = sorted.findIndex(
                              (l) => l.id === lampiran.id,
                            );
                            onRemove(lampiran.id);
                            // Re-apply footer untuk semua lampiran setelah yang dihapus
                            const remaining = sorted.filter(
                              (l) => l.id !== lampiran.id,
                            );
                            if (removedIdx < remaining.length) {
                              reapplyFootersFrom(remaining, removedIdx);
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
            {/* Header */}
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

            {/* PDF iframe */}
            <div className="flex-1 bg-gray-200 p-3">
              <iframe
                src={previewLampiran.fileUrl}
                className="h-full w-full rounded-lg bg-white"
                title={previewLampiran.judulPembatasLampiran}
              />
            </div>

            {/* Footer info */}
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
                  className={previewLampiran.isCALK ? "text-green-600" : ""}
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
