-- CreateEnum
CREATE TYPE "PhotoSlot" AS ENUM ('HERO', 'COUPLE', 'STORY', 'GALLERY');

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "slot" "PhotoSlot" NOT NULL,
    "basePath" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "blurData" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_weddingId_slot_sortOrder_idx" ON "Photo"("weddingId", "slot", "sortOrder");

-- CreateIndex
CREATE INDEX "Photo_studioId_idx" ON "Photo"("studioId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: new weddings get the Gallery section on by default.
-- Existing rows keep whatever the planner already chose; this only changes the default.
ALTER TABLE "Wedding" ALTER COLUMN "sections" SET DEFAULT ARRAY['COUNTDOWN', 'TRAVEL', 'FAQ', 'REGISTRY', 'CASH', 'GALLERY']::TEXT[];
