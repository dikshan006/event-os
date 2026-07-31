import "server-only";
import { prisma } from "@/lib/db";
import { inviteCode, GROUPS } from "@/lib/utils";
import { emails } from "@/lib/email";
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

async function emailOneGuest(guest: { id: string; name: string; email: string | null; inviteCode: string }, wedding: { partnerOne: string; partnerTwo: string }, studio: { id: string; name: string; brandColor: string }) {
  if (!guest.email) return false;
  return emails.guestInvitation({
    to: guest.email, guestName: guest.name,
    couple: `${wedding.partnerOne} & ${wedding.partnerTwo}`,
    studio: studio.name, color: studio.brandColor, studioId: studio.id,
    link: `${process.env.APP_URL}/invite/${guest.inviteCode}`,
  });
}

/**
 * Sends to not-yet-invited guests. Each guest is handled independently:
 * one failing address can no longer abort the batch, and invitedAt is only
 * set for guests whose email actually went out (guests without an email
 * address are marked invited too — their link is shared manually).
 */
export async function sendInvitations(studioId: string, weddingId: string, actorName: string) {
  const [wedding, studio] = await Promise.all([
    prisma.wedding.findFirst({ where: { id: weddingId, studioId } }),
    prisma.studio.findUniqueOrThrow({ where: { id: studioId } }),
  ]);
  if (!wedding) throw new Error("Not found");
  const pending = await prisma.guest.findMany({ where: { weddingId, studioId, invitedAt: null } });

  let sent = 0, failed = 0;
  for (const g of pending) {
    const ok = g.email ? await emailOneGuest(g, wedding, studio) : true;
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
  const studio = await prisma.studio.findUniqueOrThrow({ where: { id: studioId } });
  const ok = await emailOneGuest(guest, guest.wedding, studio);
  if (ok) await prisma.guest.update({ where: { id: guest.id }, data: { invitedAt: new Date() } });
  await logAudit({ actorType: "PLANNER", actorName, studioId, targetId: guest.weddingId, action: `Re-sent invitation to ${guest.name}${ok ? "" : " (delivery failed \u2014 see email log)"}` });
  return ok;
}
