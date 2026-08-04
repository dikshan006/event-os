-- Calendar and maps.
--
-- Events gain machine-readable instants alongside the display strings they have
-- always had. The display strings are deliberately left untouched: planners
-- write "Late" or "After the ceremony" and the guest site should keep showing
-- exactly that.
ALTER TABLE "Event"
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt"   TIMESTAMP(3),
  ADD COLUMN "address"  TEXT,
  ADD COLUMN "lat"      DOUBLE PRECISION,
  ADD COLUMN "lng"      DOUBLE PRECISION;

ALTER TABLE "Wedding"
  ADD COLUMN "venueAddress" TEXT,
  ADD COLUMN "venueLat"     DOUBLE PRECISION,
  ADD COLUMN "venueLng"     DOUBLE PRECISION,
  ADD COLUMN "timeZone"     TEXT NOT NULL DEFAULT 'UTC';

-- Best-effort backfill for events that already exist.
--
-- Only the unambiguous case is filled in: a time that looks like "7:00 PM" or
-- "19:00", anchored to the wedding's own date. Anything else is left NULL, and
-- the planner is shown a "needs a time" prompt in the schedule editor rather
-- than being given a confidently wrong value. Midnight is treated as no time.
UPDATE "Event" e
SET "startsAt" = (
  DATE_TRUNC('day', w."date")
  + make_interval(
      hours => (
        CASE
          WHEN e."time" ~* '^\s*([0-9]{1,2})\s*:\s*[0-9]{2}\s*(am)\s*$'
            THEN (substring(e."time" from '([0-9]{1,2})')::int % 12)
          WHEN e."time" ~* '^\s*([0-9]{1,2})\s*:\s*[0-9]{2}\s*(pm)\s*$'
            THEN (substring(e."time" from '([0-9]{1,2})')::int % 12) + 12
          WHEN e."time" ~ '^\s*([0-9]{1,2})\s*:\s*[0-9]{2}\s*$'
            THEN substring(e."time" from '([0-9]{1,2})')::int
        END
      ),
      mins => substring(e."time" from ':([0-9]{2})')::int
    )
)
FROM "Wedding" w
WHERE e."weddingId" = w."id"
  AND e."time" ~* '^\s*[0-9]{1,2}\s*:\s*[0-9]{2}\s*(am|pm)?\s*$';

CREATE INDEX "Event_weddingId_startsAt_idx" ON "Event"("weddingId", "startsAt");
