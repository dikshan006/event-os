-- Versioned pricing, and the subscriptions that hang off it.
--
-- Until now a price was a single mutable integer on a singleton settings row.
-- That works for exactly one product with one price and no memory: raising the
-- fee changed what every future publish cost, which was the whole feature.
--
-- It does not survive subscriptions. A studio that agreed to $149 a month has
-- agreed to $149 a month, and an admin editing the platform default in six
-- weeks must not silently reprice them. So a price stops being a number that
-- gets edited and becomes a row that gets superseded: changing a price inserts
-- a new PricePlan and archives the old one, and anything already sold keeps
-- pointing at the row it was sold on.
--
-- The `activeKey` column is how "exactly one current price per scope" becomes a
-- database constraint. It holds '<kind>:GLOBAL' or '<kind>:<studioId>' while a
-- row is current and NULL once archived; because Postgres treats NULLs in a
-- unique index as distinct, unlimited archived rows coexist while two rows can
-- never both be live for the same scope. The obvious alternative — a boolean
-- with a partial unique index — is raw SQL the Prisma schema cannot describe,
-- and `prisma migrate dev` would read the difference as drift and offer to
-- reset the developer's database.
--
-- Purely additive. `PlatformSetting.pricePerWeddingCents` is left in place and
-- seeded forward rather than dropped, so an admin who had already moved off $99
-- keeps their number and this migration can be undone by hand.

CREATE TYPE "PricePlanKind" AS ENUM ('PER_WEDDING', 'MONTHLY', 'YEARLY');

-- Mirrors Stripe's own statuses one-for-one, including the ones we hope never
-- to see. Collapsing them here would force the webhook to decide what
-- 'incomplete_expired' means, and that reading belongs where it is used.
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');

CREATE TABLE "PricePlan" (
    "id" TEXT NOT NULL,
    "kind" "PricePlanKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "studioId" TEXT,
    "stripePriceId" TEXT,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "PricePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "pricePlanId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD COLUMN "stripeInvoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "pricePlanId" TEXT;

CREATE UNIQUE INDEX "PricePlan_stripePriceId_key" ON "PricePlan"("stripePriceId");
CREATE UNIQUE INDEX "PricePlan_activeKey_key" ON "PricePlan"("activeKey");
CREATE INDEX "PricePlan_kind_studioId_idx" ON "PricePlan"("kind", "studioId");

CREATE UNIQUE INDEX "Subscription_studioId_key" ON "Subscription"("studioId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

CREATE UNIQUE INDEX "ProcessedWebhookEvent_stripeEventId_key" ON "ProcessedWebhookEvent"("stripeEventId");
CREATE INDEX "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt");

CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key" ON "Payment"("stripeInvoiceId");
CREATE INDEX "Payment_pricePlanId_idx" ON "Payment"("pricePlanId");

ALTER TABLE "PricePlan" ADD CONSTRAINT "PricePlan_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: a plan that has billed somebody must not be deletable
-- out from under the subscription or the receipt that references it.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pricePlanId_fkey" FOREIGN KEY ("pricePlanId") REFERENCES "PricePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_pricePlanId_fkey" FOREIGN KEY ("pricePlanId") REFERENCES "PricePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────── seed defaults ──
--
-- The application reads prices exclusively through these rows, so a database
-- without them has no prices at all and `resolvePrice()` throws rather than
-- guessing. Seeding here rather than in `prisma/seed.ts` is deliberate: seed.ts
-- is for development fixtures and is not run on deploy, and production needs a
-- price the moment this migration lands.

INSERT INTO "PlatformSetting" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

-- Carried forward from the old singleton column, not hard-coded to 9900, so an
-- admin who had already set their own per-wedding price keeps it.
INSERT INTO "PricePlan" ("id", "kind", "amountCents", "currency", "activeKey", "createdBy")
SELECT 'plan_global_per_wedding_v1', 'PER_WEDDING', "pricePerWeddingCents", 'usd', 'PER_WEDDING:GLOBAL', 'Platform default (migration)'
FROM "PlatformSetting" WHERE "id" = 1;

-- No Stripe Price id yet for these two. They are created lazily on first use
-- and written back, because this migration runs during the build with no
-- network access to Stripe and no guarantee the keys are even configured.
INSERT INTO "PricePlan" ("id", "kind", "amountCents", "currency", "activeKey", "createdBy") VALUES
  ('plan_global_monthly_v1', 'MONTHLY', 14900, 'usd', 'MONTHLY:GLOBAL', 'Platform default (migration)'),
  ('plan_global_yearly_v1',  'YEARLY',  99900, 'usd', 'YEARLY:GLOBAL',  'Platform default (migration)');
