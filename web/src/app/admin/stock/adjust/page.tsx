import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import StockAdjustClient from "./stock-adjust-client";

export default async function StockAdjustPage() {
  const products = await apiGet<Product[]>("/stock/products?includeInactive=true");

  return <StockAdjustClient products={products} />;
}
