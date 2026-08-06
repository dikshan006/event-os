-- Studio branding: a logo, and the typeface the studio's name is set in.
--
-- Every column is nullable or defaulted, so this is safe to apply to a live
-- database with existing studios ahead of the deploy that reads them: an old
-- application instance ignores the new columns, a new one finds sensible values
-- already there. There is no backfill, because "no logo" is a legitimate
-- permanent state, not missing data.
--
-- `logoUrl` already existed and was never written to by any code path; it is
-- kept and now genuinely holds a URL. The three columns added beside it are
-- what make that URL maintainable — the storage prefix so a replaced logo can
-- have its derivatives deleted, and the intrinsic size so the <img> can be
-- given dimensions and not shift the page as it loads.
ALTER TABLE "Studio" ADD COLUMN "logoKey" TEXT;
ALTER TABLE "Studio" ADD COLUMN "logoWidth" INTEGER;
ALTER TABLE "Studio" ADD COLUMN "logoHeight" INTEGER;

-- A validated String rather than an enum: see the note on the model. The
-- default matches the house serif every studio is already rendered in, so this
-- migration changes nothing visually until a planner chooses otherwise.
ALTER TABLE "Studio" ADD COLUMN "brandFont" TEXT NOT NULL DEFAULT 'CLASSIC';
