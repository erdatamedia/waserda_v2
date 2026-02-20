import { apiGet } from "@/lib/api";
import Link from "next/link";

type StockTxn = {
  id: string;
  productId: string;
  type: "IN" | "ADJUST";
  qty: number;
  note: string;
  createdAt: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
};

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString("id-ID");
  } catch {
    return s;
  }
}

export default async function StockHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<{ take?: string; page?: string; pageSize?: string }>;
}) {
  const { productId } = await params;
  const sp = (await searchParams) ?? {};
  const take = Math.min(Math.max(Number(sp.take ?? 200), 1), 200);
  const pageSize = Math.min(Math.max(Number(sp.pageSize ?? 10), 1), 50);
  const page = Math.max(Number(sp.page ?? 1), 1);

  const product = await apiGet<Product>(`/stock/products/${productId}`);
  const rows = await apiGet<StockTxn[]>(
    `/stock/history/${productId}?take=${take}`,
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  function hrefFor(nextPage: number) {
    const qs = new URLSearchParams({
      take: String(take),
      pageSize: String(pageSize),
      page: String(nextPage),
    });
    return `/admin/stock/history/${productId}?${qs.toString()}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Histori Stok</h1>
          <p className="text-sm text-gray-500">
            Produk: <span className="font-medium text-gray-800">{product.name}</span>{" "}
            <span className="ml-2 font-mono text-xs text-gray-500">{product.id}</span>
          </p>
          <p className="text-sm text-gray-500">
            Stok saat ini: <span className="font-semibold text-gray-800">{product.stock}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/stock/latest"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Latest
          </Link>
          <Link
            href="/admin/products"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Produk
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-700">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      r.type === "IN"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {r.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">{r.qty}</td>
                <td className="px-4 py-3 text-gray-700">{r.note}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Belum ada histori.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > pageSize ? (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="text-xs text-gray-600">
            Halaman {safePage} dari {totalPages} • {rows.length} data
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={hrefFor(Math.max(1, safePage - 1))}
              className={`rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs ${
                safePage <= 1 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Sebelumnya
            </Link>
            <Link
              href={hrefFor(Math.min(totalPages, safePage + 1))}
              className={`rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs ${
                safePage >= totalPages ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Berikutnya
            </Link>
          </div>
        </div>
      ) : null}

      <div className="text-xs text-gray-500">
        Endpoint dipakai:{" "}
        <span className="font-mono">GET /stock/products/:id</span> +{" "}
        <span className="font-mono">GET /stock/history/:productId?take=</span>
      </div>
    </div>
  );
}
