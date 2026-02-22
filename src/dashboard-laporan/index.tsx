"use client";
import { menusConstants } from "@/app/constants/constants";
import { useState, useCallback } from "react";
import LampiranUtamaPage from "./contents/LampiranUtamaContent";
import {
  DokumenLaporan,
  JenisLaporan,
  StatusDokumenLaporan,
  LampiranUtama,
  LampiranPendukung,
  MenuDahboard,
} from "@/app/_types/type";
import BatangTubuhContent from "./contents/BatangTubuhContent/BatangTubuhContent";

// ─── Initial State ────────────────────────────────────────────────────────────

const initialDokumen: DokumenLaporan = {
  id: crypto.randomUUID(),
  jenisLaporan: JenisLaporan.RAPERDA,
  tahun: new Date().getFullYear(),
  nomor: null,
  tanggalPengesahan: null,
  status: StatusDokumenLaporan.BELUM_DIBUAT,
  batangTubuh: null,
  lampirans: [],
  lampiransPendukung: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const menus = menusConstants;

  // ── UI State ──────────────────────────────────────────────────────────────
  const [activeMenu, setActiveMenu] = useState<string>(menus[0].name);
  const [isSaving, setIsSaving] = useState(false);

  // ── Dokumen State ─────────────────────────────────────────────────────────
  const [dokumen, setDokumen] = useState<DokumenLaporan>(initialDokumen);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Update field apapun di root dokumen */
  const updateDokumen = useCallback(
    <K extends keyof DokumenLaporan>(key: K, value: DokumenLaporan[K]) => {
      setDokumen((prev) => ({
        ...prev,
        [key]: value,
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  // ─── Informasi Umum ────────────────────────────────────────────────────────

  const handleJenisLaporanChange = useCallback(
    (jenis: JenisLaporan) => updateDokumen("jenisLaporan", jenis),
    [updateDokumen],
  );

  const handleTahunChange = useCallback(
    (tahun: number) => updateDokumen("tahun", tahun),
    [updateDokumen],
  );

  const handleNomorChange = useCallback(
    (nomor: number | null) => updateDokumen("nomor", nomor),
    [updateDokumen],
  );

  const handleTanggalPengesahanChange = useCallback(
    (tanggal: string | null) => updateDokumen("tanggalPengesahan", tanggal),
    [updateDokumen],
  );

  // ─── Batang Tubuh ──────────────────────────────────────────────────────────

  const handleBatangTubuhChange = useCallback(
    (html: string | null) => updateDokumen("batangTubuh", html),
    [updateDokumen],
  );

  // ─── Lampiran Utama ────────────────────────────────────────────────────────

  const handleAddLampiranUtama = useCallback((lampiran: LampiranUtama) => {
    setDokumen((prev) => ({
      ...prev,
      lampirans: [...prev.lampirans, lampiran],
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleUpdateLampiranUtama = useCallback(
    (id: string, updated: Partial<LampiranUtama>) => {
      setDokumen((prev) => ({
        ...prev,
        lampirans: prev.lampirans.map((l) =>
          l.id === id ? { ...l, ...updated } : l,
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const handleRemoveLampiranUtama = useCallback((id: string) => {
    setDokumen((prev) => ({
      ...prev,
      lampirans: prev.lampirans
        .filter((l) => l.id !== id)
        .map((l, i) => ({ ...l, urutan: i + 1 })), // reindex urutan
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleReorderLampiranUtama = useCallback(
    (reordered: LampiranUtama[]) => {
      setDokumen((prev) => ({
        ...prev,
        lampirans: reordered.map((l, i) => ({ ...l, urutan: i + 1 })),
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  // ─── Lampiran Pendukung ────────────────────────────────────────────────────

  const handleAddLampiranPendukung = useCallback(
    (lampiran: LampiranPendukung) => {
      setDokumen((prev) => ({
        ...prev,
        lampiransPendukung: [...prev.lampiransPendukung, lampiran],
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const handleUpdateLampiranPendukung = useCallback(
    (id: string, updated: Partial<LampiranPendukung>) => {
      setDokumen((prev) => ({
        ...prev,
        lampiransPendukung: prev.lampiransPendukung.map((l) =>
          l.id === id ? { ...l, ...updated } : l,
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const handleRemoveLampiranPendukung = useCallback((id: string) => {
    setDokumen((prev) => ({
      ...prev,
      lampiransPendukung: prev.lampiransPendukung
        .filter((l) => l.id !== id)
        .map((l, i) => ({ ...l, urutan: i + 1 })),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // ─── Status & Global Actions ───────────────────────────────────────────────

  const handleStatusChange = useCallback(
    (status: StatusDokumenLaporan) => updateDokumen("status", status),
    [updateDokumen],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // TODO: ganti dengan API call Anda
      console.log("Saving dokumen:", dokumen);
      await new Promise((r) => setTimeout(r, 1000)); // simulasi async
    } finally {
      setIsSaving(false);
    }
  }, [dokumen]);

  const handleReset = useCallback(() => {
    setDokumen({
      ...initialDokumen,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 border-r border-gray-200 bg-white p-6">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
            T
          </div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            Tuntas App
          </h2>
        </div>

        <ul className="space-y-2">
          {menus.map((menu) => (
            <li
              key={menu.name}
              onClick={() => setActiveMenu(menu.name)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeMenu === menu.name
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {menu.icon}
              <span>{menu.name}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex-1 bg-gray-50 p-8">
        {(() => {
          switch (activeMenu) {
            case MenuDahboard.BATANG_TUBUH:
              return (
                <BatangTubuhContent
                  value={dokumen.batangTubuh}
                  onChange={handleBatangTubuhChange}
                />
              );

            case MenuDahboard.LAMPIRAN_UTAMA:
              return (
                <LampiranUtamaPage
                  lampirans={dokumen.lampirans}
                  onAdd={handleAddLampiranUtama}
                  onUpdate={handleUpdateLampiranUtama}
                  onRemove={handleRemoveLampiranUtama}
                  onReorder={handleReorderLampiranUtama}
                />
              );

            case MenuDahboard.LAMPIRAN_PENDUKUNG:
              return (
                // <LampiranPendukungPage
                //   lampiransPendukung={dokumen.lampiransPendukung}
                //   onAdd={handleAddLampiranPendukung}
                //   onUpdate={handleUpdateLampiranPendukung}
                //   onRemove={handleRemoveLampiranPendukung}
                // />
                <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                  <p className="text-sm text-gray-500">
                    Lampiran Pendukung — coming soon
                  </p>
                </div>
              );

            case MenuDahboard.GENERATE:
              return (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                  <h1 className="mb-4 text-xl font-semibold text-gray-800">
                    Generate Dokumen
                  </h1>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSaving ? "Menyimpan..." : "Simpan & Generate"}
                  </button>
                </div>
              );

            default:
              return (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                  <h1 className="mb-3 text-xl font-semibold text-gray-800">
                    {activeMenu}
                  </h1>
                  <p className="text-sm text-gray-500">
                    Konten untuk menu {activeMenu} akan ditampilkan di sini.
                  </p>
                </div>
              );
          }
        })()}
      </main>
    </div>
  );
}
