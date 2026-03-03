import { apiGet } from "@/lib/api";

type FinancialReport = {
  period: { from: string; to: string };
  sales: {
    transactionCount: number;
    totalSales: number;
    employeeSales: number;
    generalSales: number;
  };
  movements: {
    cashFromSales: number;
    walletUsed: number;
    debtAddedFromSales: number;
    debtPayment: number;
    walletTopupCredit: number;
  };
  ledgerSummary: {
    debtAdd: number;
    debtPay: number;
    walletCredit: number;
    walletDebit: number;
  };
  cashflowEstimate: {
    totalCashIn: number;
  };
};

type BalanceSheet = {
  asOf: string;
  assets: {
    cashEstimate: number;
    inventoryValue: number;
    receivableEmployeeDebt: number;
    total: number;
  };
  liabilities: {
    mandatoryWalletLiability: number;
    total: number;
  };
  equity: {
    total: number;
  };
  notes: string[];
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function dateInputValue(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export default async function ReportsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

  const from =
    typeof sp.from === "string" && sp.from ? sp.from : dateInputValue(firstDay);
  const to = typeof sp.to === "string" && sp.to ? sp.to : dateInputValue(now);
  const asOf =
    typeof sp.asOf === "string" && sp.asOf ? sp.asOf : dateInputValue(now);

  let loadError: string | undefined;
  let financial: FinancialReport | null = null;
  let balance: BalanceSheet | null = null;

  try {
    [financial, balance] = await Promise.all([
      apiGet<FinancialReport>(
        `/cashier/reports/financial?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
      apiGet<BalanceSheet>(
        `/cashier/reports/balance-sheet?asOf=${encodeURIComponent(asOf)}`,
      ),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Laporan Keuangan & Neraca</h1>
        <p className="text-sm text-gray-500">
          Ringkasan arus kas operasional, pergerakan akun, dan posisi neraca.
        </p>
      </div>

      <form method="get" className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-4">
        <label className="text-sm">
          <div className="mb-1 text-gray-600">From</div>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-gray-600">To</div>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-gray-600">As Of (Neraca)</div>
          <input
            type="date"
            name="asOf"
            defaultValue={asOf}
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <div className="flex w-full gap-2">
            <button className="w-full rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
              Tampilkan
            </button>
            <a
              href={`${
                process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
                "http://localhost:3000"
              }/cashier/reports/financial/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
              className="whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Export Excel
            </a>
          </div>
        </div>
      </form>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat laporan: {loadError}
        </div>
      ) : null}

      {financial ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Laporan Keuangan Periode</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Total Penjualan</div>
              <div className="mt-1 text-2xl font-semibold">Rp {formatRp(financial.sales.totalSales)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Jumlah Transaksi</div>
              <div className="mt-1 text-2xl font-semibold">{financial.sales.transactionCount}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Estimasi Total Cash In</div>
              <div className="mt-1 text-2xl font-semibold">Rp {formatRp(financial.cashflowEstimate.totalCashIn)}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left text-gray-700">
                <tr>
                  <th className="px-4 py-3">Komponen</th>
                  <th className="px-4 py-3">Nilai</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Penjualan Pegawai</td>
                  <td className="px-4 py-3 font-medium">Rp {formatRp(financial.sales.employeeSales)}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Penjualan Umum</td>
                  <td className="px-4 py-3 font-medium">Rp {formatRp(financial.sales.generalSales)}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Cash dari Penjualan</td>
                  <td className="px-4 py-3 font-medium">Rp {formatRp(financial.movements.cashFromSales)}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Saldo Wajib Terpakai</td>
                  <td className="px-4 py-3 font-medium">Rp {formatRp(financial.movements.walletUsed)}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Hutang Baru dari Penjualan</td>
                  <td className="px-4 py-3 font-medium">Rp {formatRp(financial.movements.debtAddedFromSales)}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Pembayaran Hutang</td>
                  <td className="px-4 py-3 font-medium">Rp {formatRp(financial.movements.debtPayment)}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Topup Saldo Wajib (Credit)</td>
                  <td className="px-4 py-3 font-medium">Rp {formatRp(financial.movements.walletTopupCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {balance ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Neraca (As Of)</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-2 text-sm font-semibold">Aset</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Kas (estimasi)</span>
                  <span className="font-medium">Rp {formatRp(balance.assets.cashEstimate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Persediaan</span>
                  <span className="font-medium">Rp {formatRp(balance.assets.inventoryValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Piutang Pegawai</span>
                  <span className="font-medium">Rp {formatRp(balance.assets.receivableEmployeeDebt)}</span>
                </div>
                <div className="mt-2 border-t border-gray-200 pt-2 flex justify-between font-semibold">
                  <span>Total Aset</span>
                  <span>Rp {formatRp(balance.assets.total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-2 text-sm font-semibold">Liabilitas</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Kewajiban Saldo Wajib</span>
                  <span className="font-medium">Rp {formatRp(balance.liabilities.mandatoryWalletLiability)}</span>
                </div>
                <div className="mt-2 border-t border-gray-200 pt-2 flex justify-between font-semibold">
                  <span>Total Liabilitas</span>
                  <span>Rp {formatRp(balance.liabilities.total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-2 text-sm font-semibold">Ekuitas</div>
              <div className="text-2xl font-semibold">Rp {formatRp(balance.equity.total)}</div>
              <div className="mt-3 text-xs text-gray-500">as of {new Date(balance.asOf).toLocaleDateString("id-ID")}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {balance.notes.map((x, i) => (
              <div key={i}>• {x}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
