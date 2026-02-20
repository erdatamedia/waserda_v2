import Link from "next/link";
import { apiGet } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  discountPct: number;
  taxPct: number;
  stock: number;
  isActive: boolean;
};

type TodaySummary = {
  date: string;
  totalSalesToday: number;
  totalTransactions: number;
  employeeTransactions: number;
  generalTransactions: number;
  totalNewDebtToday: number;
  totalDebtPaymentToday: number;
  totalMandatoryWalletDeductedToday: number;
};

type DashboardSummary = {
  salesCharts: {
    last7Days: Array<{ key: string; label: string; total: number }>;
    monthly: Array<{ key: string; label: string; total: number }>;
    hourlyToday: Array<{ hour: number; label: string; total: number; count: number }>;
  };
  productAlerts: {
    lowStockThreshold: number;
    lowStockCount: number;
    lowStockProducts: Array<{ id: string; name: string; isActive: boolean; stock: number }>;
    inactiveCount: number;
    inactiveProducts: Array<{ id: string; name: string; isActive: boolean; stock: number }>;
    unsold30DaysCount: number;
    unsold30DaysProducts: Array<{ id: string; name: string; isActive: boolean; stock: number }>;
  };
  employeeRankings: {
    topDebtEmployees: Array<{ employeeId: string; name: string; employeeCode: string; debtBalance: number }>;
    topWalletEmployees: Array<{ employeeId: string; name: string; employeeCode: string; walletBalance: number }>;
    topFrequentEmployees: Array<{ employeeId: string; name: string; employeeCode: string; txCount: number }>;
  };
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function maxTotal<T>(rows: T[], pick: (row: T) => number) {
  return Math.max(1, ...rows.map(pick));
}

export default async function AdminDashboardPage() {
  let loadError: string | undefined;

  let totalProducts = 0;
  let activeProducts = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;
  let inventoryValue = 0;

  let todaySummary: TodaySummary = {
    date: new Date().toISOString(),
    totalSalesToday: 0,
    totalTransactions: 0,
    employeeTransactions: 0,
    generalTransactions: 0,
    totalNewDebtToday: 0,
    totalDebtPaymentToday: 0,
    totalMandatoryWalletDeductedToday: 0,
  };

  let dashboardSummary: DashboardSummary = {
    salesCharts: { last7Days: [], monthly: [], hourlyToday: [] },
    productAlerts: {
      lowStockThreshold: 5,
      lowStockCount: 0,
      lowStockProducts: [],
      inactiveCount: 0,
      inactiveProducts: [],
      unsold30DaysCount: 0,
      unsold30DaysProducts: [],
    },
    employeeRankings: {
      topDebtEmployees: [],
      topWalletEmployees: [],
      topFrequentEmployees: [],
    },
  };

  try {
    const [products, summaryToday, summaryDashboard] = await Promise.all([
      apiGet<Product[]>("/stock/products?all=true"),
      apiGet<TodaySummary>("/cashier/summary/today"),
      apiGet<DashboardSummary>("/cashier/summary/dashboard"),
    ]);

    totalProducts = products.length;
    activeProducts = products.filter((p) => p.isActive).length;
    lowStockProducts = products.filter((p) => p.isActive && p.stock > 0 && p.stock <= 10).length;
    outOfStockProducts = products.filter((p) => p.isActive && p.stock <= 0).length;

    inventoryValue = products.reduce((sum, p) => {
      const discountUnit = Math.trunc((p.price * p.discountPct) / 100);
      const taxableUnit = p.price - discountUnit;
      const taxUnit = Math.trunc((taxableUnit * p.taxPct) / 100);
      const finalUnit = taxableUnit + taxUnit;
      return sum + Math.max(0, p.stock) * finalUnit;
    }, 0);

    todaySummary = summaryToday;
    dashboardSummary = summaryDashboard;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const max7Days = maxTotal(dashboardSummary.salesCharts.last7Days, (r) => r.total);
  const maxMonthly = maxTotal(dashboardSummary.salesCharts.monthly, (r) => r.total);
  const maxHourly = maxTotal(dashboardSummary.salesCharts.hourlyToday, (r) => r.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard Admin</h1>
        <p className="text-sm text-gray-500">KPI operasional, grafik penjualan, alert produk, dan ranking pegawai.</p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Data ringkasan belum bisa dimuat: {loadError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">💰 Total Penjualan Hari Ini</div>
          <div className="mt-1 text-2xl font-semibold">Rp {formatRp(todaySummary.totalSalesToday)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">🧾 Jumlah Transaksi</div>
          <div className="mt-1 text-2xl font-semibold">{todaySummary.totalTransactions}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">👥 Transaksi Pegawai</div>
          <div className="mt-1 text-2xl font-semibold">{todaySummary.employeeTransactions}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">🛒 Transaksi Umum</div>
          <div className="mt-1 text-2xl font-semibold">{todaySummary.generalTransactions}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">📉 Total Hutang Baru Hari Ini</div>
          <div className="mt-1 text-2xl font-semibold">Rp {formatRp(todaySummary.totalNewDebtToday)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">💵 Total Pembayaran Hutang Hari Ini</div>
          <div className="mt-1 text-2xl font-semibold">Rp {formatRp(todaySummary.totalDebtPaymentToday)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">🏦 Saldo Wajib Terpotong Hari Ini</div>
          <div className="mt-1 text-2xl font-semibold">Rp {formatRp(todaySummary.totalMandatoryWalletDeductedToday)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">Nilai Inventori Saat Ini</div>
          <div className="mt-1 text-2xl font-semibold">Rp {formatRp(inventoryValue)}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-3 text-sm font-semibold">Grafik Penjualan 7 Hari Terakhir</div>
          <div className="grid h-40 grid-cols-7 items-end gap-2 rounded-xl bg-gray-50 p-3">
            {dashboardSummary.salesCharts.last7Days.map((d) => (
              <div key={d.key} className="flex h-full flex-col items-center justify-end gap-1">
                <div className="text-[10px] text-gray-500">{Math.round(d.total / 1000)}k</div>
                <div className="w-full rounded-t-md bg-blue-500" style={{ height: `${Math.max(6, Math.round((d.total / max7Days) * 100))}%` }} />
                <div className="text-[10px] text-gray-500">{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-3 text-sm font-semibold">Grafik Penjualan per Bulan</div>
          <div className="grid h-40 grid-cols-12 items-end gap-1 rounded-xl bg-gray-50 p-3">
            {dashboardSummary.salesCharts.monthly.map((d) => (
              <div key={d.key} className="flex h-full flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t-md bg-gray-700" style={{ height: `${Math.max(6, Math.round((d.total / maxMonthly) * 100))}%` }} />
                <div className="text-[9px] text-gray-500">{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-3 text-sm font-semibold">Grafik Penjualan per Jam (Hari Ini)</div>
          <div className="grid h-40 grid-cols-12 items-end gap-1 rounded-xl bg-gray-50 p-3">
            {dashboardSummary.salesCharts.hourlyToday.filter((x) => x.hour % 2 === 0).map((d) => (
              <div key={d.hour} className="flex h-full flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t-md bg-emerald-500" style={{ height: `${Math.max(6, Math.round((d.total / maxHourly) * 100))}%` }} />
                <div className="text-[9px] text-gray-500">{d.label.slice(0, 2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-2 text-sm font-semibold">Produk Stok &lt; {dashboardSummary.productAlerts.lowStockThreshold}</div>
          <div className="mb-2 text-xs text-gray-500">Total: {dashboardSummary.productAlerts.lowStockCount}</div>
          <div className="space-y-1 text-sm">
            {dashboardSummary.productAlerts.lowStockProducts.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1">
                <span className="truncate">{p.name}</span>
                <span className="font-semibold">{p.stock}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-2 text-sm font-semibold">Produk Nonaktif</div>
          <div className="mb-2 text-xs text-gray-500">Total: {dashboardSummary.productAlerts.inactiveCount}</div>
          <div className="space-y-1 text-sm">
            {dashboardSummary.productAlerts.inactiveProducts.slice(0, 5).map((p) => (
              <div key={p.id} className="rounded-lg bg-gray-50 px-2 py-1 truncate">{p.name}</div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-2 text-sm font-semibold">Produk Tidak Terjual 30 Hari</div>
          <div className="mb-2 text-xs text-gray-500">Total: {dashboardSummary.productAlerts.unsold30DaysCount}</div>
          <div className="space-y-1 text-sm">
            {dashboardSummary.productAlerts.unsold30DaysProducts.slice(0, 5).map((p) => (
              <div key={p.id} className="rounded-lg bg-gray-50 px-2 py-1 truncate">{p.name}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-2 text-sm font-semibold">Top 5 Pegawai Hutang Terbesar</div>
          <div className="space-y-1 text-sm">
            {dashboardSummary.employeeRankings.topDebtEmployees.map((e) => (
              <div key={e.employeeId} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1">
                <span className="truncate">{e.name}</span>
                <span className="font-semibold">Rp {formatRp(e.debtBalance)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-2 text-sm font-semibold">Pegawai Saldo Wajib Terbesar</div>
          <div className="space-y-1 text-sm">
            {dashboardSummary.employeeRankings.topWalletEmployees.map((e) => (
              <div key={e.employeeId} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1">
                <span className="truncate">{e.name}</span>
                <span className="font-semibold">Rp {formatRp(e.walletBalance)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-2 text-sm font-semibold">Pegawai Paling Sering Transaksi</div>
          <div className="space-y-1 text-sm">
            {dashboardSummary.employeeRankings.topFrequentEmployees.map((e) => (
              <div key={e.employeeId} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1">
                <span className="truncate">{e.name}</span>
                <span className="font-semibold">{e.txCount} trx</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">Produk Aktif / Total</div>
          <div className="mt-1 text-2xl font-semibold">{activeProducts} / {totalProducts}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">Produk Stok Menipis (≤10)</div>
          <div className="mt-1 text-2xl font-semibold">{lowStockProducts}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">Produk Habis Stok</div>
          <div className="mt-1 text-2xl font-semibold">{outOfStockProducts}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs text-gray-500">Aksi Cepat</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/admin/cashier" className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs hover:bg-gray-100">Kasir</Link>
            <Link href="/admin/products" className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs hover:bg-gray-100">Produk</Link>
            <Link href="/admin/stock/latest" className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs hover:bg-gray-100">Histori</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
