-- Recorded agreement to the Terms of Service and Privacy Policy.
--
-- A boolean on User would have been smaller and wrong. The question that gets
-- asked later is never "did they agree" — it is "what exactly had this person
-- agreed to on the day they did X", and a flag cannot answer that. So this is
-- append-only: one row per user per document per version, and publishing a new
-- version leaves every earlier agreement intact.
--
-- Two documents rather than one combined record, because they version
-- independently. A privacy policy changes when a sub-processor changes, which
-- has nothing to do with the terms; storing them together would force
-- re-acceptance of both every time either moved.
--
-- The unique constraint is what makes acceptance idempotent. A double-click, a
-- retried request or a refresh cannot write a second row for the same
-- agreement, so the write path needs no read-then-check of its own.
--
-- No IP address and no user-agent column, deliberately. They are the obvious
-- additions for evidentiary weight and they are also personal data this product
-- has no other reason to hold. User, document, version and timestamp are what
-- is recorded.

CREATE TYPE "LegalDocument" AS ENUM ('TERMS', 'PRIVACY');

CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "document" "LegalDocument" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalAcceptance_userId_document_version_key"
    ON "LegalAcceptance"("userId", "document", "version");

CREATE INDEX "LegalAcceptance_userId_idx" ON "LegalAcceptance"("userId");

-- CASCADE: an acceptance record describes a person, and deleting the account is
-- how that person's data is removed. Unlike AuditLog, this is not a record of
-- what the platform did — it is a record about them, so it goes with them.
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No backfill. Every existing planner is deliberately left without a row, so
-- the gate stops them on their next request and they accept explicitly. Seeding
-- agreement on their behalf would record consent that was never given, which is
-- the one thing this table exists not to do.
