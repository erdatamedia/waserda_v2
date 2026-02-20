import CashierClient from "./cashier-client";

export default function CashierPage() {
  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Kasir</h1>
        <p className="text-sm text-muted-foreground">
          Transaksi penjualan (pegawai/umum), tunai + saldo wajib + hutang.
        </p>
      </div>

      <CashierClient />
    </div>
  );
}
