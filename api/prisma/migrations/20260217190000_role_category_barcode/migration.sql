-- Role enum update
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EMPLOYEE';

-- Drop dependent FK first
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_category_fkey";

-- Convert Product.category enum -> text
ALTER TABLE "Product"
  ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT,
  ALTER COLUMN "category" SET DEFAULT 'OTHER';

-- Convert ProductCategoryMaster.code enum -> text
ALTER TABLE "ProductCategoryMaster"
  ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;

-- Add barcode column
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

-- Ensure unique barcode (nullable)
CREATE UNIQUE INDEX IF NOT EXISTS "Product_barcode_key" ON "Product"("barcode");

-- Recreate FK as text relation
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_category_fkey"
  FOREIGN KEY ("category") REFERENCES "ProductCategoryMaster"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep default category rows available
INSERT INTO "ProductCategoryMaster" ("code", "name", "isActive", "createdAt", "updatedAt") VALUES
('DOG_FOOD', 'Kategori A', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('CAT_FOOD', 'Kategori B', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('OTHER', 'Lainnya', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
