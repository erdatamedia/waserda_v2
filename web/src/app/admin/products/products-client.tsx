"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Product } from "@/lib/types";
import { apiGet, apiSend } from "@/lib/api";

type Props = {
  initialProducts: Product[];
  loadError?: string;
};

type ProductCategory = Product["category"];

const defaultCategoryOptions: Array<{ value: ProductCategory; label: string }> = [
  { value: "DOG_FOOD", label: "Kategori A" },
  { value: "CAT_FOOD", label: "Kategori B" },
  { value: "OTHER", label: "Lainnya" },
];

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
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

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function categoryLabel(
  v: ProductCategory,
  options: Array<{ value: ProductCategory; label: string }>,
) {
  return options.find((x) => x.value === v)?.label ?? v;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
    reader.readAsDataURL(file);
  });
}

export default function ProductsClient({ initialProducts, loadError }: Props) {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [q, setQ] = useState("");
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("OTHER");
  const [imageUrl, setImageUrl] = useState("");
  const [barcode, setBarcode] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [discountPctInput, setDiscountPctInput] = useState("");
  const [taxPctInput, setTaxPctInput] = useState("");
  const [stockInput, setStockInput] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<ProductCategory>("OTHER");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editPriceInput, setEditPriceInput] = useState("");
  const [editDiscountPctInput, setEditDiscountPctInput] = useState("");
  const [editTaxPctInput, setEditTaxPctInput] = useState("");
  const [editActive, setEditActive] = useState<boolean>(true);
  const [page, setPage] = useState(1);
  const [categoryOptions, setCategoryOptions] = useState(defaultCategoryOptions);

  useEffect(() => {
    (async () => {
      try {
        const rows = await apiGet<
          Array<{ code: ProductCategory; name: string; isActive: boolean }>
        >("/master/categories");
        const mapped = rows.map((x) => ({ value: x.code, label: x.name }));
        if (mapped.length > 0) setCategoryOptions(mapped);
      } catch {
        // fallback to defaults
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        (p.barcode ?? "").toLowerCase().includes(s) ||
        categoryLabel(p.category, categoryOptions).toLowerCase().includes(s),
    );
  }, [items, q, categoryOptions]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  async function refresh() {
    window.location.reload();
  }

  function validateCommon(payload: {
    name: string;
    barcode?: string;
    price: number;
    discountPct: number;
    taxPct: number;
  }) {
    if (!payload.name || payload.name.length < 2) {
      return "Nama minimal 2 karakter";
    }
    if (!Number.isFinite(payload.price) || payload.price < 0) {
      return "Harga tidak valid";
    }
    if (
      !Number.isFinite(payload.discountPct) ||
      payload.discountPct < 0 ||
      payload.discountPct > 100
    ) {
      return "Diskon harus 0..100";
    }
    if (!Number.isFinite(payload.taxPct) || payload.taxPct < 0 || payload.taxPct > 100) {
      return "Pajak harus 0..100";
    }
    if (payload.barcode !== undefined && payload.barcode !== "" && payload.barcode.length < 3) {
      return "Barcode minimal 3 karakter";
    }
    return null;
  }

  async function onCreateImageChange(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 2MB");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageUrl(dataUrl);
    } catch (e) {
      alert(errMsg(e));
    }
  }

  async function onEditImageChange(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 2MB");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setEditImageUrl(dataUrl);
    } catch (e) {
      alert(errMsg(e));
    }
  }

  async function onCreate() {
    const price = parseNumericInput(priceInput);
    const discountPct = parseNumericInput(discountPctInput) ?? 0;
    const taxPct = parseNumericInput(taxPctInput) ?? 0;
    const stock = parseNumericInput(stockInput);
    if (price === null) return alert("Harga wajib diisi");
    if (stock === null) return alert("Stok awal wajib diisi");

    const payload = {
      name: name.trim(),
      category,
      imageUrl: imageUrl.trim(),
      barcode: barcode.trim(),
      price,
      discountPct,
      taxPct,
      stock,
    };

    const commonErr = validateCommon(payload);
    if (commonErr) return alert(commonErr);
    if (!Number.isFinite(payload.stock) || payload.stock < 0) {
      return alert("Stok tidak valid");
    }

    try {
      const created = await apiSend<Product>("/stock/products", "POST", payload);
      setItems((prev) => [created, ...prev]);
      setName("");
      setCategory("OTHER");
      setImageUrl("");
      setBarcode("");
      setPriceInput("");
      setDiscountPctInput("");
      setTaxPctInput("");
      setStockInput("");
      setPage(1);
      alert("Produk berhasil ditambahkan");
    } catch (e: unknown) {
      alert(`Gagal tambah produk: ${errMsg(e)}`);
    }
  }

  function startEdit(p: Product) {
    setEditId(p.id);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditImageUrl(p.imageUrl ?? "");
    setEditBarcode(p.barcode ?? "");
    setEditPriceInput(String(p.price));
    setEditDiscountPctInput(String(p.discountPct ?? 0));
    setEditTaxPctInput(String(p.taxPct ?? 0));
    setEditActive(p.isActive);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
    setEditCategory("OTHER");
    setEditImageUrl("");
    setEditBarcode("");
    setEditPriceInput("");
    setEditDiscountPctInput("");
    setEditTaxPctInput("");
    setEditActive(true);
  }

  async function onSaveEdit() {
    if (!editId) return;
    const editPrice = parseNumericInput(editPriceInput);
    const editDiscountPct = parseNumericInput(editDiscountPctInput) ?? 0;
    const editTaxPct = parseNumericInput(editTaxPctInput) ?? 0;
    if (editPrice === null) return alert("Harga wajib diisi");

    const payload = {
      name: editName.trim(),
      category: editCategory,
      imageUrl: editImageUrl.trim(),
      barcode: editBarcode.trim(),
      price: editPrice,
      discountPct: editDiscountPct,
      taxPct: editTaxPct,
      isActive: Boolean(editActive),
    };

    const commonErr = validateCommon(payload);
    if (commonErr) return alert(commonErr);

    try {
      const updated = await apiSend<Product>(
        `/stock/products/${editId}`,
        "PATCH",
        payload,
      );
      setItems((prev) => prev.map((x) => (x.id === editId ? updated : x)));
      cancelEdit();
      alert("Produk berhasil diupdate");
    } catch (e: unknown) {
      alert(`Gagal update produk: ${errMsg(e)}`);
    }
  }

  async function toggleActive(p: Product) {
    try {
      const updated = await apiSend<Product>(`/stock/products/${p.id}`, "PATCH", {
        isActive: !p.isActive,
      });
      setItems((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
    } catch (e: unknown) {
      alert(`Gagal toggle aktif: ${errMsg(e)}`);
    }
  }

  return (
    <div className="space-y-6">
      {hydrated && loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat produk dari API: {loadError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Produk</h1>
          <p className="text-sm text-gray-500">
            Produk menjadi source of truth untuk kategori, diskon, pajak, dan image.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Cari produk..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm md:w-72"
          />
          <button
            onClick={refresh}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 text-sm font-semibold text-gray-800">Tambah Produk</div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Nama</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Contoh: Beras Premium 5kg"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Upload Gambar
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void onCreateImageChange(e.target.files?.[0])}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {imageUrl ? (
              <button
                onClick={() => setImageUrl("")}
                className="mt-1 text-xs text-red-600 hover:underline"
              >
                Hapus gambar
              </button>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Barcode</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Contoh: 8991234567890"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Harga</label>
            <input
              value={formatNumericInput(priceInput)}
              onChange={(e) => setPriceInput(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="7000"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Diskon (%)</label>
            <input
              value={formatNumericInput(discountPctInput)}
              onChange={(e) => setDiscountPctInput(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Pajak (%)</label>
            <input
              value={formatNumericInput(taxPctInput)}
              onChange={(e) => setTaxPctInput(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Stok Awal</label>
            <input
              value={formatNumericInput(stockInput)}
              onChange={(e) => setStockInput(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="10"
            />
          </div>
        </div>

        <div className="mt-3">
          <button
            onClick={onCreate}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Simpan Produk
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-700">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Barcode</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Diskon</th>
              <th className="px-4 py-3">Pajak</th>
              <th className="px-4 py-3">Stok</th>
              <th className="px-4 py-3">Aktif</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {pagedItems.map((p) => {
              const isEdit = editId === p.id;
              return (
                <tr key={p.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3">
                    {isEdit ? (
                      <div className="space-y-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            void onEditImageChange(e.target.files?.[0])
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs"
                        />
                        {editImageUrl ? (
                          <button
                            onClick={() => setEditImageUrl("")}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Hapus gambar
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div
                          className="h-12 w-12 rounded-lg border border-gray-200 bg-gray-100 bg-cover bg-center"
                          style={{
                            backgroundImage: p.imageUrl
                              ? `url(${p.imageUrl})`
                              : "none",
                          }}
                        />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="font-mono text-[11px] text-gray-500">{p.id}</div>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEdit ? (
                      <input
                        value={editBarcode}
                        onChange={(e) => setEditBarcode(e.target.value)}
                        className="w-40 rounded-lg border border-gray-200 px-2 py-1"
                        placeholder="Barcode"
                      />
                    ) : (
                      p.barcode || "-"
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEdit ? (
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as ProductCategory)}
                        className="rounded-lg border border-gray-200 px-2 py-1"
                      >
                        {categoryOptions.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      categoryLabel(p.category, categoryOptions)
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEdit ? (
                      <input
                        value={formatNumericInput(editPriceInput)}
                        onChange={(e) => setEditPriceInput(e.target.value)}
                        inputMode="numeric"
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1"
                      />
                    ) : (
                      `Rp ${formatRp(p.price)}`
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEdit ? (
                      <input
                        value={formatNumericInput(editDiscountPctInput)}
                        onChange={(e) => setEditDiscountPctInput(e.target.value)}
                        inputMode="numeric"
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1"
                      />
                    ) : (
                      `${p.discountPct}%`
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEdit ? (
                      <input
                        value={formatNumericInput(editTaxPctInput)}
                        onChange={(e) => setEditTaxPctInput(e.target.value)}
                        inputMode="numeric"
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1"
                      />
                    ) : (
                      `${p.taxPct}%`
                    )}
                  </td>

                  <td className="px-4 py-3">{p.stock}</td>

                  <td className="px-4 py-3">
                    {isEdit ? (
                      <select
                        value={editActive ? "true" : "false"}
                        onChange={(e) => setEditActive(e.target.value === "true")}
                        className="rounded-lg border border-gray-200 px-2 py-1"
                      >
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          p.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEdit ? (
                      <div className="flex gap-2">
                        <button
                          onClick={onSaveEdit}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startEdit(p)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"
                        >
                          {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="text-xs text-gray-600">
            Halaman {safePage} dari {totalPages} • {filtered.length} data
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
