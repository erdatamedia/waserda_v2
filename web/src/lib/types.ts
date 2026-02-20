// web/src/lib/types.ts
export type Product = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  barcode: string | null;
  price: number;
  discountPct: number;
  taxPct: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Employee = {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string;
  role: "ADMIN" | "CASHIER" | "EMPLOYEE";
  isActive: boolean;
  createdAt: string;
};

export type CategoryMaster = {
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
