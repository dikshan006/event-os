-- Planner-written travel details. All optional: the Travel section hides itself
-- when every one is empty, replacing the previously hard-coded placeholder copy.
ALTER TABLE "Wedding" ADD COLUMN "venueNote" TEXT;
ALTER TABLE "Wedding" ADD COLUMN "accommodation" TEXT;
ALTER TABLE "Wedding" ADD COLUMN "travelNote" TEXT;

-- Per-photograph measurements used to adapt the image treatment.
-- Nullable: photos uploaded before this column existed render with neutral
-- defaults, so no backfill is required.
ALTER TABLE "Photo" ADD COLUMN "tone" JSONB;
