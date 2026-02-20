import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import StockInClient from "./stock-in-client";

export default async function StockInPage() {
  const products = await apiGet<Product[]>("/stock/products?includeInactive=true");

  return <StockInClient products={products} />;
}
