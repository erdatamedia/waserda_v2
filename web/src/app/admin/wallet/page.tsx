import { apiGet } from "@/lib/api";
import WalletClient from "./wallet-client";

type WalletRow = {
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    role: "ADMIN" | "CASHIER" | "EMPLOYEE";
    isActive: boolean;
  };
  walletBalance: number;
  debtBalance: number;
  lastWalletTxnAt: string | null;
};

type WalletHistory = {
  id: string;
  type: "WALLET_CREDIT" | "WALLET_DEBIT";
  amount: number;
  note: string | null;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
  };
};

export default async function WalletPage() {
  let rows: WalletRow[] = [];
  let history: WalletHistory[] = [];
  let loadError: string | undefined;

  try {
    [rows, history] = await Promise.all([
      apiGet<WalletRow[]>("/cashier/wallet-monitor"),
      apiGet<WalletHistory[]>("/cashier/wallet-history?take=40"),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <WalletClient
      initialRows={rows}
      initialHistory={history}
      loadError={loadError}
    />
  );
}
