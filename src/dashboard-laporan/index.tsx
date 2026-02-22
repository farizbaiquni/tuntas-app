"use client";
import { menusConstants } from "@/app/constants/constants";
import { useState } from "react";
import BatangTubuhContent from "./contents/BatangTubuhContent/BatangTubuhContent";
import LampiranUtamaPage from "./contents/LampiranUtamaContent";

export default function Dashboard() {
  const menus = menusConstants;

  const [activeMenu, setActiveMenu] = useState(menus[0].name);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 border-r border-gray-200 bg-white p-6">
        <div className="mb-10 flex items-center gap-3">
          {/* Logo */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
            T
          </div>

          {/* App Name */}
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
            case "Batang Tubuh":
              return <BatangTubuhContent />;

            case "Lampiran Utama":
              return <LampiranUtamaPage />;

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
