-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('DOG_FOOD', 'CAT_FOOD', 'OTHER');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "discountPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxPct" INTEGER NOT NULL DEFAULT 0;
