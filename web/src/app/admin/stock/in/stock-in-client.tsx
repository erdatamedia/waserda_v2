"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";

type StockInResult = {
  ok: true;
  productId: string;
  stockBefore: number;
  stockAfter: number;
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function toDigits(raw: string) {
  return raw.replace(/\D/g, "");
}

function formatNumericInput(raw: string) {
  const digits = toDigits(raw);
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

function parseNumericInput(raw: string): number | null {
  const digits = toDigits(raw);
  if (!digits) return null;
  return Number(digits);
}

async function apiSend<T>(path: string, method: "POST", body: unknown): Promise<T> {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = "Request failed";
    try {
      const data = (await res.json()) as { message?: unknown };
      msg = typeof data?.message === "string" ? data.message : JSON.stringify(data?.message ?? data);
    } catch {
      try {
        msg = await res.text();
      } catch {
        // ignore
      }
    }
    throw new Error(msg);
  }

  return (await res.json()) as T;
}

export default function StockInClient({ products }: { products: Product[] }) {
  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const [productId, setProductId] = useState<string>(activeProducts[0]?.id ?? "");
  const [qtyInput, setQtyInput] = useState("");
  const [note, setNote] = useState<string>("Restock dari supplier");
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  async function submit() {
    const qty = parseNumericInput(qtyInput);
    if (!productId) return alert("Pilih produk dulu");
    if (qty === null || !Number.isInteger(qty) || qty <= 0) return alert("Qty wajib diisi");

    setLoading(true);
    try {
      const res = await apiSend<StockInResult>("/stock/in", "POST", {
        productId,
        qty,
        note: note.trim() || undefined,
      });

      alert(`Berhasil stok masuk.\nStok: ${res.stockBefore} → ${res.stockAfter}`);
      window.location.reload();
    } catch (e: unknown) {
      alert(`Gagal stok masuk: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Stok Masuk</h1>
        <p className="text-sm text-gray-500">Tambah stok produk (IN)</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Produk</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — stok {p.stock} ({p.id})
              </option>
            ))}
          </select>
          {selected && (
            <div className="mt-1 text-xs text-gray-500">
              Stok saat ini: <span className="font-semibold">{selected.stock}</span>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Qty</label>
            <input
              value={formatNumericInput(qtyInput)}
              onChange={(e) => setQtyInput(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Catatan</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Restock dari supplier"
            />
          </div>
        </div>

        <button
          disabled={loading}
          onClick={submit}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : "Simpan Stok Masuk"}
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Endpoint: <span className="font-mono">POST /stock/in</span>
      </div>
    </div>
  );
}
