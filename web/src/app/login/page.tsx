"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/api";

type LoginResponse = {
  accessToken?: string;
  employee?: {
    id: string;
    name: string;
    employeeCode: string;
    role: "ADMIN" | "CASHIER";
    isActive: boolean;
  };
  user?: {
    id: string;
    name: string;
    employeeCode: string;
    role: "ADMIN" | "CASHIER";
    isActive: boolean;
  };
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function LoginPage() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (employeeCode.trim().length < 3) {
      setError("Employee code minimal 3 karakter");
      return;
    }

    setLoading(true);
    try {
      const res = await apiSend<LoginResponse>("/auth/login", "POST", {
        employeeCode: employeeCode.trim(),
      });
      const sessionUser = res.employee ?? res.user;
      if (!sessionUser) throw new Error("Format response login tidak valid");

      document.cookie = `waserda_role=${sessionUser.role}; path=/; max-age=${60 * 60 * 12}`;
      document.cookie = `waserda_name=${encodeURIComponent(sessionUser.name)}; path=/; max-age=${60 * 60 * 12}`;
      document.cookie = `waserda_code=${encodeURIComponent(sessionUser.employeeCode)}; path=/; max-age=${60 * 60 * 12}`;

      if (sessionUser.role === "CASHIER") {
        router.replace("/admin/cashier");
      } else {
        router.replace("/admin");
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Login Admin Waserda</h1>
        <p className="mt-1 text-sm text-gray-500">Login menggunakan employee code (role ADMIN/CASHIER).</p>
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          Default login: <span className="font-mono">ADM-0001</span> (Admin),{" "}
          <span className="font-mono">CSR-0001</span> (Cashier)
        </div>

        <div className="mt-5 space-y-3">
          <input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            placeholder="Employee Code"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSubmit();
            }}
          />

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            onClick={() => void onSubmit()}
            disabled={loading}
            className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
