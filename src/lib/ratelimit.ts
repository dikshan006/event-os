/**
 * Rate limiting, distributed when it can be and honest when it cannot.
 *
 * The previous implementation was a `Map` in module scope. On one long-lived
 * server that is a real limiter; on Vercel it is not. Each serverless instance
 * gets its own map, so an attacker spreading requests across instances gets the
 * limit multiplied by however many instances happen to be warm, and every
 * deployment resets every counter. It was documented as a V1 tradeoff, which is
 * the right thing to do about a known weakness and not a substitute for fixing
 * it.
 *
 * This talks to Upstash Redis over its REST API when `UPSTASH_REDIS_REST_URL`
 * and `UPSTASH_REDIS_REST_TOKEN` are set, and falls back to the in-memory
 * behaviour when they are not. The fallback matters: local development and CI
 * have no Redis, and a limiter that threw without one would turn a missing
 * environment variable into an outage.
 *
 * REST rather than a Redis client, because a serverless function cannot hold a
 * TCP connection across invocations — the connection setup would cost more than
 * the check it is protecting.
 *
 * Fixed window (`INCR` plus `EXPIRE` on first hit) rather than sliding. A
 * sliding window is more precise at the boundary and costs more round trips;
 * for "stop this address hammering the login form" that precision buys nothing.
 */

export type Decision = {
  /** Whether the caller may proceed. */
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window resets. Suitable for a `Retry-After` header. */
  retryAfter: number;
};

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Whether counters are shared across instances. Surfaced on the readiness probe. */
export const distributed = Boolean(REST_URL && REST_TOKEN);

/* -------------------------------------------------------------- in memory -- */

const buckets = new Map<string, { count: number; resetAt: number }>();

function localConsume(key: string, limit: number, windowMs: number): Decision {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

// Opportunistic cleanup so the map cannot grow unbounded on a warm instance.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();

/* ------------------------------------------------------------------ redis -- */

/**
 * One pipelined round trip: increment, set the expiry only if this call created
 * the key, and read the remaining TTL.
 *
 * `EXPIRE ... NX` is load-bearing. Setting the expiry unconditionally would
 * extend the window on every request, so a caller hammering the endpoint would
 * hold their own counter open forever and never be released. Issuing INCR and
 * EXPIRE as two separate requests has the mirror-image failure: a crash between
 * them leaves a counter with no expiry at all, which is a permanent lockout for
 * whoever owns that key.
 */
async function redisConsume(key: string, limit: number, windowMs: number): Promise<Decision> {
  const seconds = Math.max(1, Math.ceil(windowMs / 1000));
  const res = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${REST_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(seconds), "NX"],
      ["TTL", key],
    ]),
    // A limiter that hangs is worse than a limiter that is absent: it turns
    // every request into a timeout. Well under any sane function budget.
    signal: AbortSignal.timeout(1500),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`upstash responded ${res.status}`);

  const body = (await res.json()) as Array<{ result?: number; error?: string }>;
  const count = Number(body[0]?.result ?? 0);
  const ttl = Number(body[2]?.result ?? seconds);

  return count > limit
    ? { ok: false, remaining: 0, retryAfter: ttl > 0 ? ttl : seconds }
    : { ok: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
}

/* -------------------------------------------------------------------- api -- */

/**
 * Consume one unit against `key`.
 *
 * Fails **open** onto the in-memory limiter if Redis is unreachable, and that
 * is deliberate. A limiter exists to blunt abuse; if the limiter itself is
 * down, refusing every request converts a dependency blip into a total outage
 * and hands an attacker a far better denial of service than the one being
 * prevented. Degrading to the old per-instance behaviour is a weaker limit, not
 * no limit, and the degradation is logged so it cannot pass unnoticed.
 */
export async function consume(key: string, limit: number, windowMs: number): Promise<Decision> {
  if (!distributed) return localConsume(key, limit, windowMs);
  try {
    return await redisConsume(key, limit, windowMs);
  } catch (err) {
    const { log } = await import("./logger");
    // The key's prefix only — the suffix is an IP or an invite code.
    log.warn("ratelimit.redis_unavailable", { err, bucket: key.split(":")[0] });
    return localConsume(key, limit, windowMs);
  }
}

/**
 * The original boolean signature, so existing call sites read the same way.
 * `true` means allowed. Now asynchronous: every caller is already inside a
 * server action or a route handler, so awaiting costs nothing.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  return (await consume(key, limit, windowMs)).ok;
}

/**
 * Clear a key early.
 *
 * Called when a login succeeds, so a person who mistypes their password twice
 * and then gets it right is not left carrying two-thirds of a lockout.
 */
export async function reset(key: string): Promise<void> {
  buckets.delete(key);
  if (!distributed) return;
  try {
    await fetch(`${REST_URL}/del/${encodeURIComponent(key)}`, {
      headers: { authorization: `Bearer ${REST_TOKEN}` },
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
  } catch {
    // Best effort. A key left to live out its window is harmless.
  }
}

/** Test seam. */
export const __clearForTest = () => buckets.clear();
