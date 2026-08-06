import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Liveness and readiness for an uptime monitor.
 *
 * The distinction matters and this endpoint answers the harder one. A route
 * that returns `{ ok: true }` from a constant proves the serverless function
 * booted, which is the thing least likely to be broken; it will happily report
 * healthy through a database outage, which is the thing most likely to be
 * broken. So it runs an actual query.
 *
 * `SELECT 1` rather than a model read: it exercises the connection pool and the
 * network path to Postgres without depending on any table existing, so a
 * migration in flight does not make the app look down.
 *
 * The body is deliberately thin. A health endpoint is unauthenticated by
 * necessity — a monitor cannot log in — so it must not become a free
 * reconnaissance surface. No version numbers, no dependency list, no error
 * detail: a caller learns whether the service is up and how long the check
 * took, and nothing about how it is built. The failure detail goes to the log,
 * where it is useful and access-controlled.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const started = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "ok", ms: Date.now() - started },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    log.error("health.db_unreachable", { err, ms: Date.now() - started });
    return NextResponse.json(
      { status: "degraded", db: "unreachable", ms: Date.now() - started },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

/** Monitors that poll with HEAD get the status code without the body. */
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
  } catch {
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
