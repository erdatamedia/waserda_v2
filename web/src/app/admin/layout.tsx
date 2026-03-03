"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

type NavItem = { href: string; label: string };
type NavGroup = { key: "produk" | "pegawai" | "laporan" | "kasir"; label: string; items: NavItem[] };

const dashboardNav: NavItem = { href: "/admin", label: "Dashboard" };

const navGroups: NavGroup[] = [
  {
    key: "produk",
    label: "Produk",
    items: [
      { href: "/admin/products", label: "Produk" },
      { href: "/admin/master/categories", label: "Master Kategori" },
      { href: "/admin/stock/in", label: "Stok Masuk" },
      { href: "/admin/stock/adjust", label: "Stok Adjust" },
      { href: "/admin/stock/latest", label: "Histori Stok" },
    ],
  },
  {
    key: "pegawai",
    label: "Pegawai",
    items: [
      { href: "/admin/employees", label: "Pegawai" },
      { href: "/admin/wallet", label: "Saldo Wajib" },
    ],
  },
  {
    key: "laporan",
    label: "Laporan Keuangan",
    items: [{ href: "/admin/reports", label: "Laporan Keuangan" }],
  },
  {
    key: "kasir",
    label: "Kasir",
    items: [{ href: "/admin/cashier", label: "Kasir" }],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<NavGroup["key"], boolean>>({
    produk: true,
    pegawai: true,
    laporan: true,
    kasir: true,
  });
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const sessionName = hydrated
    ? decodeURIComponent(
        document.cookie
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("waserda_name="))
          ?.split("=")[1] ?? "",
      )
    : "";
  const sessionRole = hydrated
    ? document.cookie
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("waserda_role="))
        ?.split("=")[1] ?? ""
    : "";
  const visibleGroups =
    sessionRole === "CASHIER"
      ? navGroups.filter((g) => g.key === "kasir")
      : navGroups;

  function toggleGroup(key: NavGroup["key"]) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function logout() {
    document.cookie = "waserda_role=; path=/; max-age=0";
    document.cookie = "waserda_name=; path=/; max-age=0";
    document.cookie = "waserda_code=; path=/; max-age=0";
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-3 text-gray-900 md:p-4">
      <div className="relative flex min-h-[calc(100dvh-1.5rem)] gap-3 md:min-h-[calc(100dvh-2rem)] md:gap-4">
        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-10 bg-black/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-3 left-3 z-20 w-64 rounded-2xl bg-white ring-1 ring-gray-200 transition md:static md:inset-auto ${
            sidebarOpen
              ? "translate-x-0 opacity-100"
              : "-translate-x-[110%] opacity-0 md:w-0 md:-translate-x-0 md:opacity-100"
          }`}
        >
          {sidebarOpen ? (
            <>
              <div className="border-b border-gray-100 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Waserda
                </div>
                <div className="text-base font-semibold">Admin</div>
              </div>

              <nav className="max-h-[calc(100dvh-170px)] overflow-y-auto p-2">
                <ul className="space-y-2">
                  <li>
                    <Link
                      href={dashboardNav.href}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900 ${
                        pathname === dashboardNav.href
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-700"
                      }`}
                    >
                      {dashboardNav.label}
                    </Link>
                  </li>

                  {visibleGroups.map((group) => (
                    <li key={group.key} className="rounded-lg border border-gray-100">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        <span>Toggle {group.label}</span>
                        <span className="text-xs text-gray-500">
                          {openGroups[group.key] ? "−" : "+"}
                        </span>
                      </button>
                      {openGroups[group.key] ? (
                        <ul className="space-y-1 px-2 pb-2">
                          {group.items.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                className={`block rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900 ${
                                  pathname === item.href
                                    ? "bg-gray-100 text-gray-900"
                                    : "text-gray-700"
                                }`}
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </nav>
            </>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1 space-y-3">
          <header className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {sidebarOpen ? "Sembunyikan Menu" : "Tampilkan Menu"}
              </button>

              <div className="flex items-center gap-2">
                {sessionRole ? (
                  <div className="hidden rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 sm:block">
                    {sessionName || "User"} ({sessionRole})
                  </div>
                ) : null}
                <Link
                  href="/admin/products"
                  className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  + Produk
                </Link>
                <Link
                  href="/admin/cashier"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Kasir
                </Link>
                <button
                  onClick={logout}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-200 md:p-5">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
