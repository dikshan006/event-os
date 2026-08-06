import "server-only";
import { prisma } from "@/lib/db";
import { inviteCode, GROUPS } from "@/lib/utils";
import { emails } from "@/lib/email";
import { emailBrandingFor } from "@/lib/branding";
import { rateLimit } from "@/lib/ratelimit";
import { UserError } from "@/lib/errors";
import { runOnce, invitationKey } from "./idempotency";
import { logAudit } from "./audit";
import type { z } from "zod";
import type { zGuest } from "@/lib/validators";

export function listGuests(studioId: string, weddingId: string, opts?: { q?: string; group?: string }) {
  return prisma.guest.findMany({
    where: {
      studioId, weddingId,
      ...(opts?.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" } }, { email: { contains: opts.q, mode: "insensitive" } }] } : {}),
      ...(opts?.group ? { groups: { has: opts.group } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { rsvp: true },
  });
}

export async function addGuest(studioId: string, weddingId: string, input: z.infer<typeof zGuest>) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  return prisma.guest.create({
    data: {
      weddingId, studioId,
      name: input.name, email: input.email || null, phone: input.phone || null,
      groups: input.groups, inviteCode: inviteCode(),
    },
  });
}

export async function updateGuest(studioId: string, guestId: string, input: z.infer<typeof zGuest>) {
  await prisma.guest.updateMany({
    where: { id: guestId, studioId },
    data: { name: input.name, email: input.email || null, phone: input.phone || null, groups: input.groups },
  });
}

/**
 * CSV import — one guest per line: Name, email, Group|Group.
 * Returns per-line results so the UI can report exactly what happened.
 */
export async function importGuests(studioId: string, weddingId: string, actorName: string, csv: string) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  const known = new Set<string>(GROUPS as readonly string[]);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let imported = 0, skipped = 0;
  const rows: { weddingId: string; studioId: string; name: string; email: string | null; groups: string[]; inviteCode: string }[] = [];
  for (const line of csv.split("\n").map(l => l.trim()).filter(Boolean)) {
    const [name, email, groups] = line.split(",").map(s => (s ?? "").trim());
    if (!name) { skipped++; continue; }                         // no name → reject the line
    if (email && !emailRe.test(email)) { skipped++; continue; } // malformed email → reject rather than store garbage
    rows.push({
      weddingId, studioId, name,
      email: email || null,
      groups: (groups ?? "").split("|").map(g => g.trim()).filter(g => known.has(g)),
      inviteCode: inviteCode(),
    });
    imported++;
  }
  if (rows.length) await prisma.guest.createMany({ data: rows });
  await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Imported ${imported} guests${skipped ? ` (${skipped} lines skipped)` : ""}`, targetId: weddingId });
  return { imported, skipped };
}

export async function deleteGuest(studioId: string, guestId: string) {
  await prisma.guest.deleteMany({ where: { id: guestId, studioId } });
}

/**
 * Send one invitation, at most once per guest per invite code.
 *
 * The idempotency wrapper is not defensive decoration. `sendInvitations` selects
 * on `invitedAt: null` and only stamps it *after* a successful send, so two
 * requests that overlap — a double-click, a Vercel retry after a timeout, a
 * planner refreshing an apparently-stuck page — both read the same pending list
 * and both mail every guest on it. The guest receives two identical invitations
 * from a domain we are trying to keep out of spam folders.
 *
 * The key includes the invite code, so deliberately regenerating a guest's code
 * and re-sending still works immediately; it is only *the same* invitation that
 * is suppressed.
 *
 * A duplicate reports success. The caller's contract is "this guest has been
 * invited", and after a suppressed duplicate that is true.
 */
async function sendInvitationOnce(
  weddingId: string,
  studioId: string,
  guest: { id: string; name: string; email: string | null; inviteCode: string },
  wedding: { partnerOne: string; partnerTwo: string },
  studio: Parameters<typeof emailOneGuest>[2],
): Promise<boolean> {
  const outcome = await runOnce({
    key: invitationKey(weddingId, guest.id, guest.inviteCode),
    scope: "invitation",
    studioId,
    // Long enough to absorb a retry storm, short enough that a planner who
    // genuinely wants to nudge a guest tomorrow is not blocked.
    ttlMs: 6 * 60 * 60 * 1000,
    effect: () => emailOneGuest(guest, wedding, studio),
  });

  if (outcome.status === "performed") return outcome.result;
  // Already sent, or a concurrent attempt is sending it right now. Either way
  // this guest is invited and must not be mailed a second time.
  return outcome.status === "duplicate" ? outcome.result !== false : true;
}

async function emailOneGuest(
  guest: { id: string; name: string; email: string | null; inviteCode: string },
  wedding: { partnerOne: string; partnerTwo: string },
  studio: {
    id: string; name: string; brandColor: string; contactEmail: string | null;
    brandFont?: string | null;
    logoUrl?: string | null; logoWidth?: number | null; logoHeight?: number | null;
  },
) {
  if (!guest.email) return false;
  const brand = emailBrandingFor(studio);
  return emails.guestInvitation({
    to: guest.email, guestName: guest.name,
    couple: `${wedding.partnerOne} & ${wedding.partnerTwo}`,
    studio: studio.name, color: studio.brandColor, studioId: studio.id,
    // The planner's letterhead, not ours — the guest should never learn that
    // a platform exists behind this.
    logo: brand.logo, face: brand.face,
    // A guest who hits reply should reach the planner, not a void. This is
    // also what makes the message look like correspondence rather than a
    // broadcast, which is half of why invitations get filtered.
    studioEmail: studio.contactEmail,
    link: `${process.env.APP_URL}/invite/${guest.inviteCode}`,
  });
}

/**
 * Sends to not-yet-invited guests. Each guest is handled independently:
 * one failing address can no longer abort the batch, and invitedAt is only
 * set for guests whose email actually went out (guests without an email
 * address are marked invited too — their link is shared manually).
 */
/**
 * Gap between invitations in a batch.
 *
 * Resend allows 2 requests a second by default, so 600ms leaves headroom for
 * the occasional retry without the batch crawling. At this pace 200 guests
 * takes about two minutes — comfortably inside a serverless function's budget,
 * and slow enough not to look like a blast.
 */
const INVITE_SEND_INTERVAL_MS = 600;

export async function sendInvitations(studioId: string, weddingId: string, actorName: string) {
  const [wedding, studio] = await Promise.all([
    prisma.wedding.findFirst({ where: { id: weddingId, studioId } }),
    prisma.studio.findUniqueOrThrow({ where: { id: studioId } }),
  ]);
  if (!wedding) throw new Error("Not found");
  const pending = await prisma.guest.findMany({ where: { weddingId, studioId, invitedAt: null } });

  let sent = 0, failed = 0;
  for (const [i, g] of pending.entries()) {
    // Paced under the provider's rate limit. Sending 200 invitations in a tight
    // loop earns 429s, and a burst of identical messages from a new domain is
    // also precisely the shape a spam filter is watching for — a steady trickle
    // reads as correspondence.
    if (i > 0) await new Promise(r => setTimeout(r, INVITE_SEND_INTERVAL_MS));
    const ok = g.email ? await sendInvitationOnce(weddingId, studioId, g, wedding, studio) : true;
    if (ok) {
      sent++;
      await prisma.guest.update({ where: { id: g.id }, data: { invitedAt: new Date() } });
    } else {
      failed++; // stays uninvited so the next run retries it; failure is in EmailLog
    }
  }
  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: weddingId,
    action: `Sent invitations \u2014 ${wedding.partnerOne} & ${wedding.partnerTwo}: ${sent} delivered to provider${failed ? `, ${failed} failed (see email log)` : ""}`,
  });
  return { sent, failed };
}

/** Re-send a single guest's invitation regardless of invitedAt. */
export async function resendInvitation(studioId: string, guestId: string, actorName: string) {
  const guest = await prisma.guest.findFirst({ where: { id: guestId, studioId }, include: { wedding: true } });
  if (!guest) throw new Error("Not found");

  /**
   * The one send path with no natural brake.
   *
   * `sendInvitations` is bounded by `invitedAt: null` — it cannot mail the same
   * guest twice without a deliberate reset. Re-send exists precisely to bypass
   * that, which means the only thing standing between a stuck button and a
   * hundred identical emails to one address is this limit. The address is a
   * guest's, the sending domain is ours, and the cost of the abuse lands on our
   * deliverability rather than on the person doing it.
   *
   * Keyed per guest, not per studio: a planner working through a list of
   * bounced addresses is doing something legitimate and should not be stopped
   * because they have several to fix.
   */
  if (!(await rateLimit(`resend:${guestId}`, 3, 60 * 60 * 1000))) {
    throw new UserError(
      "This guest has been sent several invitations in the last hour. Please wait before sending another.",
    );
  }

  const studio = await prisma.studio.findUniqueOrThrow({ where: { id: studioId } });
  // Not `sendInvitationOnce`: a re-send is the deliberate act of sending again,
  // and suppressing it as a duplicate would break the only button that exists
  // to do it. The rate limit above is what bounds this path.
  const ok = await emailOneGuest(guest, guest.wedding, studio);
  if (ok) await prisma.guest.update({ where: { id: guest.id }, data: { invitedAt: new Date() } });
  await logAudit({ actorType: "PLANNER", actorName, studioId, targetId: guest.weddingId, action: `Re-sent invitation to ${guest.name}${ok ? "" : " (delivery failed \u2014 see email log)"}` });
  return ok;
}
