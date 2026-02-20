import { apiGet } from "@/lib/api";
import type { Employee } from "@/lib/types";
import EmployeesClient from "./employees-client";

export default async function EmployeesPage() {
  let data: Employee[] = [];
  let loadError: string | undefined;

  try {
    data = await apiGet<Employee[]>("/employees?all=true");
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return <EmployeesClient initialEmployees={data} loadError={loadError} />;
}
