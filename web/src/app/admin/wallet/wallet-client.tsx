"use client";

import { useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

type WalletRow = {
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    role: "ADMIN" | "CASHIER" | "EMPLOYEE";
    isActive: boolean;
  };
  walletBalance: number;
  debtBalance: number;
  lastWalletTxnAt: string | null;
};

type WalletHistory = {
  id: string;
  type: "WALLET_CREDIT" | "WALLET_DEBIT";
  amount: number;
  note: string | null;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
  };
};

type DebtPayResponse = {
  ok: true;
  debtBefore: number;
  debtAfter: number;
};

type Props = {
  initialRows: WalletRow[];
  initialHistory: WalletHistory[];
  loadError?: string;
};

const PAGE_SIZE = 10;

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

function formatDate(v: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function WalletClient({
  initialRows,
  initialHistory,
  loadError,
}: Props) {
  const [rows, setRows] = useState<WalletRow[]>(initialRows);
  const [history, setHistory] = useState<WalletHistory[]>(initialHistory);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [employeeCode, setEmployeeCode] = useState("");
  const [mode, setMode] = useState<"ADD" | "SUB" | "SET">("ADD");
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [historyCode, setHistoryCode] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [debtPayAmountInput, setDebtPayAmountInput] = useState("");
  const [debtPayNote, setDebtPayNote] = useState("");
  const [debtPaySaving, setDebtPaySaving] = useState(false);
  const [debtPayResult, setDebtPayResult] = useState<DebtPayResponse | null>(
    null,
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.employee.name, r.employee.employeeCode, r.employee.role]
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  async function refresh(search?: string) {
    try {
      const qs = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const latest = await apiGet<WalletRow[]>(`/cashier/wallet-monitor${qs}`);
      setRows(latest);
      setPage(1);
    } catch (e) {
      alert(`Gagal refresh saldo: ${errMsg(e)}`);
    }
  }

  async function loadHistory(code?: string) {
    setHistoryLoading(true);
    try {
      const trimmed = code?.trim();
      const qs = trimmed ? `?employeeCode=${encodeURIComponent(trimmed)}&take=40` : "?take=40";
      const latest = await apiGet<WalletHistory[]>(`/cashier/wallet-history${qs}`);
      setHistory(latest);
      setHistoryCode(trimmed ?? "");
    } catch (e) {
      alert(`Gagal memuat riwayat saldo: ${errMsg(e)}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitAdjust() {
    const amount = parseMoneyInput(amountInput);
    if (employeeCode.trim().length < 3) {
      alert("Employee code minimal 3 karakter");
      return;
    }
    if (amount === null) {
      alert("Nominal wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const code = employeeCode.trim();
      await apiSend("/cashier/wallet-adjust", "POST", {
        employeeCode: code,
        mode,
        amount,
        note: note.trim() || undefined,
      });
      await Promise.all([refresh(q), loadHistory(code)]);
      setEmployeeCode("");
      setMode("ADD");
      setAmountInput("");
      setNote("");
    } catch (e) {
      alert(`Gagal atur saldo: ${errMsg(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function submitDebtPay() {
    const debtPayAmount = parseMoneyInput(debtPayAmountInput);
    if (employeeCode.trim().length < 3) {
      alert("Employee code minimal 3 karakter");
      return;
    }
    if (debtPayAmount === null || debtPayAmount <= 0) {
      alert("Nominal bayar hutang wajib diisi");
      return;
    }

    setDebtPaySaving(true);
    setDebtPayResult(null);
    try {
      const code = employeeCode.trim();
      const res = await apiSend<DebtPayResponse>("/cashier/debt-pay", "POST", {
        employeeCode: code,
        amount: debtPayAmount,
        note: debtPayNote.trim() || undefined,
      });
      setDebtPayResult(res);
      setDebtPayAmountInput("");
      setDebtPayNote("");
      await Promise.all([refresh(q), loadHistory(code)]);
    } catch (e) {
      alert(`Gagal bayar hutang: ${errMsg(e)}`);
    } finally {
      setDebtPaySaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat data saldo wajib: {loadError}
        </div>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold">Saldo Wajib Pegawai</h1>
        <p className="text-sm text-gray-500">
          Monitoring saldo per akun pegawai, pengaturan saldo (ADD/SUB/SET), dan riwayat mutasi.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            placeholder="Employee Code"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "ADD" | "SUB" | "SET")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="ADD">ADD (Tambah)</option>
            <option value="SUB">SUB (Kurang)</option>
            <option value="SET">SET (Set Nominal)</option>
          </select>
          <input
            inputMode="numeric"
            value={formatMoneyInput(amountInput)}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="Nominal"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void submitAdjust()}
            disabled={saving}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>

        <div className="mt-3 grid gap-3 border-t border-gray-200 pt-3 md:grid-cols-5">
          <input
            inputMode="numeric"
            value={formatMoneyInput(debtPayAmountInput)}
            onChange={(e) => setDebtPayAmountInput(e.target.value)}
            placeholder="Nominal Bayar Hutang"
            className="rounded-xl border border-amber-200 px-3 py-2 text-sm"
          />
          <input
            value={debtPayNote}
            onChange={(e) => setDebtPayNote(e.target.value)}
            placeholder="Catatan Bayar Hutang"
            className="rounded-xl border border-amber-200 px-3 py-2 text-sm md:col-span-3"
          />
          <button
            onClick={() => void submitDebtPay()}
            disabled={debtPaySaving}
            className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {debtPaySaving ? "Memproses..." : "Bayar Hutang"}
          </button>
        </div>
        {debtPayResult ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
            Hutang sebelum: Rp {formatRp(debtPayResult.debtBefore)} • sisa hutang: Rp{" "}
            {formatRp(debtPayResult.debtAfter)}
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Cari pegawai..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm md:w-96"
        />
        <button
          onClick={() => void refresh(q)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-700">
            <tr>
              <th className="px-4 py-3">Pegawai</th>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Saldo Wajib</th>
              <th className="px-4 py-3">Hutang</th>
              <th className="px-4 py-3">Mutasi Terakhir</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {pageRows.map((r) => (
              <tr key={r.employee.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{r.employee.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.employee.employeeCode}</td>
                <td className="px-4 py-3">{r.employee.role}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${r.employee.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {r.employee.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">Rp {formatRp(r.walletBalance)}</td>
                <td className="px-4 py-3">Rp {formatRp(r.debtBalance)}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{formatDate(r.lastWalletTxnAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      setEmployeeCode(r.employee.employeeCode);
                      void loadHistory(r.employee.employeeCode);
                    }}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    Pilih
                  </button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  Tidak ada data.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <div>
            Halaman {safePage} dari {totalPages} • {filtered.length} data
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Riwayat Mutasi Saldo Wajib</div>
            <div className="text-xs text-gray-500">
              {historyCode ? `Filter: ${historyCode}` : "Semua pegawai"}
            </div>
          </div>
          <div className="flex gap-2">
            {historyCode ? (
              <button
                onClick={() => void loadHistory()}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
              >
                Reset Filter
              </button>
            ) : null}
            <button
              onClick={() => void loadHistory(historyCode || undefined)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
            >
              {historyLoading ? "Memuat..." : "Refresh Riwayat"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Pegawai</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Nominal</th>
                <th className="px-4 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(h.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{h.employee.name}</div>
                    <div className="font-mono text-[11px] text-gray-500">{h.employee.employeeCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${h.type === "WALLET_CREDIT" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {h.type === "WALLET_CREDIT" ? "Kredit" : "Debit"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">Rp {formatRp(h.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{h.note?.trim() ? h.note : "-"}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Belum ada riwayat mutasi saldo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
