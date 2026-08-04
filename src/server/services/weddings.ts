import "server-only";
import { prisma } from "@/lib/db";
import { weddingSlug } from "@/lib/utils";
import { logAudit } from "./audit";
import type { z } from "zod";
import type { zWedding } from "@/lib/validators";
import { parseCoord } from "@/lib/validators";
import { isValidTimeZone, utcToZonedInputs, zonedWallTimeToUtc, parseLocalInput } from "@/lib/timezone";
import { resolveTimeZone } from "@/lib/timezone-lookup";

/**
 * Venue and timezone fields, mapped once.
 *
 * An unknown IANA string falls back to UTC rather than being stored: a bad
 * zone makes `Intl` throw at render time, which would take down the schedule
 * editor and the invitation together.
 */
function placeFields(input: z.infer<typeof zWedding>) {
  // A blank or unknown zone is derived from the location the planner already
  // typed, so the field is one they confirm rather than one they fill in.
  const asked = input.timeZone?.trim() ?? "";
  const timeZone = isValidTimeZone(asked)
    ? asked
    : resolveTimeZone({ city: input.city, venue: input.venue, venueAddress: input.venueAddress });

  return {
    venue: input.venue || null,
    city: input.city || null,
    venueAddress: input.venueAddress || null,
    venueLat: parseCoord(input.venueLat, 90),
    venueLng: parseCoord(input.venueLng, 180),
    timeZone,
  };
}

/**
 * Move every event so it keeps the same clock time in a new timezone.
 *
 * Event instants are stored in UTC, derived from local wall time at the venue.
 * Change the venue's zone and those instants still name the old moment — a
 * 2:00 PM ceremony moved from UTC to America/Chicago would start showing as
 * 8:00 AM. Nobody would connect that to having corrected a dropdown.
 *
 * So the wall time is read back in the old zone and re-anchored in the new one.
 * The numbers the planner typed are what survives, which is what they meant.
 */
async function reanchorEvents(weddingId: string, from: string, to: string) {
  if (from === to) return;

  const events = await prisma.event.findMany({
    where: { weddingId, OR: [{ startsAt: { not: null } }, { endsAt: { not: null } }] },
    select: { id: true, startsAt: true, endsAt: true },
  });
  if (!events.length) return;

  const shift = (instant: Date | null) => {
    if (!instant) return null;
    const wall = utcToZonedInputs(instant, from);
    const parts = parseLocalInput(wall.date, wall.time);
    return parts ? zonedWallTimeToUtc(parts, to) : instant;
  };

  await prisma.$transaction(
    events.map(e =>
      prisma.event.update({
        where: { id: e.id },
        data: { startsAt: shift(e.startsAt), endsAt: shift(e.endsAt) },
      }),
    ),
  );
}

export function listWeddings(studioId: string) {
  return prisma.wedding.findMany({
    where: { studioId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { guests: true } }, guests: { select: { rsvp: { select: { id: true } } } } },
  });
}

export async function createWedding(studioId: string, actorName: string, input: z.infer<typeof zWedding>) {
  const wedding = await prisma.wedding.create({
    data: {
      studioId,
      slug: weddingSlug(input.partnerOne, input.partnerTwo),
      template: input.template,
      partnerOne: input.partnerOne,
      partnerTwo: input.partnerTwo,
      date: new Date(input.date + "T16:00:00Z"),
      ...placeFields(input),
      story: input.story || null,
      venueNote: input.venueNote || null,
      accommodation: input.accommodation || null,
      travelNote: input.travelNote || null,
      sections: input.sections,
      faqs: {
        create: [
          { question: "What should I wear?", answer: "Dress codes are listed with each event in your personal schedule.", sortOrder: 0 },
          { question: "Can I bring a plus one?", answer: "Invitations are addressed to everyone included in your party.", sortOrder: 1 },
        ],
      },
    },
  });
  await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Created wedding \u201C${input.partnerOne} & ${input.partnerTwo}\u201D`, targetId: wedding.id });
  return wedding;
}

export async function updateWedding(studioId: string, weddingId: string, input: z.infer<typeof zWedding>) {
  // Read the current zone before writing, so a change can be detected and the
  // events moved with it. Scoped by studioId, so this cannot read another
  // tenant's wedding any more than the update below could write one.
  const current = await prisma.wedding.findFirst({
    where: { id: weddingId, studioId },
    select: { timeZone: true },
  });

  const place = placeFields(input);

  // updateMany + studioId in the WHERE clause = tenant isolation at the query level
  await prisma.wedding.updateMany({
    where: { id: weddingId, studioId },
    data: {
      template: input.template,
      partnerOne: input.partnerOne,
      partnerTwo: input.partnerTwo,
      date: new Date(input.date + "T16:00:00Z"),
      ...place,
      story: input.story || null,
      venueNote: input.venueNote || null,
      accommodation: input.accommodation || null,
      travelNote: input.travelNote || null,
      sections: input.sections,
    },
  });

  if (current && current.timeZone !== place.timeZone) {
    await reanchorEvents(weddingId, current.timeZone, place.timeZone);
  }
}

export async function unpublishWedding(studioId: string, weddingId: string) {
  await prisma.wedding.updateMany({ where: { id: weddingId, studioId }, data: { status: "DRAFT" } });
}

export async function deleteWedding(studioId: string, actorName: string, weddingId: string) {
  const w = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!w) return;
  await prisma.wedding.delete({ where: { id: w.id } }); // cascades to guests/events/registry/faqs/funds
  await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Deleted wedding \u201C${w.partnerOne} & ${w.partnerTwo}\u201D`, targetId: w.id });
}

export async function duplicateWedding(studioId: string, actorName: string, weddingId: string) {
  const w = await prisma.wedding.findFirst({
    where: { id: weddingId, studioId },
    include: { events: true, registry: true, funds: true, faqs: true },
  });
  if (!w) return;
  const copy = await prisma.wedding.create({
    data: {
      studioId,
      slug: weddingSlug(w.partnerOne, w.partnerTwo + "-copy"),
      template: w.template,
      status: "DRAFT",
      partnerOne: w.partnerOne,
      partnerTwo: `${w.partnerTwo} (Copy)`,
      date: w.date, venue: w.venue, city: w.city, story: w.story, sections: w.sections,
      events: { create: w.events.map(({ id, weddingId, ...e }) => e) },
      registry: { create: w.registry.map(({ id, weddingId, ...r }) => r) },
      funds: { create: w.funds.map(({ id, weddingId, ...f }) => f) },
      faqs: { create: w.faqs.map(({ id, weddingId, ...f }) => f) },
    },
  });
  await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Duplicated wedding \u201C${w.partnerOne} & ${w.partnerTwo}\u201D`, targetId: copy.id });
  return copy;
}
