import { NextRequest, NextResponse } from "next/server";
import { auth, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

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
