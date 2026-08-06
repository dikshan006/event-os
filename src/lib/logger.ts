import "server-only";

/**
 * Structured logging.
 *
 * One line of JSON per event, because the only consumer that matters in
 * production is a log search box. `console` is the transport deliberately:
 * Vercel captures stdout and forwards it to whatever drain is attached, so a
 * logging library would add a dependency and a buffer without adding a
 * destination.
 *
 * The reason this exists rather than bare `console.error` is redaction. An
 * error thrown near a database call or an email send routinely carries a
 * connection string, an API key or a guest's email address in its message or
 * its properties, and `console.error(err)` prints all of it. Log drains are
 * searchable by anyone with dashboard access and are retained for months, so a
 * secret that reaches one is a secret that has to be rotated.
 */

type Level = "debug" | "info" | "warn" | "error";

/**
 * Keys whose values never appear in a log line, matched case-insensitively as
 * substrings so `DATABASE_URL`, `stripeSecretKey` and `x-api-token` are all
 * caught by the same three entries.
 */
const SECRET_KEY =
  /pass|secret|token|key|auth|cookie|session|signature|credential|dsn|database|datasource|direct_url|conn(?:ection)?_?str/i;

/** Values that look like a secret regardless of what they are called. */
const SECRET_VALUE: RegExp[] = [
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss):\/\/[^\s"]+/gi, // connection strings
  /\bsk_(?:live|test)_[A-Za-z0-9]+/g,                                          // Stripe secret
  /\bwhsec_[A-Za-z0-9]+/g,                                                     // Stripe webhook
  /\bre_[A-Za-z0-9_-]{16,}/g,                                                  // Resend
  /\bvercel_blob_rw_[A-Za-z0-9_-]+/gi,                                         // Vercel Blob
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g,              // JWT
  /\bBearer\s+[A-Za-z0-9._-]+/gi,
];

/** Email addresses are PII, not secrets, but they do not belong in logs either. */
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

const REDACTED = "[redacted]";

function scrubString(s: string): string {
  let out = s;
  for (const re of SECRET_VALUE) out = out.replace(re, REDACTED);
  return out.replace(EMAIL, "[email]");
}

/**
 * Depth- and breadth-limited so a cyclic or enormous object cannot turn one log
 * line into a denial of service against our own log budget.
 */
function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 4) return "[depth]";
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.slice(0, 50).map(v => scrub(v, depth + 1, seen));

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      // The stack names our own files and line numbers, which is the useful
      // part; it can also quote source, so it gets scrubbed like anything else.
      stack: value.stack ? scrubString(value.stack).split("\n").slice(0, 12).join("\n") : undefined,
      cause: value.cause ? scrub(value.cause, depth + 1, seen) : undefined,
    };
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    out[k] = SECRET_KEY.test(k) ? REDACTED : scrub(v, depth + 1, seen);
  }
  return out;
}

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    ...(fields ? (scrub(fields) as Record<string, unknown>) : null),
  });
  // eslint-disable-next-line no-console -- this module is the logging transport
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) =>
    process.env.NODE_ENV !== "production" && emit("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};

/** Exported for the tests, which are the only reason to reach the scrubber directly. */
export const __scrubForTest = scrub;
