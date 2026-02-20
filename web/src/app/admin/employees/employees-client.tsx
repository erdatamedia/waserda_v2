"use client";

import { useMemo, useState } from "react";
import { apiSend } from "@/lib/api";
import type { Employee } from "@/lib/types";

type Props = {
  initialEmployees: Employee[];
  loadError?: string;
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function EmployeesClient({ initialEmployees, loadError }: Props) {
  const [items, setItems] = useState<Employee[]>(initialEmployees);
  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "CASHIER" | "EMPLOYEE">(
    "EMPLOYEE",
  );

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "CASHIER" | "EMPLOYEE">(
    "EMPLOYEE",
  );
  const [editActive, setEditActive] = useState(true);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) =>
      [x.name, x.employeeCode, x.email ?? "", x.role]
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [items, q]);

  async function onCreate() {
    const payload = {
      name: name.trim(),
      employeeCode: employeeCode.trim(),
      email: email.trim(),
      role,
      isActive: true,
    };

    if (payload.name.length < 2) return alert("Nama minimal 2 karakter");
    if (payload.employeeCode.length < 3)
      return alert("Employee code minimal 3 karakter");

    try {
      const created = await apiSend<Employee>("/employees", "POST", payload);
      setItems((prev) => [created, ...prev]);
      setName("");
      setEmployeeCode("");
      setEmail("");
      setRole("EMPLOYEE");
    } catch (e) {
      alert(`Gagal tambah pegawai: ${errMsg(e)}`);
    }
  }

  function startEdit(e: Employee) {
    setEditId(e.id);
    setEditName(e.name);
    setEditCode(e.employeeCode);
    setEditEmail(e.email ?? "");
    setEditRole(e.role);
    setEditActive(e.isActive);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
    setEditCode("");
    setEditEmail("");
    setEditRole("EMPLOYEE");
    setEditActive(true);
  }

  async function saveEdit() {
    if (!editId) return;
    try {
      const updated = await apiSend<Employee>(`/employees/${editId}`, "PATCH", {
        name: editName.trim(),
        employeeCode: editCode.trim(),
        email: editEmail.trim(),
        role: editRole,
        isActive: editActive,
      });
      setItems((prev) => prev.map((x) => (x.id === editId ? updated : x)));
      cancelEdit();
    } catch (e) {
      alert(`Gagal update pegawai: ${errMsg(e)}`);
    }
  }

  async function toggleActive(e: Employee) {
    try {
      const updated = await apiSend<Employee>(`/employees/${e.id}`, "PATCH", {
        isActive: !e.isActive,
      });
      setItems((prev) => prev.map((x) => (x.id === e.id ? updated : x)));
    } catch (err) {
      alert(`Gagal ubah status: ${errMsg(err)}`);
    }
  }

  return (
    <div className="space-y-5">
      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat data pegawai: {loadError}
        </div>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold">Pegawai</h1>
        <p className="text-sm text-gray-500">Master data pegawai untuk kasir dan operasional.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="Employee Code" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opsional)" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "CASHIER" | "EMPLOYEE")} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="CASHIER">CASHIER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button onClick={onCreate} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">Tambah Pegawai</button>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pegawai..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm md:w-96" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-700">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filtered.map((e) => {
              const isEdit = editId === e.id;
              return (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{isEdit ? <input value={editName} onChange={(x) => setEditName(x.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1" /> : e.name}</td>
                  <td className="px-4 py-3">{isEdit ? <input value={editCode} onChange={(x) => setEditCode(x.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1" /> : e.employeeCode}</td>
                  <td className="px-4 py-3">{isEdit ? <input value={editEmail} onChange={(x) => setEditEmail(x.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1" /> : (e.email ?? "-")}</td>
                  <td className="px-4 py-3">{isEdit ? (
                    <select value={editRole} onChange={(x) => setEditRole(x.target.value as "ADMIN" | "CASHIER" | "EMPLOYEE")} className="rounded-lg border border-gray-200 px-2 py-1">
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="CASHIER">CASHIER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  ) : e.role}</td>
                  <td className="px-4 py-3">{isEdit ? (
                    <select value={editActive ? "true" : "false"} onChange={(x) => setEditActive(x.target.value === "true")} className="rounded-lg border border-gray-200 px-2 py-1">
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  ) : (
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${e.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{e.isActive ? "Aktif" : "Nonaktif"}</span>
                  )}</td>
                  <td className="px-4 py-3">
                    {isEdit ? (
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">Simpan</button>
                        <button onClick={cancelEdit} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">Batal</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(e)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">Edit</button>
                        <button onClick={() => toggleActive(e)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">{e.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Tidak ada data pegawai.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
