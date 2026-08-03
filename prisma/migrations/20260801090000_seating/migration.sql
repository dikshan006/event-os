-- CreateEnum
CREATE TYPE "TableShape" AS ENUM ('ROUND', 'RECTANGLE', 'SQUARE', 'HEAD');

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 8,
    "shape" "TableShape" NOT NULL DEFAULT 'ROUND',
    "note" TEXT,
    -- Normalised 0-1 floor-plan coordinates, null until a table is placed.
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Table_weddingId_sortOrder_idx" ON "Table"("weddingId", "sortOrder");

-- CreateIndex
CREATE INDEX "Table_studioId_idx" ON "Table"("studioId");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: a guest sits at no more than one table. The nullable foreign key
-- makes "two tables at once" unrepresentable rather than merely disallowed.
ALTER TABLE "Guest" ADD COLUMN "tableId" TEXT;
ALTER TABLE "Guest" ADD COLUMN "seatOrder" INTEGER NOT NULL DEFAULT 0;

-- SET NULL, not CASCADE: deleting a table returns its guests to the unassigned
-- pool. Cascading here would delete the guests themselves.
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: the seating page reads guests by table constantly.
CREATE INDEX "Guest_tableId_idx" ON "Guest"("tableId");
