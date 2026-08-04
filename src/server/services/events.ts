import "server-only";
import { prisma } from "@/lib/db";
import type { z } from "zod";
import type { zEvent } from "@/lib/validators";
import { parseCoord } from "@/lib/validators";
import { parseLocalInput, zonedWallTimeToUtc, formatInZone } from "@/lib/timezone";

export function listEvents(studioId: string, weddingId: string) {
  return prisma.event.findMany({
    where: { weddingId, wedding: { studioId } },
    orderBy: [{ sortKey: "asc" }, { time: "asc" }],
  });
}

/**
 * Turn what the planner typed into what the database stores.
 *
 * The planner enters local wall time at the venue. We store the UTC instant it
 * corresponds to, using the wedding's own timezone, so a calendar entry is
 * correct for a guest opening it from anywhere. The display strings the guest
 * site has always shown are generated from the same values unless the planner
 * wrote their own — "Late" and "After the ceremony" have to survive.
 */
function resolveTimes(input: z.infer<typeof zEvent>, timeZone: string) {
  const start = input.startTime
    ? parseLocalInput(input.date, input.startTime)
    : parseLocalInput(input.date, "00:00");

  const startsAt =
    input.startTime && start ? zonedWallTimeToUtc(start, timeZone) : null;

  const end = input.endTime ? parseLocalInput(input.date, input.endTime) : null;
  let endsAt = end ? zonedWallTimeToUtc(end, timeZone) : null;
  // An end before the start means the event runs past midnight, which is the
  // common case for a reception. Roll it to the next day rather than rejecting
  // it or, worse, storing a negative duration.
  if (startsAt && endsAt && endsAt <= startsAt) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  }

  // The anchor for the day label: the real start when there is one, otherwise
  // midday on the chosen date, which cannot drift across a date boundary in
  // any timezone the way midnight can.
  const anchor =
    startsAt ?? (parseLocalInput(input.date, "12:00")
      ? zonedWallTimeToUtc(parseLocalInput(input.date, "12:00")!, timeZone)
      : null);

  const day =
    input.dayLabel?.trim() ||
    (anchor
      ? formatInZone(anchor, timeZone, { weekday: "long", day: "numeric", month: "long" })
      : input.date);

  const time =
    input.timeLabel?.trim() ||
    (startsAt
      ? formatInZone(startsAt, timeZone, { hour: "numeric", minute: "2-digit", hour12: true })
      : "");

  return { startsAt, endsAt, day, time };
}

/** Fields shared by create and update. */
function eventData(input: z.infer<typeof zEvent>, timeZone: string) {
  const { startsAt, endsAt, day, time } = resolveTimes(input, timeZone);
  return {
    title: input.title,
    day,
    time,
    startsAt,
    endsAt,
    description: input.description || null,
    location: input.location || null,
    address: input.address || null,
    lat: parseCoord(input.lat, 90),
    lng: parseCoord(input.lng, 180),
    dressCode: input.dressCode || null,
    isPublic: input.isPublic,
    audiences: input.isPublic ? [] : input.audiences,
  };
}

export async function addEvent(studioId: string, weddingId: string, input: z.infer<typeof zEvent>) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  const max = await prisma.event.aggregate({ where: { weddingId }, _max: { sortKey: true } });
  return prisma.event.create({
    data: {
      weddingId,
      ...eventData(input, wedding.timeZone),
      sortKey: (max._max.sortKey ?? 0) + 10,
    },
  });
}

export async function updateEvent(studioId: string, eventId: string, input: z.infer<typeof zEvent>) {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, wedding: { studioId } },
    include: { wedding: { select: { timeZone: true } } },
  });
  if (!existing) throw new Error("Not found");
  return prisma.event.update({
    where: { id: eventId },
    data: eventData(input, existing.wedding.timeZone),
  });
}

export async function deleteEvent(studioId: string, eventId: string) {
  await prisma.event.deleteMany({ where: { id: eventId, wedding: { studioId } } });
}

/** The personalization rule — one place, used by portal, previews, and emails. */
export function personalEvents(weddingId: string, guestGroups: string[]) {
  return prisma.event.findMany({
    where: {
      weddingId,
      OR: [{ isPublic: true }, { audiences: { hasSome: guestGroups.length ? guestGroups : ["__none__"] } }],
    },
    orderBy: [{ sortKey: "asc" }],
  });
}
