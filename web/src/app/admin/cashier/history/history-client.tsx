"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type { Product } from "@/lib/types";

type SaleRow = {
  id: string;
  buyerType: "EMPLOYEE" | "GENERAL";
  total: number;
  cashPaid: number;
  paidByMandatory: number;
  addedDebt: number;
  note: string | null;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
  } | null;
  itemCount: number;
};

type SaleListResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: SaleRow[];
};

type SaleDetail = {
  id: string;
  buyerType: "EMPLOYEE" | "GENERAL";
  total: number;
  cashPaid: number;
  paidByMandatory: number;
  addedDebt: number;
  note: string | null;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    qty: number;
    price: number;
    product: {
      id: string;
      name: string;
      barcode: string | null;
      category: string;
    };
  }>;
  linkedTxns: Array<{
    id: string;
    type: string;
    amount: number;
    note: string | null;
    createdAt: string;
  }>;
};

type EditItem = { productId: string; qty: number };

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

function parseMoneyInput(raw: string): number | null {
  const digits = toDigits(raw);
  if (!digits) return null;
  return Number(digits);
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function HistoryClient() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [selected, setSelected] = useState<SaleDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [editBuyerType, setEditBuyerType] = useState<"EMPLOYEE" | "GENERAL">(
    "EMPLOYEE",
  );
  const [editEmployeeCode, setEditEmployeeCode] = useState("");
  const [editUseWallet, setEditUseWallet] = useState(true);
  const [editCashPaidInput, setEditCashPaidInput] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.id, r.employee?.name ?? "", r.employee?.employeeCode ?? "", r.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [rows, q]);

  async function loadSales(targetPage = page) {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiGet<SaleListResponse>(
        `/cashier/sales?page=${targetPage}&pageSize=20`,
      );
      setRows(res.rows);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (e) {
      setLoadError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const ps = await apiGet<Product[]>("/stock/products?all=true");
      setProducts(ps);
    } catch {
      // optional for edit
    }
  }

  useEffect(() => {
    void loadSales(1);
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(saleId: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const d = await apiGet<SaleDetail>(`/cashier/sales/${saleId}`);
      setSelected(d);
    } catch (e) {
      alert(`Gagal memuat detail: ${errMsg(e)}`);
      setDetailOpen(false);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function openEditById(saleId: string) {
    try {
      const d = await apiGet<SaleDetail>(`/cashier/sales/${saleId}`);
      setSelected(d);
      startEdit(d);
    } catch (e) {
      alert(`Gagal memuat detail untuk edit: ${errMsg(e)}`);
    }
  }

  function startEdit(detail: SaleDetail) {
    setEditSaleId(detail.id);
    setEditBuyerType(detail.buyerType);
    setEditEmployeeCode(detail.employee?.employeeCode ?? "");
    setEditUseWallet(true);
    setEditCashPaidInput(String(detail.cashPaid));
    setEditNote(detail.note ?? "");
    setEditItems(detail.items.map((x) => ({ productId: x.productId, qty: x.qty })));
    setEditOpen(true);
  }

  function updateEditItem(index: number, patch: Partial<EditItem>) {
    setEditItems((prev) =>
      prev.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    );
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addEditItem() {
    if (products.length === 0) return;
    setEditItems((prev) => [...prev, { productId: products[0].id, qty: 1 }]);
  }

  async function submitEdit() {
    if (!editSaleId) return;
    const cashPaid = parseMoneyInput(editCashPaidInput);
    if (cashPaid === null) return alert("Cash paid wajib diisi");
    if (editBuyerType === "EMPLOYEE" && editEmployeeCode.trim().length < 3) {
      return alert("Employee code minimal 3 karakter");
    }
    if (editItems.length === 0) return alert("Item transaksi tidak boleh kosong");
    if (editItems.some((x) => !x.productId || !Number.isInteger(x.qty) || x.qty <= 0)) {
      return alert("Item transaksi tidak valid");
    }

    setSaving(true);
    try {
      await apiSend(`/cashier/sales/${editSaleId}`, "PATCH", {
        buyerType: editBuyerType,
        employeeCode:
          editBuyerType === "EMPLOYEE" ? editEmployeeCode.trim() : undefined,
        useWallet: editBuyerType === "EMPLOYEE" ? editUseWallet : undefined,
        cashPaid,
        note: editNote.trim() || undefined,
        items: editItems,
      });
      setEditOpen(false);
      setSelected(null);
      await loadSales(page);
      alert("Transaksi berhasil diupdate");
    } catch (e) {
      alert(`Gagal update transaksi: ${errMsg(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeSale(saleId: string) {
    const ok = window.confirm(
      "Yakin hapus transaksi ini? Stok dan ledger saldo/hutang akan direstore.",
    );
    if (!ok) return;

    try {
      await apiSend(`/cashier/sales/${saleId}`, "DELETE");
      await loadSales(page);
      if (selected?.id === saleId) {
        setSelected(null);
        setDetailOpen(false);
      }
      alert("Transaksi berhasil dihapus");
    } catch (e) {
      alert(`Gagal hapus transaksi: ${errMsg(e)}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari sale id / pegawai / catatan..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm md:w-96"
        />
        <button
          onClick={() => void loadSales(page)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat riwayat transaksi: {loadError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-700">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Sale ID</th>
              <th className="px-4 py-3">Pembeli</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Tidak ada data transaksi.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {new Date(r.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-3">
                    {r.buyerType === "GENERAL"
                      ? "Umum"
                      : `${r.employee?.name ?? "-"} (${r.employee?.employeeCode ?? "-"})`}
                  </td>
                  <td className="px-4 py-3">{r.itemCount}</td>
                  <td className="px-4 py-3 font-semibold">Rp {formatRp(r.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void openDetail(r.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => void openEditById(r.id)}
                        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void removeSale(r.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
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

      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-xs text-gray-600">
          Halaman {page} dari {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void loadSales(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <button
            onClick={() => void loadSales(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Berikutnya
          </button>
        </div>
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Detail Transaksi</h3>
              <button
                onClick={() => {
                  setDetailOpen(false);
                  setSelected(null);
                }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
              >
                Tutup
              </button>
            </div>

            {detailLoading || !selected ? (
              <div className="text-sm text-gray-500">Memuat detail...</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">Sale ID</div>
                    <div className="font-mono text-xs">{selected.id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Buyer</div>
                    <div className="text-sm">
                      {selected.buyerType === "GENERAL"
                        ? "Umum"
                        : `${selected.employee?.name ?? "-"} (${selected.employee?.employeeCode ?? "-"})`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Tanggal</div>
                    <div className="text-sm">
                      {new Date(selected.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Produk</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Harga</th>
                        <th className="px-3 py-2 text-left">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((it) => (
                        <tr key={it.id} className="border-t border-gray-100">
                          <td className="px-3 py-2">{it.product.name}</td>
                          <td className="px-3 py-2">{it.qty}</td>
                          <td className="px-3 py-2">Rp {formatRp(it.price)}</td>
                          <td className="px-3 py-2">Rp {formatRp(it.price * it.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div>Total: Rp {formatRp(selected.total)}</div>
                  <div>Cash: Rp {formatRp(selected.cashPaid)}</div>
                  <div>Potong Saldo: Rp {formatRp(selected.paidByMandatory)}</div>
                  <div>Tambah Hutang: Rp {formatRp(selected.addedDebt)}</div>
                  <div>Catatan: {selected.note || "-"}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => startEdit(selected)}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    Edit Transaksi
                  </button>
                  <button
                    onClick={() => void removeSale(selected.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                  >
                    Hapus Transaksi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90dvh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Edit Transaksi</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
              >
                Tutup
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <select
                value={editBuyerType}
                onChange={(e) =>
                  setEditBuyerType(e.target.value as "EMPLOYEE" | "GENERAL")
                }
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="GENERAL">GENERAL</option>
              </select>
              <input
                value={editEmployeeCode}
                onChange={(e) => setEditEmployeeCode(e.target.value)}
                disabled={editBuyerType !== "EMPLOYEE"}
                placeholder="Employee code"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-100"
              />
              <input
                value={formatMoneyInput(editCashPaidInput)}
                onChange={(e) => setEditCashPaidInput(e.target.value)}
                inputMode="numeric"
                placeholder="Cash paid"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={editUseWallet}
                  onChange={(e) => setEditUseWallet(e.target.checked)}
                  disabled={editBuyerType !== "EMPLOYEE"}
                />
                Pakai saldo wajib
              </label>
            </div>

            <div className="mt-3">
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Catatan"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Produk</th>
                    <th className="px-3 py-2 text-left">Qty</th>
                    <th className="px-3 py-2 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((it, i) => (
                    <tr key={`${it.productId}-${i}`} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <select
                          value={it.productId}
                          onChange={(e) =>
                            updateEditItem(i, { productId: e.target.value })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.stock})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) =>
                            updateEditItem(i, {
                              qty: Math.max(1, Number(e.target.value || "1")),
                            })
                          }
                          className="w-24 rounded-lg border border-gray-200 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeEditItem(i)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={addEditItem}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50"
              >
                + Tambah Item
              </button>
              <button
                onClick={() => void submitEdit()}
                disabled={saving}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
