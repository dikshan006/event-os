-- Access requests from the public site. Nothing here grants access; a row is a
-- lead until a platform admin acts on it through the ordinary planner path.
CREATE TYPE "AccessRequestStatus" AS ENUM ('NEW', 'INVITED', 'DECLINED');

CREATE TABLE "AccessRequest" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "company"    TEXT,
    "website"    TEXT,
    "volume"     TEXT,
    "message"    TEXT,
    "status"     "AccessRequestStatus" NOT NULL DEFAULT 'NEW',
    "reviewedAt" TIMESTAMP(3),
    "note"       TEXT,
    "ip"         TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");
