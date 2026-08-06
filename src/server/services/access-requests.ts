import { prisma } from "@/lib/db";
import { emails } from "@/lib/email";
import { zAccessRequest } from "@/lib/validators";
import { rateLimit } from "@/lib/ratelimit";
import { UserError } from "@/lib/errors";

/**
 * The public access request.
 *
 * This is the only write path in the product that is reachable without a
 * session, which makes it the only one an anonymous person can abuse. Three
 * things guard it, in increasing order of how much they actually matter:
 *
 *  1. A honeypot field, which catches naive bots for free.
 *  2. A per-IP rate limit, which catches the rest.
 *  3. Storing a request grants nothing. Even a flood of rows creates no
 *     accounts, sends nothing to third parties, and costs nothing but storage.
 *     That last property is the real defence; the first two are hygiene.
 */

/**
 * Where the notification goes. Falls back to the address inside EMAIL_FROM,
 * which is formatted "EventOS <hello@example.com>" — passing that whole string
 * as a recipient is rejected by the provider, so the address is extracted.
 * With neither set, requests are still stored; only the nudge is lost.
 */
const OWNER_EMAIL = (() => {
  const explicit = process.env.ACCESS_REQUEST_TO?.trim();
  if (explicit) return explicit;
  const from = process.env.EMAIL_FROM ?? "";
  return from.match(/<([^>]+)>/)?.[1] ?? (from.includes("@") ? from.trim() : null);
})();

export type AccessRequestResult =
  | { ok: true }
  | { ok: false; message: string; fields?: Record<string, string> };

export async function submitAccessRequest(
  raw: Record<string, unknown>,
  ip: string | null,
): Promise<AccessRequestResult> {
  const parsed = zAccessRequest.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fields[key]) fields[key] = issue.message;
    }
    return { ok: false, message: "Please check the highlighted fields.", fields };
  }

  const input = parsed.data;

  // The honeypot is hidden from people and from assistive technology, so a
  // value in it is never a human. Answer as though it worked: telling a bot it
  // was caught only teaches whoever wrote it to stop filling that field in.
  if (input.role) return { ok: true };

  if (!(await rateLimit(`access:${ip ?? "unknown"}`, 3, 60 * 60 * 1000))) {
    return {
      ok: false,
      message: "We already have a request from you. Give us a little time to read it.",
    };
  }

  // A second request from the same address is an update, not a duplicate row —
  // people resubmit when they forget to mention something. Only ever refresh a
  // request still waiting; one already acted on stays as the record of that.
  const existing = await prisma.accessRequest.findFirst({
    where: { email: input.email, status: "NEW" },
    orderBy: { createdAt: "desc" },
  });

  const data = {
    name: input.name,
    email: input.email,
    company: input.company || null,
    website: input.website || null,
    volume: input.volume || null,
    message: input.message || null,
    ip,
  };

  const record = existing
    ? await prisma.accessRequest.update({ where: { id: existing.id }, data })
    : await prisma.accessRequest.create({ data });

  // Email is best-effort and deliberately not awaited into the result: the
  // request is already saved, so a mail outage must not tell the person their
  // submission failed. Every attempt is recorded in EmailLog either way.
  const link = `${process.env.APP_URL ?? ""}/admin/requests`;
  await Promise.allSettled([
    OWNER_EMAIL
      ? emails.accessRequest({
          to: OWNER_EMAIL,
          name: record.name,
          email: record.email,
          company: record.company,
          website: record.website,
          volume: record.volume,
          message: record.message,
          link,
        })
      : Promise.resolve(false),
    emails.accessRequestAck({ to: record.email, name: record.name.split(" ")[0] || record.name }),
  ]);

  return { ok: true };
}

/* ------------------------------------------------------------------ admin -- */

export function listAccessRequests() {
  // Newest first, but unread ahead of everything: the inbox is a work queue,
  // not a log.
  return prisma.accessRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function setAccessRequestStatus(
  id: string,
  status: "NEW" | "INVITED" | "DECLINED",
) {
  const existing = await prisma.accessRequest.findUnique({ where: { id } });
  if (!existing) throw new UserError("That request no longer exists.");

  return prisma.accessRequest.update({
    where: { id },
    data: { status, reviewedAt: status === "NEW" ? null : new Date() },
  });
}

export function accessRequestCounts() {
  return prisma.accessRequest.groupBy({ by: ["status"], _count: { _all: true } });
}
