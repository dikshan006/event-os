-- Gift claims, on the honour system: a guest buys from the retailer and comes
-- back to say so. No payment, no account, and always reversible by the planner.
ALTER TABLE "RegistryItem"
  ADD COLUMN "featured"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "purchasedBy"  TEXT,
  ADD COLUMN "purchasedAt"  TIMESTAMP(3),
  ADD COLUMN "purchaseNote" TEXT;

CREATE INDEX "RegistryItem_weddingId_sortOrder_idx"   ON "RegistryItem"("weddingId", "sortOrder");
CREATE INDEX "RegistryItem_weddingId_purchasedAt_idx" ON "RegistryItem"("weddingId", "purchasedAt");
