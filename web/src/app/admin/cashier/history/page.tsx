import HistoryClient from "./history-client";

export default function CashierHistoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Riwayat Transaksi</h1>
        <p className="text-sm text-gray-500">
          Lihat detail transaksi, koreksi input dengan edit, atau hapus transaksi
          yang salah.
        </p>
      </div>
      <HistoryClient />
    </div>
  );
}
