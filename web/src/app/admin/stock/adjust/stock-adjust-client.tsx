"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";

type StockAdjustResult = {
  ok: true;
  productId: string;
  stockBefore: number;
  stockAfter: number;
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function normalizeSignedIntegerInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const isNegative = trimmed.startsWith("-");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return isNegative ? "-" : "";
  const formatted = new Intl.NumberFormat("id-ID").format(Number(digits));
  return isNegative ? `-${formatted}` : formatted;
}

function parseSignedIntegerInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return null;
  const isNegative = trimmed.startsWith("-");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return isNegative ? -value : value;
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

export default function StockAdjustClient({ products }: { products: Product[] }) {
  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const [productId, setProductId] = useState<string>(activeProducts[0]?.id ?? "");
  const [qtyInput, setQtyInput] = useState("");
  const [note, setNote] = useState<string>("Barang rusak");
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  async function submit() {
    const qty = parseSignedIntegerInput(qtyInput);
    if (!productId) return alert("Pilih produk dulu");
    if (qty === null || !Number.isInteger(qty) || qty === 0) return alert("Qty wajib diisi");
    if (!note.trim() || note.trim().length < 3) return alert("Note minimal 3 karakter");

    setLoading(true);
    try {
      const res = await apiSend<StockAdjustResult>("/stock/adjust", "POST", {
        productId,
        qty,
        note: note.trim(),
      });

      alert(`Berhasil adjust.\nStok: ${res.stockBefore} → ${res.stockAfter}`);
      window.location.reload();
    } catch (e: unknown) {
      alert(`Gagal adjust: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Stok Adjust</h1>
        <p className="text-sm text-gray-500">Penyesuaian stok (+/-) manual</p>
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
            <label className="mb-1 block text-xs text-gray-600">
              Qty (boleh minus / plus)
            </label>
            <input
              value={normalizeSignedIntegerInput(qtyInput)}
              onChange={(e) => setQtyInput(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="-2 atau 5"
            />
            <div className="mt-1 text-xs text-gray-500">
              Contoh: <span className="font-mono">-2</span> (rusak/hilang),{" "}
              <span className="font-mono">+5</span> (koreksi stok)
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Catatan</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Barang rusak / selisih stok / dll"
            />
          </div>
        </div>

        <button
          disabled={loading}
          onClick={submit}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : "Simpan Adjust"}
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Endpoint: <span className="font-mono">POST /stock/adjust</span>
      </div>
    </div>
  );
}
