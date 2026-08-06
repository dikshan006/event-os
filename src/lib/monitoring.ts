import "server-only";
import { log } from "./logger";

/**
 * Error monitoring, as a seam rather than a vendor.
 *
 * Nothing here imports Sentry. The reason is not indecision — it is that
 * choosing a monitoring vendor is an operational decision with a price, a data
 * processing agreement and a retention policy attached, and it should be made
 * by whoever signs those rather than baked into the code by whoever wrote it.
 * What the code owes is one place where every unexpected error arrives, so
 * attaching a vendor later is one function body rather than an audit of every
 * catch block.
 *
 * Until one is attached this reports to the structured log, which on Vercel is
 * already forwarded to whatever drain is configured — so alerting can be built
 * on it today without any vendor at all.
 *
 * To attach Sentry:
 *
 *   npm i @sentry/nextjs
 *   // in captureException, after the log call:
 *   Sentry.captureException(err, { tags: { area: ctx.area }, extra: ctx.detail })
 *
 * The redaction in `log` runs first either way, which is the point of routing
 * through here: a vendor SDK given a raw error object will happily transmit a
 * connection string in the message and a guest's address in the breadcrumbs.
 */

export type ErrorContext = {
  /** Coarse area, used as the alert grouping key. */
  area:
    | "auth" | "billing" | "email" | "photos" | "publishing"
    | "rsvp" | "webhook" | "storage" | "unknown";
  /** Never PII. Ids are fine; addresses and names are not. */
  detail?: Record<string, unknown>;
  /** Whether a person is currently waiting on this. Drives alert priority. */
  userFacing?: boolean;
};

export function captureException(err: unknown, ctx: ErrorContext) {
  log.error("exception", {
    area: ctx.area,
    userFacing: ctx.userFacing ?? true,
    err,
    ...ctx.detail,
  });
}

/**
 * Wrap an operation that is allowed to fail without failing the request.
 *
 * Graceful degradation, made explicit and greppable. A wedding site must still
 * render when the gallery's storage is unreachable; a dashboard must still load
 * when one widget's query times out. The alternative — a bare `try {} catch {}`
 * — silently swallows the error, which is how an outage lasts a week before
 * anyone notices.
 */
export async function degradeGracefully<T>(
  ctx: ErrorContext,
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    captureException(err, { ...ctx, userFacing: false });
    return fallback;
  }
}

/**
 * Retry with exponential backoff and full jitter.
 *
 * The jitter is the part that is easy to leave out and matters most. With a
 * fixed backoff, every caller that failed during an outage retries at the same
 * instant the moment it ends, and the thundering herd takes the dependency
 * straight back down. Randomising across the whole interval spreads them.
 *
 * `shouldRetry` defaults to conservative: a timeout or a 5xx is worth another
 * attempt, a 4xx is the same answer however many times it is asked.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  opts: {
    attempts?: number;
    baseMs?: number;
    maxMs?: number;
    shouldRetry?: (err: unknown) => boolean;
    onRetry?: (attempt: number, err: unknown) => void;
  } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 200;
  const maxMs = opts.maxMs ?? 4000;
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !shouldRetry(err)) break;
      const ceiling = Math.min(maxMs, baseMs * 2 ** i);
      const wait = Math.random() * ceiling; // full jitter
      opts.onRetry?.(i + 1, err);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function defaultShouldRetry(err: unknown): boolean {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === "number") return status === 408 || status === 429 || status >= 500;

  const name = (err as { name?: string })?.name ?? "";
  const message = String((err as { message?: string })?.message ?? "");
  return /abort|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed/i
    .test(`${name} ${message}`);
}
