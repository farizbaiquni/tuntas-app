"use client";

import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { PDFDocument, StandardFonts, rgb, PageSizes, type RGB } from "pdf-lib";
import {
  LampiranUtama,
  LampiranPendukung,
  JenisLaporan,
} from "@/app/_types/type";
import {
  generateDaftarIsi,
  buildDaftarIsiEntries,
} from "@/app/_utils/generateDaftarIsi";

// ─── Props ────────────────────────────────────────────────────────────────────

interface GenerateProps {
  lampirans: LampiranUtama[];
  lampiransPendukung: LampiranPendukung[];
  batangTubuh: string | null;
  jenisLaporan: JenisLaporan;
  tahun: number;
  nomor: number | null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "idle" | "loading" | "done" | "error";
type PageSize = "LEGAL" | "A4";

interface MergeStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_DIMENSIONS: Record<PageSize, [number, number]> = {
  LEGAL: [609.6, 935.6],
  A4: PageSizes.A4 as [number, number],
};

const LAYOUT_RATIOS = {
  garudaTopMargin: 0.12,
  perdaTitle: 0.35,
  nomorPerda: 0.378,
  tentang: 0.468,
  judulFirstLine: 0.566,
  instansi: 0.829,
  tahunInstansi: 0.851,
} as const;

const FONT_SIZES = { heading: 20, subheading: 18, label: 7 } as const;

// Rule 6.3: Hoist static option arrays to module level — not recreated on every render.
const PAGE_SIZE_OPTIONS: PageSize[] = ["LEGAL", "A4"];
const LINE_GAP_PT = 21;
const Y_OFFSET = 8;
const GARUDA_MAX_WIDTH = 130;

const DEFAULT_COVER = {
  judulTentang: [
    "PERTANGGUNGJAWABAN PELAKSANAAN",
    "ANGGARAN PENDAPATAN DAN BELANJA DAERAH",
    "TAHUN ANGGARAN 2025",
  ],
  namaInstansi: "PEMERINTAH KABUPATEN KENDAL",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Rule 7.8: Early return at each size boundary — avoids evaluating lower branches.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

// Rule 6.3 / 7.4 / 7.11: Replace switch-case functions with module-level Record maps.
// Created once, never recreated; O(1) lookup vs O(n) switch evaluation.
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

/** Snapshot key — mencakup lampiransPendukung agar stale detection akurat */
function snapshotKey(
  lampirans: LampiranUtama[],
  lampiransPendukung: LampiranPendukung[],
  batangTubuh: string | null,
  jenisLaporan: JenisLaporan,
  tahun: number,
  nomor: number | null,
): string {
  const ids = lampirans
    .map((l) => `${l.id}:${l.urutan}:${l.jumlahHalaman}:${l.fileUrl}`)
    .join("|");
  const pendukungIds = lampiransPendukung
    .map((l) => `${l.id}:${l.urutan}:${l.jumlahTotalLembar}:${l.fileUrl}`)
    .join("|");
  return `${ids}__${pendukungIds}__${batangTubuh ?? "none"}__${jenisLaporan}__${tahun}__${nomor ?? "null"}`;
}

// ─── Cover PDF Builder ────────────────────────────────────────────────────────

async function buildCoverPage(
  pdfDoc: PDFDocument,
  jenisLaporan: JenisLaporan,
  tahun: number,
  nomor: number | null,
  pageSize: PageSize,
): Promise<void> {
  const [PW, PH] = PAGE_DIMENSIONS[pageSize];
  const page = pdfDoc.addPage([PW, PH]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const BLACK: RGB = rgb(0, 0, 0);
  const CX = PW / 2;

  const drawCentered = (text: string, yFromTop: number, size: number) => {
    const tw = fontBold.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: CX - tw / 2,
      y: PH - yFromTop,
      size,
      font: fontBold,
      color: BLACK,
    });
  };

  const garudaTopY = PH * LAYOUT_RATIOS.garudaTopMargin;
  try {
    const res = await fetch("/logo/garuda-logo-grayscale.png");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = await res.arrayBuffer();
    const img = await pdfDoc.embedPng(bytes);
    const { width: iw, height: ih } = img.scale(1);
    const scale = GARUDA_MAX_WIDTH / iw;
    page.drawImage(img, {
      x: CX - (iw * scale) / 2,
      y: PH - garudaTopY - ih * scale,
      width: iw * scale,
      height: ih * scale,
    });
  } catch {
    page.drawCircle({
      x: CX,
      y: PH - garudaTopY - 35,
      size: 35,
      borderColor: BLACK,
      borderWidth: 1.5,
    });
  }

  drawCentered(
    LABEL_PERATURAN_MAP[jenisLaporan],
    PH * LAYOUT_RATIOS.perdaTitle + Y_OFFSET,
    FONT_SIZES.heading,
  );

  const nomorLabel = nomor
    ? `NOMOR ${nomor} TAHUN ${tahun}`
    : `NOMOR           TAHUN ${tahun}`;
  drawCentered(
    nomorLabel,
    PH * LAYOUT_RATIOS.nomorPerda + Y_OFFSET,
    FONT_SIZES.heading,
  );
  drawCentered(
    "TENTANG",
    PH * LAYOUT_RATIOS.tentang + Y_OFFSET,
    FONT_SIZES.heading,
  );

  const judulBaseY = PH * LAYOUT_RATIOS.judulFirstLine + Y_OFFSET;
  DEFAULT_COVER.judulTentang.forEach((line, i) => {
    if (line.trim())
      drawCentered(
        line.trim(),
        judulBaseY + i * LINE_GAP_PT,
        FONT_SIZES.subheading,
      );
  });

  drawCentered(
    DEFAULT_COVER.namaInstansi,
    PH * LAYOUT_RATIOS.instansi + Y_OFFSET,
    FONT_SIZES.subheading,
  );
  drawCentered(
    `TAHUN ${tahun}`,
    PH * LAYOUT_RATIOS.tahunInstansi + Y_OFFSET,
    FONT_SIZES.subheading,
  );

  const sizeLabel = `${pageSize} · ${Math.round(PW / 2.835)}×${Math.round(PH / 2.835)} mm`;
  const lw = fontBold.widthOfTextAtSize(sizeLabel, FONT_SIZES.label);
  page.drawText(sizeLabel, {
    x: PW - 72 - lw,
    y: 18,
    size: FONT_SIZES.label,
    font: fontBold,
    color: rgb(0.6, 0.6, 0.6),
  });
}

// ─── Cover Lampiran Utama Builder ─────────────────────────────────────────────

function buildCoverLampiran(
  pdfDoc: PDFDocument,
  lampiran: LampiranUtama,
  jenisLaporan: JenisLaporan,
  tahun: number,
  nomor: number | null,
  fontRegular: import("pdf-lib").PDFFont,
  fontBold: import("pdf-lib").PDFFont,
  pageSize: PageSize,
): void {
  const [PW, PH] = PAGE_DIMENSIONS[pageSize];
  const page = pdfDoc.addPage([PW, PH]);
  const CX = PW / 2;
  const BLACK: RGB = rgb(0, 0, 0);

  const dc = (text: string, y: number, size = 16, bold = false) => {
    const font = bold ? fontBold : fontRegular;
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: CX - tw / 2, y, size, font, color: BLACK });
  };

  let cy = PH - 90;
  dc(`LAMPIRAN ${lampiran.romawiLampiran}`, cy, 15);
  cy -= 50;
  dc(LABEL_PERATURAN_MAP[jenisLaporan], cy, 15);
  cy -= 20;
  dc(
    nomor ? `NOMOR ${nomor} TAHUN ${tahun}` : `NOMOR   TAHUN ${tahun}`,
    cy,
    15,
  );
  cy -= 120;

  const judulLines = (lampiran.judulPembatasLampiran || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  judulLines.forEach((line) => {
    dc(line, cy, 22, true);
    cy -= 30;
  });

  dc(`TAHUN ANGGARAN ${tahun}`, 60, 16);
}

// ─── PDF Preview Modal ────────────────────────────────────────────────────────

// Rule 5.5: Extract to memoized component — PreviewModal only re-renders when its own props change,
// not on every parent state update (progress, steps, etc.).
const PreviewModal = memo(function PreviewModal({
  url,
  onClose,
  onDownload,
  fileName,
  resultPages,
  resultSize,
}: {
  url: string;
  onClose: () => void;
  onDownload: () => void;
  fileName: string;
  resultPages: number;
  resultSize: string;
}) {
  // Rule 8.2: Store latest onClose in a ref — the effect only mounts/unmounts once,
  // but always calls the current handler without adding it to the dependency array.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    // Rule 4.2: Passive listener — we never call preventDefault(), so mark as passive
    // to allow the browser to optimize scroll/keyboard performance.
    window.addEventListener("keydown", h, { passive: true });
    return () => window.removeEventListener("keydown", h);
    // Rule 5.6: Empty deps — effect runs once on mount/unmount.
    // onClose changes are handled via the ref above, not via re-subscription.
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <svg
              className="h-5 w-5 text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-800">
              {fileName}
            </p>
            <p className="text-xs text-gray-400">
              {resultPages} halaman · {resultSize}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
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
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Unduh
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100"
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
        <div className="flex-1 overflow-hidden bg-gray-300 p-3">
          <iframe
            src={url}
            className="h-full w-full rounded-lg border border-gray-400 bg-white shadow"
            title="Preview PDF"
          />
        </div>
        <div className="flex flex-shrink-0 items-center justify-center border-t border-gray-100 bg-gray-50 py-2">
          <p className="text-xs text-gray-400">
            Tekan{" "}
            <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
              Esc
            </kbd>{" "}
            atau klik di luar untuk menutup
          </p>
        </div>
      </div>
    </div>
  );
});

// ─── Stale Banner ─────────────────────────────────────────────────────────────

// Rule 5.5: Memoized — only re-renders when changes/callbacks actually change.
const StaleBanner = memo(function StaleBanner({
  changes,
  onDismiss,
  onRegenerate,
}: {
  changes: string[];
  onDismiss: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
        <svg
          className="h-4 w-4 text-amber-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800">
          Data berubah sejak terakhir generate
        </p>
        <p className="mt-0.5 text-xs text-amber-600">
          PDF yang dihasilkan mungkin sudah tidak sesuai dengan kondisi terkini.
        </p>
        {changes.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {changes.map((c, i) => (
              <li
                key={i}
                className="flex items-center gap-1.5 text-xs text-amber-700"
              >
                <span className="h-1 w-1 flex-shrink-0 rounded-full bg-amber-400" />
                {c}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onRegenerate}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 active:scale-95"
          >
            Generate Ulang
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50"
          >
            Abaikan
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GenerateContent({
  lampirans,
  lampiransPendukung,
  batangTubuh,
  jenisLaporan,
  tahun,
  nomor,
}: GenerateProps) {
  const [steps, setSteps] = useState<MergeStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<string>("");
  const [resultPages, setResultPages] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>("LEGAL");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Stale detection
  const generatedSnapshotRef = useRef<string | null>(null);
  const [isStaleDismissed, setIsStaleDismissed] = useState(false);
  const [staleChanges, setStaleChanges] = useState<string[]>([]);

  const currentSnapshot = useMemo(
    () =>
      snapshotKey(
        lampirans,
        lampiransPendukung,
        batangTubuh,
        jenisLaporan,
        tahun,
        nomor,
      ),
    [lampirans, lampiransPendukung, batangTubuh, jenisLaporan, tahun, nomor],
  );

  // ── Stale detection effect ────────────────────────────────────────────────

  useEffect(() => {
    if (!isDone || generatedSnapshotRef.current === null) return;
    if (currentSnapshot === generatedSnapshotRef.current) {
      setStaleChanges([]);
      setIsStaleDismissed(false);
      return;
    }

    const changes: string[] = [];
    const prev = generatedSnapshotRef.current ?? "";
    // snapshot format: ids__pendukungIds__batang__jenis__tahun__nomor
    const [prevIds, prevPIds, prevBatang, prevJenis, prevTahun, prevNomor] =
      prev.split("__");

    // Rule 7.11: Build Maps from previous snapshot segments for O(1) lookups —
    // avoids repeated .find() O(n) scans inside the .filter() calls below.
    const prevUMap = new Map(
      prevIds
        .split("|")
        .filter(Boolean)
        .map((s) => {
          const [id, urutan, halaman] = s.split(":");
          return [id, { urutan, halaman }] as const;
        }),
    );
    const prevPMap = new Map(
      (prevPIds || "")
        .split("|")
        .filter(Boolean)
        .map((s) => {
          const [id, urutan, halaman] = s.split(":");
          return [id, { urutan, halaman }] as const;
        }),
    );

    // Lampiran utama
    const prevIdSet = new Set(prevUMap.keys());
    const currIdSet = new Set(lampirans.map((l) => l.id));
    const added = lampirans.filter((l) => !prevIdSet.has(l.id));
    const removed = [...prevIdSet].filter((id) => !currIdSet.has(id));
    if (added.length > 0)
      changes.push(
        `${added.length} lampiran utama baru (${added.map((l) => l.romawiLampiran).join(", ")})`,
      );
    if (removed.length > 0)
      changes.push(`${removed.length} lampiran utama dihapus`);

    // Rule 7.11: O(1) Map.get() instead of O(n) .find() per lampiran
    const updatedU = lampirans.filter((l) => {
      const p = prevUMap.get(l.id);
      if (!p) return false;
      return String(l.urutan) !== p.urutan || String(l.jumlahHalaman) !== p.halaman;
    });
    if (updatedU.length > 0)
      changes.push(
        `${updatedU.length} lampiran utama diubah (${updatedU.map((l) => l.romawiLampiran).join(", ")})`,
      );

    // Lampiran pendukung
    const prevPIdSet = new Set(prevPMap.keys());
    const currPIdSet = new Set(lampiransPendukung.map((l) => l.id));
    const addedP = lampiransPendukung.filter((l) => !prevPIdSet.has(l.id));
    const removedP = [...prevPIdSet].filter((id) => !currPIdSet.has(id));
    if (addedP.length > 0)
      changes.push(`${addedP.length} lampiran pendukung baru ditambahkan`);
    if (removedP.length > 0)
      changes.push(`${removedP.length} lampiran pendukung dihapus`);

    // Rule 7.11: O(1) Map.get() instead of O(n) .find() per pendukung
    const updatedP = lampiransPendukung.filter((l) => {
      const p = prevPMap.get(l.id);
      if (!p) return false;
      return String(l.urutan) !== p.urutan || String(l.jumlahTotalLembar) !== p.halaman;
    });
    if (updatedP.length > 0)
      changes.push(`${updatedP.length} lampiran pendukung diubah urutannya`);

    // Informasi umum & batang tubuh
    if (prevBatang !== (batangTubuh ?? "none")) {
      if (prevBatang === "none") changes.push("Batang tubuh baru diunggah");
      else if (!batangTubuh) changes.push("Batang tubuh dihapus");
      else changes.push("File batang tubuh diganti");
    }
    if (prevJenis !== jenisLaporan)
      changes.push(
        `Jenis laporan berubah menjadi ${SHORT_LABEL_MAP[jenisLaporan]}`,
      );
    if (prevTahun !== String(tahun))
      changes.push(`Tahun berubah menjadi ${tahun}`);
    if (prevNomor !== String(nomor ?? "null"))
      changes.push(`Nomor berubah menjadi ${nomor ?? "kosong"}`);

    if (changes.length === 0) changes.push("Terdapat perubahan pada data");
    setStaleChanges(changes);
    setIsStaleDismissed(false);
  }, [
    currentSnapshot,
    isDone,
    batangTubuh,
    lampirans,
    lampiransPendukung,
    jenisLaporan,
    tahun,
    nomor,
  ]);

  // Rule 5.3: Simple boolean expression with primitive result — computed inline during render.
  const showStaleBanner =
    isDone && staleChanges.length > 0 && !isStaleDismissed && !isGenerating;

  // ── Sorted lists ─────────────────────────────────────────────────────────

  // Rule 7.12: toSorted() — immutable sort, does not mutate the lampirans prop array.
  const sorted = useMemo(
    () => [...lampirans].sort((a, b) => a.urutan - b.urutan),
    [lampirans],
  );

  // Rule 7.12: toSorted() — immutable sort, does not mutate the lampiransPendukung prop array.
  const sortedPendukung = useMemo(
    () => [...lampiransPendukung].sort((a, b) => a.urutan - b.urutan),
    [lampiransPendukung],
  );

  // Rule 5.3: Simple reduce expressions with numeric (primitive) results — do NOT wrap in useMemo.
  // The useMemo hook overhead (closure + dependency comparison) exceeds the cost of the expression.
  const totalHalamanUtama = lampirans.reduce(
    (s, l) => s + (l.jumlahHalaman || 0),
    0,
  );
  const totalHalamanPendukung = lampiransPendukung.reduce(
    (s, l) => s + (l.jumlahTotalLembar || 0),
    0,
  );

  // Rule 5.9: Functional setState in updateStep avoids capturing stale `steps` in closure.
  // Rule 5.7: useCallback so handleGenerate's dependency on updateStep is stable.
  const updateStep = useCallback(
    (id: string, patch: Partial<MergeStep>) =>
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      ),
    [],
  );

  // ── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (sorted.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setIsDone(false);
    setResultUrl(null);
    setProgress(0);
    setStaleChanges([]);
    setIsStaleDismissed(false);

    const initSteps: MergeStep[] = [
      { id: "cover", label: "Membuat halaman cover", status: "loading" },
      {
        id: "batang",
        label: "Menyisipkan batang tubuh",
        status: batangTubuh ? "idle" : "done",
        detail: batangTubuh ? undefined : "Tidak ada file — dilewati",
      },
      {
        id: "daftar",
        label: "Membuat daftar isi lampiran",
        status: "idle",
        detail: `${sorted.length} lampiran`,
      },
      { id: "init", label: "Menyiapkan dokumen gabungan", status: "idle" },
      ...sorted.map((l) => ({
        id: l.id,
        label: `Lampiran ${l.romawiLampiran} — ${l.judulPembatasLampiran}`,
        status: "idle" as StepStatus,
        detail: `${l.jumlahHalaman} halaman`,
      })),
      ...(sortedPendukung.length > 0
        ? [
            {
              id: "__sep__",
              label: "── Lampiran Pendukung ──",
              status: "idle" as StepStatus,
            },
          ]
        : []),
      ...sortedPendukung.map((l) => ({
        id: `pendukung-${l.id}`,
        label: `Pendukung ${l.urutan} — ${l.judul}`,
        status: "idle" as StepStatus,
        detail: `${l.jumlahTotalLembar || "?"} halaman`,
      })),
      { id: "save", label: "Menyimpan PDF akhir", status: "idle" },
    ];
    setSteps(initSteps);

    const totalItems = sorted.length + sortedPendukung.length;

    try {
      const merged = await PDFDocument.create();
      const fontReg = await merged.embedFont(StandardFonts.Helvetica);
      const fontBold = await merged.embedFont(StandardFonts.HelveticaBold);

      // 1. Cover
      await buildCoverPage(merged, jenisLaporan, tahun, nomor, pageSize);
      updateStep("cover", {
        status: "done",
        detail: `${SHORT_LABEL_MAP[jenisLaporan]} · ${pageSize}${nomor ? ` · No. ${nomor}` : " · Nomor kosong"}`,
      });
      setProgress(5);

      // 2. Batang tubuh
      if (batangTubuh) {
        updateStep("batang", { status: "loading" });
        try {
          // Rule 1.4: fetch + arrayBuffer + PDFDocument.load chained — unavoidably sequential
          // (each step depends on the previous), but isolated in its own try/catch.
          const src = await PDFDocument.load(
            await (await fetch(batangTubuh)).arrayBuffer(),
            { ignoreEncryption: true },
          );
          (await merged.copyPages(src, src.getPageIndices())).forEach((p) =>
            merged.addPage(p),
          );
          updateStep("batang", {
            status: "done",
            detail: `${src.getPageCount()} halaman`,
          });
        } catch (err) {
          updateStep("batang", {
            status: "error",
            detail: `Gagal: ${err instanceof Error ? err.message : "unknown"}`,
          });
        }
      }
      setProgress(10);

      // 3. Daftar isi
      updateStep("daftar", { status: "loading" });
      try {
        const entries = buildDaftarIsiEntries(sorted);
        await generateDaftarIsi(jenisLaporan, tahun, nomor, entries, merged);
        updateStep("daftar", {
          status: "done",
          detail: `${entries.length} entri`,
        });
      } catch (err) {
        updateStep("daftar", {
          status: "error",
          detail: `Gagal: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
      setProgress(12);
      updateStep("init", { status: "done" });
      setProgress(14);

      // 4. Lampiran utama — cover pembatas + PDF isi
      for (let i = 0; i < sorted.length; i++) {
        const l = sorted[i];
        updateStep(l.id, { status: "loading" });
        try {
          if (!l.fileUrl) throw new Error("URL tidak ditemukan");

          // Rule 1.4: Start the fetch before building the cover page so the network
          // request overlaps with the synchronous PDF drawing work.
          const fetchPromise = fetch(l.fileUrl).then((r) => r.arrayBuffer());

          buildCoverLampiran(
            merged,
            l,
            jenisLaporan,
            tahun,
            nomor,
            fontReg,
            fontBold,
            pageSize,
          );

          // Now await the already-in-flight fetch result.
          const src = await PDFDocument.load(await fetchPromise, {
            ignoreEncryption: true,
          });
          (await merged.copyPages(src, src.getPageIndices())).forEach((p) =>
            merged.addPage(p),
          );
          updateStep(l.id, {
            status: "done",
            detail: `1 cover + ${l.jumlahHalaman} halaman ✓`,
          });
        } catch (err) {
          updateStep(l.id, {
            status: "error",
            detail: `Gagal: ${err instanceof Error ? err.message : "unknown"}`,
          });
        }
        setProgress(Math.round(14 + ((i + 1) / totalItems) * 72));
      }

      // 5. Lampiran pendukung (append langsung tanpa cover pembatas)
      if (sortedPendukung.length > 0) {
        updateStep("__sep__", { status: "loading" });
        for (let i = 0; i < sortedPendukung.length; i++) {
          const lp = sortedPendukung[i];
          const stepId = `pendukung-${lp.id}`;
          if (i === 0)
            updateStep("__sep__", {
              status: "done",
              detail: `${sortedPendukung.length} dokumen`,
            });
          updateStep(stepId, { status: "loading" });
          try {
            if (!lp.fileUrl) throw new Error("URL tidak ditemukan");
            const src = await PDFDocument.load(
              await (await fetch(lp.fileUrl)).arrayBuffer(),
              { ignoreEncryption: true },
            );
            (await merged.copyPages(src, src.getPageIndices())).forEach((p) =>
              merged.addPage(p),
            );
            updateStep(stepId, {
              status: "done",
              detail: `${src.getPageCount()} halaman ✓`,
            });
          } catch (err) {
            updateStep(stepId, {
              status: "error",
              detail: `Gagal: ${err instanceof Error ? err.message : "unknown"}`,
            });
          }
          setProgress(
            Math.round(14 + ((sorted.length + i + 1) / totalItems) * 72),
          );
        }
      }

      // 6. Simpan
      updateStep("save", { status: "loading" });
      const pdfBytes = await merged.save();
      const blob = new Blob([new Uint8Array(pdfBytes).buffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultSize(formatBytes(blob.size));
      setResultPages(merged.getPageCount());
      updateStep("save", { status: "done" });
      setProgress(100);
      setIsDone(true);
      generatedSnapshotRef.current = currentSnapshot;
    } catch (err) {
      console.error("Generate error:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [sorted, isGenerating, batangTubuh, sortedPendukung, jenisLaporan, tahun, nomor, pageSize, updateStep, currentSnapshot]);

  // Rule 5.7: useCallback — stable reference passed as prop to memoized PreviewModal
  // and download/reset buttons; prevents unnecessary child re-renders.
  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${SHORT_LABEL_MAP[jenisLaporan]}-Gabungan-${pageSize}.pdf`;
    a.click();
  }, [resultUrl, jenisLaporan, pageSize]);

  // Rule 5.7: useCallback — stable reference for reset handler.
  const handleReset = useCallback(() => {
    setSteps([]);
    setIsDone(false);
    setResultUrl(null);
    setResultSize("");
    setResultPages(0);
    setProgress(0);
    generatedSnapshotRef.current = null;
    setStaleChanges([]);
    setIsStaleDismissed(false);
  }, []);

  // Rule 5.1: Derived strings — computed directly during render, no extra state needed.
  const fileName = `${SHORT_LABEL_MAP[jenisLaporan]}-Gabungan-${pageSize}.pdf`;
  const labelPeraturan = LABEL_PERATURAN_MAP[jenisLaporan];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {isPreviewOpen && resultUrl !== null && (
        <PreviewModal
          url={resultUrl}
          onClose={() => setIsPreviewOpen(false)}
          onDownload={handleDownload}
          fileName={fileName}
          resultPages={resultPages}
          resultSize={resultSize}
        />
      )}

      <div className="min-h-[400px] rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* ── HEADER ── */}
        <div className="border-b border-gray-200 px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Generate PDF Gabungan
              </h2>
              <p className="mt-0.5 text-sm text-gray-400">
                Cover + lampiran utama + lampiran pendukung digabung menjadi
                satu file PDF
              </p>
            </div>
            {(lampirans.length > 0 || lampiransPendukung.length > 0) && (
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-400">Lamp. Utama</span>
                  <span className="text-sm font-bold text-gray-700">
                    {lampirans.length}
                  </span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-400">Lamp. Pendukung</span>
                  <span className="text-sm font-bold text-violet-700">
                    {lampiransPendukung.length}
                  </span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-400">Total Halaman</span>
                  <span className="text-sm font-bold text-gray-700">
                    {totalHalamanUtama + totalHalamanPendukung}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 p-8">
          {/* Stale banner */}
          {showStaleBanner && (
            <StaleBanner
              changes={staleChanges}
              onDismiss={() => setIsStaleDismissed(true)}
              onRegenerate={handleReset}
            />
          )}

          {/* Empty state */}
          {lampirans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100">
                <svg
                  className="h-10 w-10 text-gray-300"
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
              <p className="text-base font-medium text-gray-400">
                Belum ada lampiran utama
              </p>
              <p className="mt-1 text-sm text-gray-300">
                Tambahkan lampiran terlebih dahulu di tab Lampiran Utama
              </p>
            </div>
          )}

          {/* ── Konfigurasi + list ── */}
          {lampirans.length > 0 && !isGenerating && !isDone && (
            <div className="space-y-6">
              {/* Info Informasi Umum */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-indigo-500"
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
                  <p className="text-xs font-semibold text-indigo-700">
                    Menggunakan data dari Informasi Umum
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-indigo-400 uppercase">
                      Jenis
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-indigo-800">
                      {SHORT_LABEL_MAP[jenisLaporan]}
                    </p>
                    <p className="text-[11px] leading-snug text-indigo-500">
                      {labelPeraturan}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-indigo-400 uppercase">
                      Tahun
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-indigo-800">
                      {tahun}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-indigo-400 uppercase">
                      Nomor
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-indigo-800">
                      {nomor ? `Nomor ${nomor}` : "—"}
                    </p>
                    {!nomor && (
                      <p className="text-[11px] text-amber-500">
                        Belum diset di Informasi Umum
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Ukuran halaman */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-5">
                <p className="mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Pengaturan Cover
                </p>
                <div className="flex items-center gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Ukuran Halaman
                    </label>
                    <div className="flex rounded-lg border border-gray-200 bg-white p-1">
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <button
                          key={size}
                          onClick={() => setPageSize(size)}
                          className={`rounded-md px-5 py-1.5 text-sm font-medium transition-all ${pageSize === size ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-5 text-xs text-gray-400">
                    Nomor, tahun, dan jenis peraturan diambil otomatis dari
                    Informasi Umum
                  </p>
                </div>
              </div>

              {/* ── Urutan penggabungan ── */}
              <div>
                <p className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Urutan Penggabungan
                </p>
                <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                  {/* Cover */}
                  <div className="flex items-center gap-4 bg-indigo-50/50 px-5 py-3.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      C
                    </div>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                      <svg
                        className="h-4 w-4 text-indigo-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-indigo-800">
                        Cover {labelPeraturan}
                      </p>
                      <p className="text-xs text-indigo-400">
                        {nomor
                          ? `Nomor ${nomor} Tahun ${tahun}`
                          : `Nomor _____ Tahun ${tahun}`}{" "}
                        · {pageSize}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      Cover
                    </span>
                  </div>

                  {/* Batang tubuh */}
                  <div
                    className={`flex items-center gap-4 px-5 py-3.5 ${batangTubuh ? "bg-violet-50/30" : "bg-gray-50/50 opacity-50"}`}
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                      B
                    </div>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100">
                      <svg
                        className="h-4 w-4 text-violet-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Zm6.905 9.97a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72V18a.75.75 0 0 0 1.5 0v-4.19l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${batangTubuh ? "text-violet-800" : "text-gray-400"}`}
                      >
                        Batang Tubuh
                      </p>
                      <p
                        className={`text-xs ${batangTubuh ? "text-violet-400" : "text-gray-300"}`}
                      >
                        {batangTubuh
                          ? "File siap · Tanpa penomoran footer"
                          : "Belum ada file — akan dilewati"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${batangTubuh ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-400"}`}
                    >
                      {batangTubuh ? "Siap" : "Kosong"}
                    </span>
                  </div>

                  {/* Daftar isi */}
                  <div className="flex items-center gap-4 bg-sky-50/50 px-5 py-3.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                      D
                    </div>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-sky-100">
                      <svg
                        className="h-4 w-4 text-sky-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-sky-800">
                        Daftar Isi Lampiran
                      </p>
                      <p className="text-xs text-sky-400">
                        Digenerate otomatis · {sorted.length} lampiran
                        {sorted.some((l) => l.isCALK)
                          ? " (termasuk bab/subbab CALK)"
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                      Otomatis
                    </span>
                  </div>

                  {/* Lampiran utama rows */}
                  {sorted.map((l, idx) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-4 bg-white px-5 py-3.5 transition hover:bg-gray-50"
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                        {idx + 1}
                      </div>
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50">
                        <svg
                          className="h-4 w-4 text-red-400"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {l.judulPembatasLampiran}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {l.namaFileDiStorageLokal}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                          {l.romawiLampiran}
                        </span>
                        {l.isCALK && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                            CALK
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          1 cover + {l.jumlahHalaman} hlm
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* ── Lampiran Pendukung section ── */}
                  {sortedPendukung.length > 0 && (
                    <>
                      {/* Divider label */}
                      <div className="flex items-center gap-3 bg-violet-50/60 px-5 py-2.5">
                        <div className="h-px flex-1 bg-violet-200" />
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-3.5 w-3.5 text-violet-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
                            />
                          </svg>
                          <span className="text-[11px] font-semibold tracking-wider text-violet-500 uppercase">
                            Lampiran Pendukung ({sortedPendukung.length} dokumen
                            · {totalHalamanPendukung} halaman)
                          </span>
                        </div>
                        <div className="h-px flex-1 bg-violet-200" />
                      </div>

                      {/* Tiap lampiran pendukung */}
                      {sortedPendukung.map((l, idx) => (
                        <div
                          key={l.id}
                          className="flex items-center gap-4 bg-violet-50/20 px-5 py-3.5 transition hover:bg-violet-50/50"
                        >
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                            {idx + 1}
                          </div>
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100">
                            <svg
                              className="h-4 w-4 text-violet-500"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-violet-800">
                              {l.judul}
                            </p>
                            <p className="truncate text-xs text-violet-400">
                              {l.namaFileDiStorageLokal}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span className="text-xs text-violet-400">
                              {l.jumlahTotalLembar > 0
                                ? `${l.jumlahTotalLembar} hlm`
                                : "? hlm"}
                            </span>
                            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                              Pendukung
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Tombol generate */}
              <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/40 px-6 py-5">
                <div>
                  <p className="text-sm font-medium text-indigo-800">
                    1 cover
                    {batangTubuh ? " + batang tubuh" : ""}
                    {" + "}
                    {sorted.length} lampiran utama
                    {sortedPendukung.length > 0 ? (
                      <>
                        {" "}
                        +{" "}
                        <span className="text-violet-700">
                          {sortedPendukung.length} lampiran pendukung
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-indigo-500">
                    Cover → Batang Tubuh →{" "}
                    <span className="font-medium text-sky-600">Daftar Isi</span>
                    {" → "}Cover+Lamp I → ... → Cover+Lamp{" "}
                    {sorted[sorted.length - 1]?.romawiLampiran ?? "N"}
                    {sortedPendukung.length > 0 && (
                      <>
                        {" "}
                        →{" "}
                        <span className="font-medium text-violet-600">
                          Pendukung 1 → ... → Pendukung {sortedPendukung.length}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2.5 rounded-xl bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-300 active:scale-95"
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
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  Generate PDF
                </button>
              </div>
            </div>
          )}

          {/* ── Progress ── */}
          {(isGenerating || (isDone && steps.length > 0)) && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{isDone ? "Selesai" : "Sedang memproses..."}</span>
                  <span className="font-semibold text-gray-700">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                {steps.map((step) => {
                  const isSep = step.id === "__sep__";
                  const isPendukung = step.id.startsWith("pendukung-");

                  if (isSep)
                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 bg-violet-50/60 px-5 py-2"
                      >
                        <div className="h-px flex-1 bg-violet-200" />
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-violet-500 uppercase">
                          {step.status === "loading" && (
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
                          )}
                          {step.status === "done" && (
                            <svg
                              className="h-3 w-3 text-violet-500"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m4.5 12.75 6 6 9-13.5"
                              />
                            </svg>
                          )}
                          Lampiran Pendukung
                          {step.detail ? ` · ${step.detail}` : ""}
                        </span>
                        <div className="h-px flex-1 bg-violet-200" />
                      </div>
                    );

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-4 px-5 py-3 ${isPendukung ? "bg-violet-50/20" : ""}`}
                    >
                      <div className="flex-shrink-0">
                        {step.status === "loading" && (
                          <svg
                            className={`h-4 w-4 animate-spin ${isPendukung ? "text-violet-500" : "text-indigo-500"}`}
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
                        )}
                        {step.status === "done" && (
                          <svg
                            className={`h-4 w-4 ${isPendukung ? "text-violet-500" : "text-emerald-500"}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                        )}
                        {step.status === "error" && (
                          <svg
                            className="h-4 w-4 text-red-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                            />
                          </svg>
                        )}
                        {step.status === "idle" && (
                          <div
                            className={`h-4 w-4 rounded-full border-2 ${isPendukung ? "border-violet-200" : "border-gray-200"}`}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            step.status === "error"
                              ? "text-red-500"
                              : step.status === "done"
                                ? isPendukung
                                  ? "text-violet-700"
                                  : "text-gray-700"
                                : step.status === "loading"
                                  ? `font-medium ${isPendukung ? "text-violet-700" : "text-indigo-700"}`
                                  : isPendukung
                                    ? "text-violet-300"
                                    : "text-gray-400"
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.detail && (
                          <p
                            className={`text-xs ${step.status === "error" ? "text-red-400" : isPendukung ? "text-violet-400" : "text-gray-400"}`}
                          >
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hasil */}
              {isDone && resultUrl !== null && (
                <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-4 px-6 py-5">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                      <svg
                        className="h-6 w-6 text-emerald-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-800">
                        PDF Gabungan Siap
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-600">
                        <span>{resultPages} halaman total</span>
                        <span>·</span>
                        <span>{resultSize}</span>
                        <span>·</span>
                        <span>
                          {SHORT_LABEL_MAP[jenisLaporan]} {pageSize}
                        </span>
                        {batangTubuh !== null && (
                          <>
                            <span>·</span>
                            <span>Batang Tubuh</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{sorted.length} lampiran utama</span>
                        {sortedPendukung.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-semibold text-violet-600">
                              {sortedPendukung.length} lampiran pendukung
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-t border-emerald-200 bg-white/60 px-6 py-4">
                    <button
                      onClick={() => setIsPreviewOpen(true)}
                      className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-emerald-300 bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 hover:shadow-md active:scale-95"
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
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                      Preview PDF
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-700 hover:shadow-md active:scale-95"
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
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                      Unduh {fileName}
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
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
                          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                        />
                      </svg>
                      Generate Ulang
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}