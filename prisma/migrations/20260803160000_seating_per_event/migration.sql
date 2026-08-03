-- Seating moves from the wedding to the event.
--
-- A wedding has a ceremony and a cocktail hour with no tables, a reception
-- dinner with tables, and possibly a farewell brunch with a different set. The
-- previous shape (one table list per wedding, one tableId per guest) could not
-- express that.
--
-- The previous seating feature never functioned in production — the page threw
-- on every render before any query ran — so there is no seating data to
-- preserve. These statements are written to succeed whether or not the earlier
-- migration was ever applied.

-- Old shape, if it exists.
ALTER TABLE "Guest" DROP CONSTRAINT IF EXISTS "Guest_tableId_fkey";
DROP INDEX IF EXISTS "Guest_tableId_idx";
ALTER TABLE "Guest" DROP COLUMN IF EXISTS "tableId";
ALTER TABLE "Guest" DROP COLUMN IF EXISTS "seatOrder";
DROP TABLE IF EXISTS "Table";

-- TableShape may already exist from the earlier migration.
DO $$ BEGIN
  CREATE TYPE "TableShape" AS ENUM ('ROUND', 'RECTANGLE', 'SQUARE', 'HEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A table belongs to exactly one event.
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    -- Denormalized so wedding-wide counts do not have to join through events.
    "weddingId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "shape" "TableShape" NOT NULL DEFAULT 'ROUND',
    "note" TEXT,
    -- Normalised 0-1 floor-plan coordinates, null until a table is placed.
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Table_eventId_sortOrder_idx" ON "Table"("eventId", "sortOrder");
CREATE INDEX "Table_weddingId_idx" ON "Table"("weddingId");
CREATE INDEX "Table_studioId_idx" ON "Table"("studioId");

ALTER TABLE "Table" ADD CONSTRAINT "Table_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One guest, at one table, for one event.
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    -- Denormalized from the table purely to make the unique constraint below
    -- possible: it is what stops a guest being seated twice at one event.
    "eventId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "seatOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- The rule, enforced by Postgres rather than by a service check.
CREATE UNIQUE INDEX "Seat_guestId_eventId_key" ON "Seat"("guestId", "eventId");
CREATE INDEX "Seat_tableId_seatOrder_idx" ON "Seat"("tableId", "seatOrder");
CREATE INDEX "Seat_studioId_idx" ON "Seat"("studioId");

-- Removing a table or a guest removes the seat, never the other record.
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
