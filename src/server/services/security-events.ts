import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Security events.
 *
 * Written to the existing `AuditLog` table rather than a new one. A separate
 * table would need a migration, a second admin screen and a second retention
 * policy, and would then need joining back to the audit trail every time
 * anybody asked the only question that matters — "what happened around this
 * account, in order". One timeline is more useful than two, and the row already
 * has the shape: actor, action, target, metadata, time.
 *
 * The `SECURITY.` prefix on every action name is what separates them, so the
 * platform activity view can filter them in or out with a `startsWith`.
 *
 * Two rules about content, both about not making the log itself a liability:
 *
 *   - No credentials, ever. Not the password, not a hash, not a prefix of one.
 *     A failed login records *that* it failed, never what was tried.
 *   - Email addresses are hashed, not stored. The security log answers "how
 *     many failures against this account" without becoming a list of everyone
 *     who has ever tried to sign in. `AuditLog` is readable by the platform
 *     admin; the fewer secrets and the less PII it holds, the less a compromised
 *     admin session is worth.
 */

export type SecurityEvent =
  | "SECURITY.LOGIN_FAILED"
  | "SECURITY.LOGIN_LOCKED"
  | "SECURITY.LOGIN_SUCCEEDED_AFTER_FAILURES"
  | "SECURITY.RESET_TOKEN_INVALID"
  | "SECURITY.INVITE_CODE_INVALID"
  | "SECURITY.RATE_LIMIT_TRIPPED"
  | "SECURITY.WEBHOOK_SIGNATURE_INVALID";

/**
 * A stable, non-reversible handle for an identifier.
 *
 * Truncated to 12 hex characters: enough to correlate events against one
 * account across a log, far too little to enumerate addresses from. Salted with
 * `AUTH_SECRET` so the hashes are useless outside this deployment — without a
 * salt, a stolen log could be matched against a precomputed table of common
 * addresses.
 */
export async function pseudonymise(value: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev")
    .update(value.trim().toLowerCase())
    .digest("hex")
    .slice(0, 12);
}

export async function recordSecurityEvent(
  event: SecurityEvent,
  detail: {
    /** Hashed before storage. Never write a raw address here. */
    email?: string;
    ip?: string;
    studioId?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  const subject = detail.email ? await pseudonymise(detail.email) : undefined;

  // Structured log first, and unconditionally. It reaches the drain — and any
  // alerting attached to it — even if the database is the thing that is broken,
  // which is exactly when a burst of security events is most informative.
  log.warn(event, {
    subject,
    ip: detail.ip,
    studioId: detail.studioId,
    ...detail.metadata,
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: event,
        studioId: detail.studioId ?? null,
        targetId: detail.targetId ?? null,
        metadata: {
          subject,
          // Truncated to a /24 (or /48 for v6). Enough to spot one source
          // hammering the login form; not a precise location for one person.
          ip: detail.ip ? coarsenIp(detail.ip) : undefined,
          ...detail.metadata,
        } as never,
      },
    });
  } catch (err) {
    // Never let recording an event break the request that produced it. A failed
    // login must still return "wrong password", not a 500 that tells an
    // attacker something interesting about our internals.
    log.error("security_event.persist_failed", { err, event });
  }
}

/** `203.0.113.47` → `203.0.113.0`; `2001:db8:1:2::1` → `2001:db8:1::`. */
export function coarsenIp(ip: string): string {
  const addr = ip.split(",")[0].trim();
  if (addr.includes(":")) return addr.split(":").slice(0, 3).join(":") + "::";
  const parts = addr.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : addr;
}
