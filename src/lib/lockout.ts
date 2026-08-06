import { consume, reset } from "./ratelimit";

/**
 * Progressive throttling on failed sign-in.
 *
 * Two counters rather than one, because the two attacks are different shapes
 * and a single counter cannot stop both:
 *
 *   - **Per account.** Someone guessing one person's password. Tight, because
 *     a legitimate person does not need twenty attempts.
 *   - **Per address.** Someone spraying one common password across many
 *     accounts. The per-account counter never trips on this — each account sees
 *     a single failure — so without an address counter, credential stuffing
 *     walks straight through.
 *
 * Throttled, not locked. A hard lock keyed on the account is itself a denial of
 * service: anyone who knows a planner's email address can lock them out of
 * their own studio on the morning of a wedding, at will, forever. Delay
 * escalates instead, which makes automated guessing useless while leaving a
 * real person a way in — they wait, or they use the reset link, which is a
 * different path with its own limiter.
 *
 * Both counters are cleared on success, so a person who mistypes twice and then
 * gets it right starts clean rather than carrying two-thirds of a lockout into
 * their next session.
 */

/** Failures allowed against one account before the delay starts climbing. */
const ACCOUNT_SOFT = 5;
/** Failures against one account in the window before it is refused outright. */
const ACCOUNT_HARD = 10;
const ACCOUNT_WINDOW_MS = 15 * 60_000;

/** Failures from one address across all accounts — credential stuffing. */
const IP_HARD = 30;
const IP_WINDOW_MS = 15 * 60_000;

export type LoginGate =
  | { allow: true; delayMs: number }
  | { allow: false; retryAfter: number; reason: "account" | "address" };

const accountKey = (subject: string) => `login:acct:${subject}`;
const addressKey = (ip: string) => `login:ip:${ip}`;

/**
 * Called *before* the password is checked.
 *
 * `subject` is the pseudonymised email — the raw address never becomes a Redis
 * key, because keys end up in memory dumps and slow-query logs like anything
 * else.
 */
export async function gateLogin(subject: string, ip: string): Promise<LoginGate> {
  const [account, address] = await Promise.all([
    consume(accountKey(subject), ACCOUNT_HARD, ACCOUNT_WINDOW_MS),
    consume(addressKey(ip), IP_HARD, IP_WINDOW_MS),
  ]);

  if (!address.ok) return { allow: false, retryAfter: address.retryAfter, reason: "address" };
  if (!account.ok) return { allow: false, retryAfter: account.retryAfter, reason: "account" };

  // `remaining` counts down from the hard limit; failures so far is the
  // complement. Delay begins only after the soft threshold, so ordinary
  // mistyping costs nothing.
  const used = ACCOUNT_HARD - account.remaining;
  const over = Math.max(0, used - ACCOUNT_SOFT);
  // 0, 250ms, 500ms, 1s, 2s, 4s — capped so a request cannot outlive the
  // function's own timeout and turn into a 504.
  const delayMs = over === 0 ? 0 : Math.min(4000, 125 * 2 ** over);

  return { allow: true, delayMs };
}

/** Applies the escalating delay. Separated so it is testable without waiting. */
export async function applyDelay(ms: number): Promise<void> {
  if (ms > 0) await new Promise(r => setTimeout(r, ms));
}

/** Called after a successful sign-in. */
export async function clearLoginFailures(subject: string, ip: string): Promise<void> {
  await Promise.all([reset(accountKey(subject)), reset(addressKey(ip))]);
}

export const LOCKOUT_LIMITS = { ACCOUNT_SOFT, ACCOUNT_HARD, IP_HARD, ACCOUNT_WINDOW_MS };
