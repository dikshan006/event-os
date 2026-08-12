import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { distributed } from "@/lib/ratelimit";
import { storageConfigured } from "@/lib/storage-config";
import { log } from "@/lib/logger";

/**
 * Readiness, as distinct from liveness.
 *
 * `/api/health` answers "is this instance alive" — one query, fast, safe to
 * poll every ten seconds. This answers the different question a deploy gate or
 * an on-call engineer asks: "is this instance configured to do its job". A
 * process can be perfectly alive and completely unable to send an invitation
 * because a key is missing.
 *
 * The distinction matters at deploy time. A missing `RESEND_API_KEY` does not
 * make the site fall over; it makes invitations silently fail, which is worse,
 * because nothing pages anyone. This surfaces that as a state rather than
 * waiting for a planner to report it.
 *
 * Degraded, not down. Missing optional configuration returns 200 with the
 * detail — the app genuinely works without email, it just cannot send. Only a
 * missing database is a 503, because nothing works without one.
 *
 * Names of variables, never values, and never whether a *value* is valid — that
 * would need a live call to each provider on an unauthenticated endpoint, which
 * is a free way to make us pay someone else's rate limit.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const started = Date.now();

  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    auth: Boolean(process.env.AUTH_SECRET),
    email: Boolean(process.env.RESEND_API_KEY),
    /**
     * Asked of the same function `storage()` uses to choose a driver.
     *
     * This line used to carry its own copy of the rule and had drifted from it:
     * it missed `BLOB_STORE_ID`, so a Blob store connected on Vercel over OIDC
     * — no token issued, because none is needed there — reported `false` while
     * uploads worked. It also accepted `S3_BUCKET` on its own, which would have
     * reported `true` for a bucket with no credentials behind it.
     */
    storage: storageConfigured(),
    payments: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    distributedRateLimit: distributed,
  };

  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (err) {
    log.error("ready.db_unreachable", { err });
  }

  // Everything the app cannot run at all without.
  const essential = db && configured.auth;
  // Everything a planner would expect to work on their first day.
  const complete = essential && configured.email && configured.storage;

  return NextResponse.json(
    {
      status: !essential ? "unavailable" : complete ? "ready" : "degraded",
      db: db ? "ok" : "unreachable",
      configured,
      ms: Date.now() - started,
    },
    { status: essential ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
