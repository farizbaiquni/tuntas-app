"use client";

import { useState, useMemo, memo } from "react";
import {
  DokumenLaporan,
  JenisLaporan,
  StatusDokumenLaporan,
} from "@/app/_types/type";

// ─── Props ────────────────────────────────────────────────────────────────────

interface InformasiUmumProps {
  dokumen: DokumenLaporan;
  onJenisLaporanChange: (jenis: JenisLaporan) => void;
  onTahunChange: (tahun: number) => void;
  onNomorChange: (nomor: number | null) => void;
  onTanggalPengesahanChange: (tanggal: string | null) => void;
  onStatusChange: (status: StatusDokumenLaporan) => void;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const JENIS_LAPORAN_OPTIONS: {
  value: JenisLaporan;
  label: string;
  shortLabel: string;
  group: "Perda" | "Perbup";
  description: string;
  color: string;
  badgeColor: string;
}[] = [
  {
    value: JenisLaporan.RAPERDA,
    label: "Rancangan Peraturan Daerah",
    shortLabel: "RAPERDA",
    group: "Perda",
    description: "Dokumen rancangan sebelum disahkan menjadi Perda",
    color: "border-indigo-200 bg-indigo-50 text-indigo-800",
    badgeColor: "bg-indigo-100 text-indigo-700",
  },
  {
    value: JenisLaporan.PERDA,
    label: "Peraturan Daerah",
    shortLabel: "PERDA",
    group: "Perda",
    description: "Peraturan Daerah yang telah disahkan",
    color: "border-blue-200 bg-blue-50 text-blue-800",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    value: JenisLaporan.SALINAN_PERDA,
    label: "Salinan Peraturan Daerah",
    shortLabel: "SALINAN PERDA",
    group: "Perda",
    description: "Salinan resmi dari Perda yang telah disahkan",
    color: "border-sky-200 bg-sky-50 text-sky-800",
    badgeColor: "bg-sky-100 text-sky-700",
  },
  {
    value: JenisLaporan.RAPERBUP,
    label: "Rancangan Peraturan Bupati",
    shortLabel: "RAPERBUP",
    group: "Perbup",
    description: "Dokumen rancangan sebelum disahkan menjadi Perbup",
    color: "border-violet-200 bg-violet-50 text-violet-800",
    badgeColor: "bg-violet-100 text-violet-700",
  },
  {
    value: JenisLaporan.PERBUP,
    label: "Peraturan Bupati",
    shortLabel: "PERBUP",
    group: "Perbup",
    description: "Peraturan Bupati yang telah disahkan",
    color: "border-purple-200 bg-purple-50 text-purple-800",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    value: JenisLaporan.SALINAN_PERBUP,
    label: "Salinan Peraturan Bupati",
    shortLabel: "SALINAN PERBUP",
    group: "Perbup",
    description: "Salinan resmi dari Perbup yang telah disahkan",
    color: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
    badgeColor: "bg-fuchsia-100 text-fuchsia-700",
  },
];

const STATUS_OPTIONS: {
  value: StatusDokumenLaporan;
  label: string;
  description: string;
  dot: string;
  badge: string;
}[] = [
  {
    value: StatusDokumenLaporan.BELUM_DIBUAT,
    label: "Belum Dibuat",
    description: "Dokumen belum mulai dikerjakan",
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-600",
  },
  {
    value: StatusDokumenLaporan.DRAFT,
    label: "Draft",
    description: "Dokumen sedang dalam proses penyusunan",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    value: StatusDokumenLaporan.DIBUAT,
    label: "Dibuat",
    description: "Dokumen telah selesai dibuat",
    dot: "bg-blue-400",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    value: StatusDokumenLaporan.DIAJUKAN,
    label: "Diajukan",
    description: "Dokumen telah diajukan untuk pengesahan",
    dot: "bg-violet-400",
    badge: "bg-violet-100 text-violet-700",
  },
  {
    value: StatusDokumenLaporan.DISAHKAN,
    label: "Disahkan",
    description: "Dokumen telah mendapatkan pengesahan resmi",
    dot: "bg-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
  },
];

// Rule 7.11: Build Set/Map at module level for O(1) lookups — avoids repeated .find() calls
// inside the render loop.
const JENIS_LAPORAN_MAP = new Map(
  JENIS_LAPORAN_OPTIONS.map((o) => [o.value, o]),
);
const STATUS_MAP = new Map(STATUS_OPTIONS.map((o) => [o.value, o]));

// Rule 7.11: Use Set for O(1) membership checks instead of repeated === comparisons.
const JENIS_NEEDS_NOMOR = new Set<JenisLaporan>([
  JenisLaporan.PERDA,
  JenisLaporan.PERBUP,
  JenisLaporan.SALINAN_PERDA,
  JenisLaporan.SALINAN_PERBUP,
]);

const JENIS_PERDA = new Set<JenisLaporan>([
  JenisLaporan.RAPERDA,
  JenisLaporan.PERDA,
  JenisLaporan.SALINAN_PERDA,
]);

const CURRENT_YEAR = new Date().getFullYear();
// Rule 6.3: Hoist static derived data to module level so it's not recreated on every render.
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 2 + i);

// ─── Helper: format tanggal Indonesia ────────────────────────────────────────

function formatTanggalIndonesia(isoDate: string | null): string {
  // Rule 7.8: Early return for falsy input.
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Rule 5.4: Extract default non-primitive prop value for memoized component to a module-level
// constant so memo() comparison is stable across renders.
const ACCENT_CLASSES = {
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
} as const;

// Rule 5.5: Extract to memoized component so SectionCard only re-renders when its own props change.
const SectionCard = memo(function SectionCard({
  icon,
  title,
  subtitle,
  children,
  accent = "indigo",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: keyof typeof ACCENT_CLASSES;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-gray-100 px-6 py-5">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${ACCENT_CLASSES[accent]}`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {/* Rule 6.8: Explicit conditional rendering. */}
          {subtitle !== undefined && (
            <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InformasiUmumContent({
  dokumen,
  onJenisLaporanChange,
  onTahunChange,
  onNomorChange,
  onTanggalPengesahanChange,
  onStatusChange,
}: InformasiUmumProps) {
  // Rule 5.10: Lazy state initialization — function form so the initial string conversion
  // only runs once on mount.
  const [nomorInput, setNomorInput] = useState<string>(
    () => (dokumen.nomor !== null ? String(dokumen.nomor) : ""),
  );

  // Rule 7.11: O(1) Map lookups instead of .find() O(n) scans on every render.
  const selectedJenis = JENIS_LAPORAN_MAP.get(dokumen.jenisLaporan);
  const selectedStatus = STATUS_MAP.get(dokumen.status);

  // Rule 5.3: Simple boolean expressions with primitive result — do NOT wrap in useMemo.
  const isRaPerNeedNomor = JENIS_NEEDS_NOMOR.has(dokumen.jenisLaporan);
  const isPerda = JENIS_PERDA.has(dokumen.jenisLaporan);

  // Rule 5.3 / 7.6: Combine array iterations in a single pass rather than multiple
  // .reduce()/.some() calls. useMemo is appropriate here since we produce a non-primitive
  // object from an array that may be large — keeps the memo cost low and stable.
  const stats = useMemo(() => {
    let totalHalaman = 0;
    let hasCALK = false;
    for (const l of dokumen.lampirans) {
      totalHalaman += l.jumlahHalaman ?? 0;
      if (l.isCALK) hasCALK = true;
    }
    return {
      totalLampiran: dokumen.lampirans.length,
      totalHalaman,
      hasCALK,
      hasBatangTubuh: dokumen.batangTubuh !== null && dokumen.batangTubuh !== undefined,
    };
  }, [dokumen.lampirans, dokumen.batangTubuh]);

  // Rule 5.7: Interaction logic lives in the event handler, not in an effect.
  const handleNomorBlur = () => {
    const trimmed = nomorInput.trim();
    // Rule 7.8: Early return for the common "cleared" path.
    if (!trimmed) {
      onNomorChange(null);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onNomorChange(parsed);
    } else {
      setNomorInput(dokumen.nomor !== null ? String(dokumen.nomor) : "");
    }
  };

  // Rule 7.12: Use toSorted() for immutability — avoids mutating dokumen.lampirans prop array.
  const sortedLampirans = useMemo(
    () => dokumen.lampirans.toSorted((a, b) => a.urutan - b.urutan),
    [dokumen.lampirans],
  );

  // Pre-compute the current status index once so it's not recalculated inside the render loop.
  // Rule 7.4: Cache repeated function call result.
  const currentStatusIdx = STATUS_OPTIONS.findIndex(
    (o) => o.value === dokumen.status,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Informasi Umum
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Pengaturan dasar dan metadata dokumen laporan
            </p>
          </div>
          {/* Status badge */}
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${selectedStatus?.badge ?? "bg-gray-100 text-gray-600"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${selectedStatus?.dot ?? "bg-gray-400"}`}
            />
            {selectedStatus?.label ?? "—"}
          </div>
        </div>

        {/* ── RINGKASAN DOKUMEN ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Jenis Dokumen",
              value: selectedJenis?.shortLabel ?? "—",
              sub: isPerda ? "Peraturan Daerah" : "Peraturan Bupati",
              icon: (
                <svg
                  className="h-5 w-5 text-indigo-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
                  />
                </svg>
              ),
              color: "bg-indigo-50",
            },
            {
              label: "Tahun",
              value: String(dokumen.tahun),
              sub: "Tahun Anggaran",
              icon: (
                <svg
                  className="h-5 w-5 text-violet-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
              ),
              color: "bg-violet-50",
            },
            {
              label: "Nomor",
              value: dokumen.nomor !== null ? String(dokumen.nomor) : "—",
              sub: isRaPerNeedNomor ? "Wajib diisi" : "Opsional",
              icon: (
                <svg
                  className="h-5 w-5 text-sky-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"
                  />
                </svg>
              ),
              color: "bg-sky-50",
            },
            {
              label: "Total Lampiran",
              value: String(stats.totalLampiran),
              sub: `${stats.totalHalaman} halaman`,
              icon: (
                <svg
                  className="h-5 w-5 text-emerald-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"
                  />
                </svg>
              ),
              color: "bg-emerald-50",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div
                className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}
              >
                {stat.icon}
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-400">
                {stat.label}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-300">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── JENIS LAPORAN ── */}
        <SectionCard
          accent="indigo"
          title="Jenis Laporan"
          subtitle="Pilih jenis dokumen peraturan yang akan dibuat"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          }
        >
          <div className="space-y-4">
            {(["Perda", "Perbup"] as const).map((group) => (
              <div key={group}>
                <p className="mb-2.5 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
                  {group === "Perda" ? "Peraturan Daerah" : "Peraturan Bupati"}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {JENIS_LAPORAN_OPTIONS.filter((o) => o.group === group).map(
                    (opt) => {
                      const isSelected = dokumen.jenisLaporan === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onJenisLaporanChange(opt.value)}
                          className={`relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all duration-150 ${
                            isSelected
                              ? `${opt.color} border-current shadow-sm`
                              : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-white"
                          }`}
                        >
                          {/* Rule 6.8: Explicit conditional rendering. */}
                          {isSelected && (
                            <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-current/15">
                              <svg
                                className="h-3 w-3"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m4.5 12.75 6 6 9-13.5"
                                />
                              </svg>
                            </span>
                          )}
                          <span
                            className={`mb-2 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                              isSelected
                                ? opt.badgeColor
                                : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {opt.shortLabel}
                          </span>
                          <span className="text-xs leading-snug font-medium">
                            {opt.label}
                          </span>
                          <span
                            className={`mt-1 text-[11px] leading-tight ${isSelected ? "opacity-70" : "text-gray-400"}`}
                          >
                            {opt.description}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── NOMOR & TAHUN ── */}
        <SectionCard
          accent="violet"
          title="Nomor & Tahun"
          subtitle="Identitas penomoran dokumen peraturan"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"
              />
            </svg>
          }
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Tahun */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-600">
                Tahun Anggaran
                <span className="ml-1 font-normal text-red-400">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {YEAR_OPTIONS.map((y) => (
                  <button
                    key={y}
                    onClick={() => onTahunChange(y)}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-all ${
                      dokumen.tahun === y
                        ? "border-violet-300 bg-violet-600 text-white shadow-sm shadow-violet-200"
                        : "border-gray-200 bg-white text-gray-600 hover:border-violet-200 hover:bg-violet-50"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Nomor */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-600">
                Nomor Peraturan
                {isRaPerNeedNomor ? (
                  <span className="ml-1 font-normal text-red-400">*</span>
                ) : (
                  <span className="ml-1 font-normal text-gray-400">
                    (opsional)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-400">NOMOR</span>
                <input
                  type="number"
                  min={1}
                  value={nomorInput}
                  onChange={(e) => setNomorInput(e.target.value)}
                  onBlur={handleNomorBlur}
                  placeholder="—"
                  className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-center text-sm font-bold text-gray-800 placeholder-gray-300 focus:border-violet-400 focus:ring-1 focus:ring-violet-300 focus:outline-none"
                />
                <span className="text-sm font-medium text-gray-400">
                  TAHUN {dokumen.tahun}
                </span>
              </div>
              {/* Rule 6.8: Explicit conditional rendering with boolean gate. */}
              {isRaPerNeedNomor && !dokumen.nomor && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-500">
                  <svg
                    className="h-3.5 w-3.5 flex-shrink-0"
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
                  Nomor wajib diisi untuk jenis {selectedJenis?.shortLabel}
                </p>
              )}
              {dokumen.nomor !== null && dokumen.nomor !== undefined && (
                <p className="text-[11px] text-emerald-600">
                  ✓ Nomor {dokumen.nomor} Tahun {dokumen.tahun} sudah diset
                </p>
              )}

              {/* Tanggal Pengesahan */}
              <div className="mt-4 space-y-2">
                <label className="block text-xs font-semibold text-gray-600">
                  Tanggal Pengesahan
                  <span className="ml-1 font-normal text-gray-400">
                    (opsional)
                  </span>
                </label>
                <input
                  type="date"
                  value={dokumen.tanggalPengesahan ?? ""}
                  onChange={(e) =>
                    onTanggalPengesahanChange(e.target.value || null)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-violet-400 focus:ring-1 focus:ring-violet-300 focus:outline-none"
                />
                {dokumen.tanggalPengesahan !== null &&
                  dokumen.tanggalPengesahan !== undefined && (
                    <p className="text-[11px] text-gray-400">
                      {formatTanggalIndonesia(dokumen.tanggalPengesahan)}
                    </p>
                  )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── STATUS DOKUMEN ── */}
        <SectionCard
          accent="emerald"
          title="Status Dokumen"
          subtitle="Tahapan proses penyusunan dokumen saat ini"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          }
        >
          {/* Progress bar visual */}
          <div className="mb-6">
            <div className="relative flex items-center">
              {STATUS_OPTIONS.map((s, i) => {
                // Rule 7.4: Use pre-computed index instead of calling findIndex inside loop.
                const isPast = i <= currentStatusIdx;
                const isActive = i === currentStatusIdx;
                return (
                  <div key={s.value} className="flex flex-1 items-center">
                    <button
                      onClick={() => onStatusChange(s.value)}
                      className="group relative flex flex-col items-center"
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                          isActive
                            ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200"
                            : isPast
                              ? "border-emerald-300 bg-emerald-100 text-emerald-600"
                              : "border-gray-200 bg-white text-gray-300 group-hover:border-gray-300"
                        }`}
                      >
                        {/* Rule 6.8: Explicit conditional rendering. */}
                        {isPast && !isActive ? (
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                        ) : (
                          <span className="text-[10px] font-bold">{i + 1}</span>
                        )}
                      </div>
                      <span
                        className={`absolute top-10 text-[10px] font-medium whitespace-nowrap ${
                          isActive
                            ? "text-emerald-600"
                            : isPast
                              ? "text-gray-500"
                              : "text-gray-300"
                        }`}
                      >
                        {s.label}
                      </span>
                    </button>
                    {i < STATUS_OPTIONS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 transition-all ${
                          // Rule 7.4: Use pre-computed currentStatusIdx instead of calling findIndex again.
                          i < currentStatusIdx ? "bg-emerald-300" : "bg-gray-100"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-5 gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = dokumen.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onStatusChange(opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                    isSelected
                      ? `${opt.badge} border-current shadow-sm`
                      : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-white"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${isSelected ? opt.dot : "bg-gray-300"}`}
                  />
                  <span className="text-[11px] leading-tight font-semibold">
                    {opt.label}
                  </span>
                  <span
                    className={`text-[10px] leading-tight ${isSelected ? "opacity-70" : "text-gray-300"}`}
                  >
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── RINGKASAN KONTEN ── */}
        <SectionCard
          accent="amber"
          title="Ringkasan Konten Dokumen"
          subtitle="Gambaran keseluruhan isi dokumen yang telah dikonfigurasi"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
              />
            </svg>
          }
        >
          <div className="space-y-3">
            {/* Batang Tubuh */}
            <div
              className={`flex items-center gap-4 rounded-xl border p-4 ${
                stats.hasBatangTubuh
                  ? "border-violet-100 bg-violet-50/50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  stats.hasBatangTubuh
                    ? "bg-violet-100 text-violet-600"
                    : "bg-gray-100 text-gray-300"
                }`}
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
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${stats.hasBatangTubuh ? "text-violet-800" : "text-gray-400"}`}
                >
                  Batang Tubuh
                </p>
                <p
                  className={`text-xs ${stats.hasBatangTubuh ? "text-violet-500" : "text-gray-300"}`}
                >
                  {stats.hasBatangTubuh
                    ? "File PDF sudah diunggah"
                    : "Belum ada file — dapat dilewati"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  stats.hasBatangTubuh
                    ? "bg-violet-100 text-violet-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {stats.hasBatangTubuh ? "✓ Siap" : "Kosong"}
              </span>
            </div>

            {/* Lampiran */}
            {/* Rule 6.8: Explicit conditional rendering. */}
            {stats.totalLampiran === 0 ? (
              <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
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
                      d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">
                  Belum ada lampiran — tambahkan di tab Lampiran Utama
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500">
                    {stats.totalLampiran} Lampiran · {stats.totalHalaman}{" "}
                    Halaman Total
                  </p>
                  <div className="flex gap-2">
                    {stats.hasCALK && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        Termasuk CALK
                      </span>
                    )}
                  </div>
                </div>
                {/* Rule 7.12: Use pre-memoized toSorted() result instead of .slice().sort() inline. */}
                {sortedLampirans.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 bg-white px-4 py-3"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
                      {l.romawiLampiran}
                    </span>
                    <p className="flex-1 truncate text-xs text-gray-700">
                      {l.judulPembatasLampiran}
                    </p>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {l.isCALK && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-emerald-200">
                          CALK
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {l.jumlahHalaman} hlm
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── METADATA SISTEM ── */}
        {/*
          Rule 6.5: Prevent Hydration Mismatch Without Flickering.
          Three values here are inherently client-only:
          1. dokumen.id  — UUID generated on the client; server renders a stale/different value.
          2. createdAt / updatedAt formatted with toLocaleString("id-ID") — locale resolution
             differs between Node.js (server) and the browser, producing different strings.
          suppressHydrationWarning tells React to skip the mismatch check on these specific
          leaf nodes and accept the client value without a full tree regeneration.
        */}
        <div className="rounded-2xl border border-gray-100 bg-white/60 px-6 py-5">
          <p className="mb-4 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
            Metadata Sistem
          </p>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-medium text-gray-400">ID Dokumen</p>
              {/* suppressHydrationWarning: UUID always differs between server and client renders */}
              <p
                className="mt-0.5 font-mono break-all text-gray-600"
                suppressHydrationWarning
              >
                {dokumen.id}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-400">Dibuat</p>
              {/* suppressHydrationWarning: toLocaleString("id-ID") output differs between Node.js and browser */}
              <p className="mt-0.5 text-gray-600" suppressHydrationWarning>
                {new Date(dokumen.createdAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-400">Terakhir Diperbarui</p>
              {/* suppressHydrationWarning: same locale mismatch as createdAt */}
              <p className="mt-0.5 text-gray-600" suppressHydrationWarning>
                {new Date(dokumen.updatedAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}