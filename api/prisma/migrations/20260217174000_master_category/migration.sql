-- CreateTable
CREATE TABLE "ProductCategoryMaster" (
    "code" "ProductCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategoryMaster_pkey" PRIMARY KEY ("code")
);

-- Seed defaults
INSERT INTO "ProductCategoryMaster" ("code", "name", "isActive", "createdAt", "updatedAt") VALUES
('DOG_FOOD', 'Kategori A', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('CAT_FOOD', 'Kategori B', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('OTHER', 'Lainnya', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
