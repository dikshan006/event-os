import "server-only";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { logAudit } from "./audit";

/**
 * Reception seating.
 *
 * Same tenant discipline as every other service: `studioId` comes from the
 * caller's session and appears in the WHERE clause of every query, so a
 * planner cannot touch another studio's tables even with a valid id.
 *
 * The "one guest, one table" rule is enforced by the schema — `Guest.tableId`
 * is a single nullable foreign key, so two tables at once is unrepresentable.
 * Assigning simply overwrites, which is also what makes moving a guest a
 * single update rather than a remove-then-add pair that could half-fail.
 */

export const MAX_TABLES = 60;
const MAX_SEATS = 30;

/** Everything the seating page renders, in two queries. */
export async function seatingPlan(studioId: string, weddingId: string) {
  const [tables, guests] = await Promise.all([
    prisma.table.findMany({
      where: { weddingId, studioId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.guest.findMany({
      where: { weddingId, studioId },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, groups: true, tableId: true, seatOrder: true,
                rsvp: { select: { status: true } } },
    }),
  ]);

  const byTable = new Map<string, typeof guests>();
  const unassigned: typeof guests = [];
  for (const g of guests) {
    if (!g.tableId) { unassigned.push(g); continue; }
    const list = byTable.get(g.tableId);
    if (list) list.push(g); else byTable.set(g.tableId, [g]);
  }
  for (const list of byTable.values()) list.sort((a, b) => a.seatOrder - b.seatOrder);

  const seated = guests.length - unassigned.length;
  return {
    tables: tables.map(t => ({ ...t, guests: byTable.get(t.id) ?? [] })),
    unassigned,
    totals: {
      guests: guests.length,
      seated,
      unseated: unassigned.length,
      seats: tables.reduce((n, t) => n + t.seats, 0),
    },
  };
}

export async function createTable(studioId: string, weddingId: string, name: string, seats: number, actorName: string) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");

  const count = await prisma.table.count({ where: { weddingId, studioId } });
  if (count >= MAX_TABLES) throw new UserError(`A wedding is limited to ${MAX_TABLES} tables.`);

  const clean = name.trim() || `Table ${count + 1}`;
  const last = await prisma.table.findFirst({
    where: { weddingId, studioId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const table = await prisma.table.create({
    data: {
      weddingId, studioId,
      name: clean.slice(0, 60),
      seats: clampSeats(seats),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: weddingId,
    action: `Added ${clean} to the seating plan`,
  });
  return table;
}

export async function updateTable(studioId: string, tableId: string, name: string, seats: number) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, studioId },
    include: { _count: { select: { guests: true } } },
  });
  if (!table) throw new Error("Not found");

  const next = clampSeats(seats);
  // Refusing rather than silently seating people in chairs that no longer
  // exist. The planner unseats someone first, which is the real-world order.
  if (next < table._count.guests) {
    throw new UserError(
      `${table.name} already seats ${table._count.guests}. Remove ${table._count.guests - next} ` +
      `guest${table._count.guests - next === 1 ? "" : "s"} before reducing it to ${next}.`,
    );
  }

  await prisma.table.updateMany({
    where: { id: tableId, studioId },
    data: { name: name.trim().slice(0, 60) || table.name, seats: next },
  });
}

/** Guests return to the unassigned pool; the schema's SET NULL handles it. */
export async function deleteTable(studioId: string, tableId: string, actorName: string) {
  const table = await prisma.table.findFirst({ where: { id: tableId, studioId } });
  if (!table) throw new Error("Not found");

  await prisma.table.delete({ where: { id: table.id } });
  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: table.weddingId,
    action: `Removed ${table.name} from the seating plan — its guests are unassigned`,
  });
}

/**
 * Seat a guest. Also the "move" operation: assigning someone who already has a
 * table overwrites it, so there is no window in which they belong to neither.
 */
export async function assignGuest(studioId: string, guestId: string, tableId: string) {
  const [guest, table] = await Promise.all([
    prisma.guest.findFirst({ where: { id: guestId, studioId } }),
    prisma.table.findFirst({
      where: { id: tableId, studioId },
      include: { _count: { select: { guests: true } } },
    }),
  ]);
  if (!guest || !table) throw new Error("Not found");
  if (guest.weddingId !== table.weddingId) throw new Error("Not found");
  if (guest.tableId === tableId) return;

  if (table._count.guests >= table.seats) {
    throw new UserError(`${table.name} is full (${table.seats} seats). Add a seat or choose another table.`);
  }

  const last = await prisma.guest.findFirst({
    where: { tableId, studioId },
    orderBy: { seatOrder: "desc" },
    select: { seatOrder: true },
  });

  await prisma.guest.updateMany({
    where: { id: guestId, studioId },
    data: { tableId, seatOrder: (last?.seatOrder ?? -1) + 1 },
  });
}

export async function unassignGuest(studioId: string, guestId: string) {
  await prisma.guest.updateMany({
    where: { id: guestId, studioId },
    data: { tableId: null, seatOrder: 0 },
  });
}

function clampSeats(seats: number) {
  if (!Number.isFinite(seats)) return 8;
  return Math.min(MAX_SEATS, Math.max(1, Math.round(seats)));
}
