-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CASHIER');

-- CreateEnum
CREATE TYPE "AccountTxnType" AS ENUM ('WALLET_CREDIT', 'WALLET_DEBIT', 'DEBT_ADD', 'DEBT_PAY');

-- CreateEnum
CREATE TYPE "SaleSource" AS ENUM ('CASHIER_WEB', 'MOBILE');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" "Role" NOT NULL DEFAULT 'CASHIER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePin" (
    "employeeId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePin_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeWalletMonth" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "monthlyAllowance" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "EmployeeWalletMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTxn" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "AccountTxnType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "refSaleId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "paidByMandatory" INTEGER NOT NULL,
    "addedDebt" INTEGER NOT NULL,
    "source" "SaleSource" NOT NULL DEFAULT 'CASHIER_WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Device_employeeId_deviceId_key" ON "Device"("employeeId", "deviceId");

-- CreateIndex
CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");

-- CreateIndex
CREATE INDEX "EmployeeWalletMonth_month_idx" ON "EmployeeWalletMonth"("month");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeWalletMonth_employeeId_month_key" ON "EmployeeWalletMonth"("employeeId", "month");

-- CreateIndex
CREATE INDEX "AccountTxn_employeeId_createdAt_idx" ON "AccountTxn"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountTxn_type_idx" ON "AccountTxn"("type");

-- AddForeignKey
ALTER TABLE "EmployeePin" ADD CONSTRAINT "EmployeePin_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWalletMonth" ADD CONSTRAINT "EmployeeWalletMonth_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTxn" ADD CONSTRAINT "AccountTxn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
