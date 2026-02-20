"use client";

import { useState } from "react";
import { apiSend } from "@/lib/api";
import type { CategoryMaster } from "@/lib/types";

type Props = {
  initialCategories: CategoryMaster[];
  loadError?: string;
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function CategoriesClient({ initialCategories, loadError }: Props) {
  const [items, setItems] = useState<CategoryMaster[]>(initialCategories);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editCode, setEditCode] = useState<CategoryMaster["code"] | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);

  async function onCreate() {
    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      isActive,
    };
    if (!/^[A-Z0-9_]{2,40}$/.test(payload.code)) {
      return alert("Kode kategori harus huruf besar/angka/underscore (2-40)");
    }
    if (payload.name.length < 2) return alert("Nama kategori minimal 2 karakter");

    try {
      const created = await apiSend<CategoryMaster>("/master/categories", "POST", payload);
      setItems((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)));
      setCode("");
      setName("");
      setIsActive(true);
    } catch (e) {
      alert(`Gagal tambah kategori: ${errMsg(e)}`);
    }
  }

  function startEdit(c: CategoryMaster) {
    setEditCode(c.code);
    setEditName(c.name);
    setEditActive(c.isActive);
  }

  function cancelEdit() {
    setEditCode(null);
    setEditName("");
    setEditActive(true);
  }

  async function saveEdit() {
    if (!editCode) return;
    if (editName.trim().length < 2) return alert("Nama kategori minimal 2 karakter");

    try {
      const updated = await apiSend<CategoryMaster>(
        `/master/categories/${editCode}`,
        "PATCH",
        { name: editName.trim(), isActive: editActive },
      );
      setItems((prev) => prev.map((x) => (x.code === updated.code ? updated : x)));
      cancelEdit();
    } catch (e) {
      alert(`Gagal update kategori: ${errMsg(e)}`);
    }
  }

  return (
    <div className="space-y-5">
      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat master kategori: {loadError}
        </div>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold">Master Kategori</h1>
        <p className="text-sm text-gray-500">Nama dan status kategori produk yang dipakai modul produk/kasir.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Kode (contoh: MINUMAN)"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama kategori"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={isActive ? "true" : "false"}
            onChange={(e) => setIsActive(e.target.value === "true")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
          <button
            onClick={onCreate}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Tambah Kategori
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-700">
            <tr>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {items.map((c) => {
              const isEdit = editCode === c.code;
              return (
                <tr key={c.code} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3">
                    {isEdit ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1"
                      />
                    ) : (
                      c.name
                    )}
                  </td>
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
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${c.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {c.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEdit ? (
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">Simpan</button>
                        <button onClick={cancelEdit} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">Batal</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(c)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
