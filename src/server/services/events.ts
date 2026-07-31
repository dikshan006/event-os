import "server-only";
import { prisma } from "@/lib/db";
import type { z } from "zod";
import type { zEvent } from "@/lib/validators";

export function listEvents(studioId: string, weddingId: string) {
  return prisma.event.findMany({
    where: { weddingId, wedding: { studioId } },
    orderBy: [{ sortKey: "asc" }, { time: "asc" }],
  });
}

export async function addEvent(studioId: string, weddingId: string, input: z.infer<typeof zEvent>) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  const max = await prisma.event.aggregate({ where: { weddingId }, _max: { sortKey: true } });
  return prisma.event.create({
    data: {
      weddingId,
      title: input.title, day: input.day, time: input.time,
      location: input.location || null, dressCode: input.dressCode || null,
      isPublic: input.isPublic, audiences: input.isPublic ? [] : input.audiences,
      sortKey: (max._max.sortKey ?? 0) + 10,
    },
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
