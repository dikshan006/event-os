import "server-only";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { logAudit } from "./audit";

/**
 * Seating, per event.
 *
 * A wedding's ceremony and cocktail hour have no tables; its reception dinner
 * and farewell brunch each have their own, often with different people at
 * different tables. So a table belongs to an event, and a guest holds one Seat
 * per event rather than a single table for the whole wedding.
 *
 * The "one table per guest per event" rule lives in the database as
 * `@@unique([guestId, eventId])` on Seat. Services cannot violate it even by
 * accident, and a duplicate assignment surfaces as a constraint error rather
 * than as two contradictory rows.
 *
 * Tenant discipline is unchanged: `studioId` comes from the session and
 * appears in the WHERE clause of every query.
 */

export const MAX_TABLES_PER_EVENT = 60;
const MAX_CAPACITY = 30;

/** Events for this wedding, each with its tables, seats, and counts. */
export async function seatingPlan(studioId: string, weddingId: string) {
  const [events, guests] = await Promise.all([
    prisma.event.findMany({
      where: { weddingId, wedding: { studioId } },
      orderBy: [{ sortKey: "asc" }, { time: "asc" }],
      include: {
        tables: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            seats: {
              orderBy: { seatOrder: "asc" },
              include: {
                guest: {
                  select: { id: true, name: true, groups: true,
                            rsvp: { select: { status: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.guest.findMany({
      where: { weddingId, studioId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, groups: true },
    }),
  ]);

  return events.map(e => {
    const seatedIds = new Set(e.tables.flatMap(t => t.seats.map(s => s.guestId)));
    return {
      id: e.id,
      title: e.title,
      day: e.day,
      time: e.time,
      location: e.location,
      tables: e.tables,
      // Unassigned is per event: someone seated at the dinner is still
      // unseated for the brunch.
      unassigned: guests.filter(g => !seatedIds.has(g.id)),
      totals: {
        guests: guests.length,
        seated: seatedIds.size,
        unseated: guests.length - seatedIds.size,
        capacity: e.tables.reduce((n, t) => n + t.capacity, 0),
      },
    };
  });
}

export async function createTable(
  studioId: string, eventId: string, name: string, capacity: number, actorName: string,
) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, wedding: { studioId } },
    include: { wedding: { select: { id: true } }, _count: { select: { tables: true } } },
  });
  if (!event) throw new Error("Not found");
  if (event._count.tables >= MAX_TABLES_PER_EVENT) {
    throw new UserError(`${event.title} is limited to ${MAX_TABLES_PER_EVENT} tables.`);
  }

  const clean = name.trim().slice(0, 60) || `Table ${event._count.tables + 1}`;
  const last = await prisma.table.findFirst({
    where: { eventId, studioId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const table = await prisma.table.create({
    data: {
      eventId,
      weddingId: event.weddingId,
      studioId,
      name: clean,
      capacity: clampCapacity(capacity),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: event.weddingId,
    action: `Added ${clean} to ${event.title}`,
  });
  return table;
}

export async function updateTable(studioId: string, tableId: string, name: string, capacity: number) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, studioId },
    include: { _count: { select: { seats: true } } },
  });
  if (!table) throw new Error("Not found");

  const next = clampCapacity(capacity);
  const seated = table._count.seats;
  // Refuse rather than leave guests in chairs that no longer exist.
  if (next < seated) {
    throw new UserError(
      `${table.name} already seats ${seated}. Remove ${seated - next} ` +
      `guest${seated - next === 1 ? "" : "s"} before reducing it to ${next}.`,
    );
  }

  await prisma.table.updateMany({
    where: { id: tableId, studioId },
    data: { name: name.trim().slice(0, 60) || table.name, capacity: next },
  });
}

/** Seats cascade; the guests themselves are untouched. */
export async function deleteTable(studioId: string, tableId: string, actorName: string) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, studioId },
    include: { event: { select: { title: true } } },
  });
  if (!table) throw new Error("Not found");

  await prisma.table.delete({ where: { id: table.id } });
  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: table.weddingId,
    action: `Removed ${table.name} from ${table.event.title} — its guests are unassigned for that event`,
  });
}

/**
 * Seat a guest at a table. Also the "move" operation: because the unique key
 * is (guestId, eventId), an upsert relocates them within the event in one
 * statement, with no window in which they are seated nowhere.
 */
export async function assignGuest(studioId: string, guestId: string, tableId: string) {
  const [guest, table] = await Promise.all([
    prisma.guest.findFirst({ where: { id: guestId, studioId } }),
    prisma.table.findFirst({
      where: { id: tableId, studioId },
      include: { _count: { select: { seats: true } } },
    }),
  ]);
  if (!guest || !table) throw new Error("Not found");
  if (guest.weddingId !== table.weddingId) throw new Error("Not found");

  const existing = await prisma.seat.findUnique({
    where: { guestId_eventId: { guestId, eventId: table.eventId } },
  });
  if (existing?.tableId === tableId) return;

  // Capacity counts the incoming guest unless they are already at this table.
  if (table._count.seats >= table.capacity) {
    throw new UserError(`${table.name} is full (${table.capacity} seats). Add a seat or choose another table.`);
  }

  const last = await prisma.seat.findFirst({
    where: { tableId, studioId },
    orderBy: { seatOrder: "desc" },
    select: { seatOrder: true },
  });

  await prisma.seat.upsert({
    where: { guestId_eventId: { guestId, eventId: table.eventId } },
    create: {
      tableId, guestId, eventId: table.eventId, studioId,
      seatOrder: (last?.seatOrder ?? -1) + 1,
    },
    update: { tableId, seatOrder: (last?.seatOrder ?? -1) + 1 },
  });
}

export async function unassignGuest(studioId: string, seatId: string) {
  await prisma.seat.deleteMany({ where: { id: seatId, studioId } });
}

/** Every event this guest is seated at, for the invitation. */
export function seatsForGuest(guestId: string) {
  return prisma.seat.findMany({
    where: { guestId },
    select: { eventId: true, table: { select: { name: true } } },
  });
}

function clampCapacity(capacity: number) {
  if (!Number.isFinite(capacity)) return 8;
  return Math.min(MAX_CAPACITY, Math.max(1, Math.round(capacity)));
}
