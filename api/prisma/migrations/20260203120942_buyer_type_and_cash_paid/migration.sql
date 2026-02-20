-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('EMPLOYEE', 'GENERAL');

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "buyerType" "BuyerType" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "cashPaid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ALTER COLUMN "employeeId" DROP NOT NULL,
ALTER COLUMN "paidByMandatory" SET DEFAULT 0,
ALTER COLUMN "addedDebt" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Sale_buyerType_createdAt_idx" ON "Sale"("buyerType", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_employeeId_createdAt_idx" ON "Sale"("employeeId", "createdAt");
