import "server-only";
import { log } from "./logger";

/**
 * What the application refuses to start without, and what it merely complains
 * about.
 *
 * The failure this prevents is specific and has happened to every project that
 * has not prevented it: a variable is missing in the production environment, the
 * build succeeds because a build does not read it, and the first person to
 * discover the problem is a user hitting a 500. Configuration errors should be
 * loud at boot, on our side of the deploy, not quiet until traffic arrives.
 *
 * Two tiers, because they fail differently:
 *
 *   REQUIRED — the app cannot serve a correct response without it. Missing one
 *   in production throws, which fails the deploy rather than serving a broken
 *   app. `AUTH_SECRET` is the sharp one: without it Auth.js in development
 *   silently derives a key, so sessions "work" locally and every deployment
 *   signs with a different key in production, logging everyone out at random.
 *
 *   EXPECTED — a real feature is off without it, but the app is otherwise sound.
 *   These warn once at startup and appear in /api/ready. Email is the example:
 *   invitations silently do nothing, which is worse than an error, but it is not
 *   worth refusing to boot a site whose wedding pages all still work.
 *
 * Never throws outside production. A contributor running the app locally for the
 * first time should get a working site and a list of what is not configured, not
 * a stack trace.
 */

const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "APP_URL"] as const;

const EXPECTED: { name: string; feature: string }[] = [
  { name: "RESEND_API_KEY", feature: "invitations and password-reset emails" },
  { name: "STRIPE_SECRET_KEY", feature: "publishing payments" },
  { name: "STRIPE_WEBHOOK_SECRET", feature: "confirming payments" },
];

/** Storage is satisfied by either provider, so it cannot be a flat name check. */
const storageConfigured = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      Object.keys(process.env).some(k => k.endsWith("BLOB_READ_WRITE_TOKEN")) ||
      (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY),
  );

export type EnvReport = {
  ok: boolean;
  missingRequired: string[];
  missingExpected: string[];
};

export function checkEnv(): EnvReport {
  // Widened from the readonly tuple: the entries below are not just names but
  // names with a reason attached, and they belong in the same list a caller
  // prints.
  const missingRequired: string[] = REQUIRED.filter(n => !process.env[n]?.trim());
  const missingExpected = EXPECTED.filter(e => !process.env[e.name]?.trim()).map(e => e.name);
  if (!storageConfigured()) missingExpected.push("BLOB_READ_WRITE_TOKEN or S3_*");

  /**
   * A production `AUTH_SECRET` that is short, or is one of the placeholders that
   * get copied out of a README and never changed, is worse than a missing one:
   * missing fails loudly, weak fails silently and forges sessions.
   */
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.AUTH_SECRET ?? "";
    const placeholder = /^(changeme|secret|dev|test|placeholder|your[-_]?secret)/i.test(secret);
    if (secret && (secret.length < 32 || placeholder)) {
      missingRequired.push("AUTH_SECRET (present but too weak — generate with `openssl rand -base64 32`)");
    }
    // A localhost APP_URL in production puts localhost links into real emails.
    if (/localhost|127\.0\.0\.1/.test(process.env.APP_URL ?? "")) {
      missingRequired.push("APP_URL (points at localhost in production)");
    }

    /**
     * Rate limiting has to be shared across instances in production.
     *
     * `lib/ratelimit` falls back to a per-process `Map` when Upstash is absent,
     * which is a real limiter on one long-lived server and very nearly no
     * limiter on Vercel: every serverless instance keeps its own counters, so
     * the effective limit is the configured one multiplied by however many
     * instances happen to be warm, and every deployment resets all of them. The
     * login throttle is the one that matters — a credential-stuffing run spread
     * across instances walks through a limit that looks correct in the source.
     *
     * That fallback is right for local development and CI, where there is no
     * Redis and a limiter that threw would turn a missing variable into an
     * outage. It is wrong for production, where the fallback is silent: nothing
     * distinguishes "rate limited" from "rate limited thirty times over".
     *
     * So production requires both variables and refuses to boot without them,
     * which fails the deploy rather than shipping a limiter that quietly does
     * not hold. The runtime fallback in `consume()` is untouched and still
     * catches Redis being *unreachable* — an outage mid-flight degrades to the
     * weaker limiter rather than refusing every request, which is the correct
     * trade. This only closes the case where it was never configured at all.
     */
    const upstash = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"].filter(
      n => !process.env[n]?.trim(),
    );
    if (upstash.length) {
      missingRequired.push(
        `${upstash.join(" and ")} (rate limiting would be per-instance, so every limit multiplies by instance count)`,
      );
    }
  }

  return { ok: missingRequired.length === 0, missingRequired, missingExpected };
}

/**
 * Run the check once, at module load, from instrumentation.
 *
 * Names only, never values — this output goes to a log drain, and the whole
 * point of the exercise is not to put secrets there.
 */
export function assertEnv(): void {
  const report = checkEnv();

  if (report.missingExpected.length) {
    log.warn("env.incomplete", {
      missing: report.missingExpected,
      note: "The app will run; these features are disabled.",
    });
  }

  if (report.ok) return;

  if (process.env.NODE_ENV === "production") {
    // Thrown, not logged. In production a missing AUTH_SECRET is a security
    // defect, and a process that refuses to start is the correct response.
    throw new Error(
      `Missing required environment variables: ${report.missingRequired.join(", ")}. ` +
        "Set them in the deployment environment and redeploy.",
    );
  }

  log.warn("env.missing_required", {
    missing: report.missingRequired,
    note: "Fatal in production; continuing because this is not production.",
  });
}
