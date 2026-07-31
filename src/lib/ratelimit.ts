/**
 * Minimal in-memory sliding-window limiter. Per-instance (resets on deploy,
 * not shared across serverless instances) — an honest V1 tradeoff, documented
 * in AUDIT.md; swap for Upstash/Redis when scaling horizontally.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

// Opportunistic cleanup so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();
