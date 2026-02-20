-- CreateEnum
CREATE TYPE "StockTxnType" AS ENUM ('IN', 'ADJUST');

-- CreateTable
CREATE TABLE "StockTxn" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockTxnType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTxn_productId_createdAt_idx" ON "StockTxn"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockTxn" ADD CONSTRAINT "StockTxn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
