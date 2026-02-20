import { apiGet } from "@/lib/api";
import type { CategoryMaster } from "@/lib/types";
import CategoriesClient from "./categories-client";

export default async function MasterCategoriesPage() {
  let data: CategoryMaster[] = [];
  let loadError: string | undefined;

  try {
    data = await apiGet<CategoryMaster[]>("/master/categories");
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return <CategoriesClient initialCategories={data} loadError={loadError} />;
}
