"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type { Product } from "@/lib/types";

type EmployeeBalance = {
  employee: { id: string; name: string; employeeCode: string };
  walletBalance: number;
  debtBalance: number;
};

type SaleResponse = {
  saleId: string;
  buyerType: "EMPLOYEE" | "GENERAL";
  employee?: { id: string; name: string; employeeCode: string };
  total: number;
  cashPaid: number;
  change: number;
  paidByMandatory: number;
  addedDebt: number;
};

type CartRow = { productId: string; qty: number };

type CategoryKey = "ALL" | string;

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function toDigits(raw: string) {
  return raw.replace(/\D/g, "");
}

function formatMoneyInput(raw: string) {
  const digits = toDigits(raw);
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

function parseMoneyInput(raw: string): number {
  const digits = toDigits(raw);
  if (!digits) return 0;
  return Number(digits);
}

export default function CashierClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("ALL");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({
    DOG_FOOD: "Kategori A",
    CAT_FOOD: "Kategori B",
    OTHER: "Lainnya",
  });
  const [categoryTabs, setCategoryTabs] = useState<string[]>([
    "DOG_FOOD",
    "CAT_FOOD",
    "OTHER",
  ]);
  const [page, setPage] = useState(1);
  const [scanMode, setScanMode] = useState<"product" | "employee" | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [buyerType, setBuyerType] = useState<"EMPLOYEE" | "GENERAL">(
    "EMPLOYEE",
  );
  const [employeeCode, setEmployeeCode] = useState("");
  const [cashPaidInput, setCashPaidInput] = useState("");
  const [note, setNote] = useState("");

  const [cart, setCart] = useState<CartRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SaleResponse | null>(null);

  const [balance, setBalance] = useState<EmployeeBalance | null>(null);
  const [balanceErr, setBalanceErr] = useState<string | null>(null);

  function extractEmployeeCode(raw: string): string {
    const text = raw.trim();
    if (!text) return "";

    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const code = obj.employeeCode ?? obj.code ?? obj.employee_code;
      if (typeof code === "string" && code.trim()) return code.trim();
    } catch {
      // fallback plain text
    }

    try {
      const url = new URL(text);
      const q = url.searchParams.get("employeeCode") || url.searchParams.get("code");
      if (q) return q.trim();
    } catch {
      // not URL
    }

    return text;
  }

  useEffect(() => {
    (async () => {
      try {
        const ps = await apiGet<Product[]>("/stock/products?all=false");
        setProducts(ps.filter((p) => p.isActive));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal load produk");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rows = await apiGet<
          Array<{ code: Product["category"]; name: string; isActive: boolean }>
        >("/master/categories");
        const map: Record<string, string> = {
          DOG_FOOD: "Kategori A",
          CAT_FOOD: "Kategori B",
          OTHER: "Lainnya",
        };
        const activeTabs = rows.filter((x) => x.isActive).map((x) => x.code);
        for (const row of rows) map[row.code] = row.name;
        setCategoryTabs(activeTabs.length > 0 ? activeTabs : ["OTHER"]);
        setCategoryNames(map);
      } catch {
        // keep defaults
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBalance(null);
      setBalanceErr(null);

      if (buyerType !== "EMPLOYEE") return;
      const code = employeeCode.trim();
      if (code.length < 3) return;

      try {
        const b = await apiGet<EmployeeBalance>(
          `/cashier/employee-balance?employeeCode=${encodeURIComponent(code)}`,
        );
        if (!cancelled) setBalance(b);
      } catch (e) {
        if (!cancelled) {
          setBalanceErr(
            e instanceof Error ? e.message : "Gagal load saldo pegawai",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buyerType, employeeCode]);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((p) => {
      const matchQuery =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q);
      const matchCategory =
        selectedCategory === "ALL" || p.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [products, search, selectedCategory]);

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const cartDetails = useMemo(() => {
    return cart
      .map((row) => {
        const product = productMap.get(row.productId);
        if (!product) return null;
        const base = product.price * row.qty;
        const discount = Math.trunc((base * (product.discountPct ?? 0)) / 100);
        const taxable = base - discount;
        const tax = Math.trunc((taxable * (product.taxPct ?? 0)) / 100);
        return {
          ...row,
          product,
          base,
          discount,
          tax,
          subtotal: taxable + tax,
        };
      })
      .filter(
        (
          x,
        ): x is {
          productId: string;
          qty: number;
          product: Product;
          base: number;
          discount: number;
          tax: number;
          subtotal: number;
        } => Boolean(x),
      );
  }, [cart, productMap]);

  const subtotal = useMemo(
    () => cartDetails.reduce((sum, row) => sum + row.base, 0),
    [cartDetails],
  );

  const discount = useMemo(
    () => cartDetails.reduce((sum, row) => sum + row.discount, 0),
    [cartDetails],
  );
  const tax = useMemo(
    () => cartDetails.reduce((sum, row) => sum + row.tax, 0),
    [cartDetails],
  );
  const total = subtotal - discount + tax;

  function stopScanner() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setScanMode(null);
  }

  function findProductByBarcode(code: string): Product | undefined {
    const normalized = code.trim();
    if (!normalized) return undefined;
    return products.find((p) => (p.barcode ?? "").trim() === normalized);
  }

  function applyScanResult(raw: string, mode: "product" | "employee") {
    if (mode === "employee") {
      const code = extractEmployeeCode(raw);
      if (!code) {
        setErr("QR pegawai tidak valid");
        return;
      }
      setBuyerType("EMPLOYEE");
      setEmployeeCode(code);
      setErr(null);
      return;
    }

    const code = raw.trim();
    const found = findProductByBarcode(code);
    if (found) {
      setErr(null);
      addToCart(found.id);
      setSearch(found.barcode ?? found.name);
      return;
    }
    setSearch(code);
    setErr(`Barcode ${code} tidak ditemukan`);
  }

  async function startScanner(mode: "product" | "employee") {
    setScanError(null);
    const Detector = (window as unknown as { BarcodeDetector?: unknown })
      .BarcodeDetector as
      | (new (opts?: { formats?: string[] }) => {
          detect: (input: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
        })
      | undefined;

    if (!navigator.mediaDevices?.getUserMedia || !Detector) {
      const manual = window.prompt(
        mode === "employee"
          ? "Scanner tidak didukung. Tempel QR/data employee code:"
          : "Scanner tidak didukung. Masukkan barcode:",
      );
      if (manual) {
        applyScanResult(manual, mode);
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setScanMode(mode);

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
      });

      const loop = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const value = results[0]?.rawValue?.trim();
          if (value) {
            applyScanResult(value, mode);
            stopScanner();
            return;
          }
        } catch {
          // ignore frame-level failures
        }
        rafRef.current = requestAnimationFrame(() => {
          void loop();
        });
      };

      await loop();
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
      stopScanner();
    }
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  function addToCart(productId: string) {
    const product = productMap.get(productId);
    if (!product) return;

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.productId === productId);
      if (idx >= 0) {
        const nextQty = prev[idx].qty + 1;
        if (nextQty > product.stock) {
          setErr(`Stok ${product.name} tidak mencukupi`);
          return prev;
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: nextQty };
        return copy;
      }

      if (product.stock < 1) {
        setErr(`Stok ${product.name} habis`);
        return prev;
      }

      return [...prev, { productId, qty: 1 }];
    });
  }

  function removeRow(productId: string) {
    setCart((prev) => prev.filter((x) => x.productId !== productId));
  }

  function updateQty(productId: string, qty: number) {
    const p = productMap.get(productId);
    if (!p) return;
    if (!Number.isInteger(qty) || qty <= 0) return;

    const clampedQty = Math.min(qty, p.stock);
    setCart((prev) =>
      prev.map((x) => (x.productId === productId ? { ...x, qty: clampedQty } : x)),
    );
  }

  async function submit() {
    setErr(null);
    setResult(null);

    const cashPaid = parseMoneyInput(cashPaidInput);

    if (cart.length === 0) {
      setErr("Keranjang masih kosong");
      return;
    }

    if (!Number.isInteger(cashPaid) || cashPaid < 0) {
      setErr("Cash paid harus bilangan bulat >= 0");
      return;
    }

    if (buyerType === "GENERAL") {
      if (cashPaid < total) {
        setErr("Pembeli umum harus lunas (cashPaid >= total)");
        return;
      }
    } else if (employeeCode.trim().length < 3) {
      setErr("Employee code minimal 3 karakter");
      return;
    }

    setLoading(true);
    try {
      const payload =
        buyerType === "GENERAL"
          ? {
              buyerType,
              cashPaid,
              items: cart,
              note: note.trim() || undefined,
            }
          : {
              buyerType,
              employeeCode: employeeCode.trim(),
              cashPaid,
              items: cart,
              note: note.trim() || undefined,
            };

      const res = await apiSend<SaleResponse>("/cashier/sale", "POST", payload);
      setResult(res);

      setCart([]);
      setNote("");
      setCashPaidInput("");

      if (buyerType === "EMPLOYEE") {
        try {
          const b = await apiGet<EmployeeBalance>(
            `/cashier/employee-balance?employeeCode=${encodeURIComponent(employeeCode.trim())}`,
          );
          setBalance(b);
          setBalanceErr(null);
        } catch {
          // keep last balance when refresh fails
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal submit transaksi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-100 p-3 md:p-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Waserda POS</h1>
              <p className="text-sm text-gray-500">Kasir cepat untuk transaksi harian toko.</p>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm md:w-72"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const found = findProductByBarcode(search);
                if (found) {
                  e.preventDefault();
                  setErr(null);
                  addToCart(found.id);
                }
              }}
            />
            <button
              onClick={() => void startScanner("product")}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Scan Barcode
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(["ALL", ...categoryTabs] as CategoryKey[]).map(
              (k) => (
              <button
                key={k}
                onClick={() => setSelectedCategory(k)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedCategory === k
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="font-semibold">
                  {k === "ALL" ? "Semua" : categoryNames[k]}
                </div>
                <div
                  className={`text-xs ${selectedCategory === k ? "text-blue-100" : "text-gray-500"}`}
                >
                  {k === "ALL"
                    ? `${products.length} item`
                    : `${products.filter((p) => p.category === k).length} item`}
                </div>
              </button>
              ),
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {pageItems.map((p) => {
              const inCart = cart.find((c) => c.productId === p.id)?.qty ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setErr(null);
                    addToCart(p.id);
                  }}
                  className="group rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <div
                    className="mb-3 h-28 rounded-xl bg-gray-100 bg-cover bg-center ring-1 ring-gray-100"
                    style={{
                      backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : "none",
                    }}
                  >
                    {!p.imageUrl ? (
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">
                        No Image
                      </div>
                    ) : null}
                  </div>
                  <div className="line-clamp-2 min-h-12 text-sm font-semibold leading-5 text-gray-900">
                    {p.name}
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <div className="text-xl font-semibold text-blue-700">
                        Rp {formatRp(p.price)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {categoryNames[p.category]} • stok {p.stock}
                      </div>
                      <div className="text-xs text-gray-500">
                        diskon {p.discountPct}% • pajak {p.taxPct}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white group-hover:bg-blue-600">
                      + Tambah
                    </div>
                  </div>
                  {inCart > 0 && (
                    <div className="mt-2 text-xs font-medium text-blue-700">
                      Di keranjang: {inCart}
                    </div>
                  )}
                </button>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Produk tidak ditemukan.
              </div>
            )}
          </div>

          {filteredProducts.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-600">
                Halaman {page} dari {totalPages} • {filteredProducts.length} produk
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Current Order</h2>
            <div className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
              {cartDetails.length} item
            </div>
          </div>

          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {cartDetails.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                Belum ada item di keranjang.
              </div>
            ) : (
              cartDetails.map((row) => (
                <div
                  key={row.productId}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="line-clamp-2 text-sm font-medium text-gray-900">{row.product.name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Rp {formatRp(row.product.price)}</span>
                    <button
                      onClick={() => removeRow(row.productId)}
                      className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
                      <button
                        onClick={() => updateQty(row.productId, row.qty - 1)}
                        className="px-2 py-1 text-sm text-gray-700"
                      >
                        -
                      </button>
                      <input
                        value={row.qty}
                        onChange={(e) => updateQty(row.productId, Number(e.target.value))}
                        className="w-12 border-x border-gray-200 bg-white py-1 text-center text-sm"
                        type="number"
                        min={1}
                        max={row.product.stock}
                      />
                      <button
                        onClick={() => updateQty(row.productId, row.qty + 1)}
                        className="px-2 py-1 text-sm text-gray-700"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-sm font-semibold">Rp {formatRp(row.subtotal)}</div>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Diskon {row.product.discountPct}% • Pajak {row.product.taxPct}%
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>Rp {formatRp(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Discount</span>
              <span>Rp {formatRp(discount)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>Rp {formatRp(tax)}</span>
            </div>
            <div className="mt-1 border-t border-dashed border-gray-300 pt-2 text-lg font-semibold">
              <div className="flex justify-between">
                <span>Total</span>
                <span>Rp {formatRp(total)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => {
                  setBuyerType("EMPLOYEE");
                  setResult(null);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  buyerType === "EMPLOYEE"
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 bg-white text-gray-700"
                }`}
              >
                Pegawai
              </button>
              <button
                onClick={() => {
                  setBuyerType("GENERAL");
                  setEmployeeCode("");
                  setBalance(null);
                  setBalanceErr(null);
                  setResult(null);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  buyerType === "GENERAL"
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 bg-white text-gray-700"
                }`}
              >
                Umum
              </button>
            </div>

            {buyerType === "EMPLOYEE" && (
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Employee code"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                />
                <button
                  onClick={() => void startScanner("employee")}
                  className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50"
                >
                  Scan QR
                </button>
              </div>
            )}

            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              inputMode="numeric"
              value={formatMoneyInput(cashPaidInput)}
              onChange={(e) => setCashPaidInput(e.target.value)}
              placeholder="Bayar tunai"
            />

            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (opsional)"
            />

            {buyerType === "EMPLOYEE" && (
              <div className="rounded-lg bg-gray-50 p-2 text-xs">
                {balance ? (
                  <div className="space-y-0.5 text-gray-700">
                    <div className="font-medium">
                      {balance.employee.name} ({balance.employee.employeeCode})
                    </div>
                    <div>Saldo wajib: Rp {formatRp(balance.walletBalance)}</div>
                    <div>Hutang: Rp {formatRp(balance.debtBalance)}</div>
                  </div>
                ) : balanceErr ? (
                  <div className="text-red-600">{balanceErr}</div>
                ) : (
                  <div className="text-gray-500">Masukkan employee code.</div>
                )}
              </div>
            )}

          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {err}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-800">
              <div className="font-semibold">Transaksi berhasil</div>
              <div>Sale ID: {result.saleId}</div>
              <div>Total: Rp {formatRp(result.total)}</div>
              <div>Tunai: Rp {formatRp(result.cashPaid)}</div>
              <div>Kembalian: Rp {formatRp(result.change)}</div>
              <div>Potong saldo: Rp {formatRp(result.paidByMandatory)}</div>
              <div>Hutang bertambah: Rp {formatRp(result.addedDebt)}</div>
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Submit Transaksi"}
          </button>
        </aside>
      </div>

      {scanMode ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">
                {scanMode === "employee" ? "Scanner QR Pegawai" : "Scanner Barcode"}
              </div>
              <button
                onClick={stopScanner}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
              >
                Tutup
              </button>
            </div>
            <video ref={videoRef} className="h-64 w-full rounded-xl bg-black object-cover" />
            <div className="mt-2 text-xs text-gray-500">
              {scanMode === "employee"
                ? "Arahkan kamera ke QR di HP pegawai."
                : "Arahkan kamera ke barcode produk."}
            </div>
          </div>
        </div>
      ) : null}

      {scanError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Scanner: {scanError}
        </div>
      ) : null}
    </div>
  );
}
