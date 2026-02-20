// web/src/app/admin/products/page.tsx
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import ProductsClient from "./products-client";

export default async function AdminProductsPage() {
  let products: Product[] = [];
  let loadError: string | undefined;

  try {
    products = await apiGet<Product[]>("/stock/products?all=true");
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return <ProductsClient initialProducts={products} loadError={loadError} />;
}
