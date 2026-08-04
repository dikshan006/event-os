import "server-only";
import { prisma } from "@/lib/db";
import { personalEvents } from "@/server/services/events";
import { resolvePlace, placeQuery } from "@/lib/maps";
import type { CalendarEvent } from "@/lib/calendar";

/**
 * Assembling the calendar payload for a guest, or for a public wedding site.
 *
 * Deliberately reuses `personalEvents` — the one function that decides which
 * events a guest may see. A second copy of that rule here is how a calendar
 * feed ends up leaking the rehearsal dinner to the evening guests.
 */

export type FeedResult = {
  events: CalendarEvent[];
  calendarName: string;
  /** Personal feeds must never be cached by a shared proxy. */
  personal: boolean;
};

/**
 * `token` is either a guest's invite code or a published wedding's slug. Both
 * are looked up in that order, and both resolve to the same visibility rules
 * the corresponding page uses. Anything else returns null, which the route
 * turns into a 404 — never a 403, so the token space stays opaque.
 */
export async function calendarFeed(token: string, appUrl: string): Promise<FeedResult | null> {
  const guest = await prisma.guest.findUnique({
    where: { inviteCode: token },
    include: { wedding: { include: { studio: true } } },
  });

  if (guest) {
    if (guest.wedding.status !== "PUBLISHED") return null;
    const rows = await personalEvents(guest.weddingId, guest.groups);
    return {
      personal: true,
      calendarName: coupleOf(guest.wedding),
      events: rows.map(e =>
        toCalendarEvent(e, guest.wedding, guest.wedding.studio.name, `${appUrl}/invite/${token}`),
      ),
    };
  }

  const wedding = await prisma.wedding.findUnique({
    where: { slug: token },
    include: { studio: true, events: { where: { isPublic: true }, orderBy: { sortKey: "asc" } } },
  });
  if (!wedding || wedding.status !== "PUBLISHED") return null;

  return {
    personal: false,
    calendarName: coupleOf(wedding),
    events: wedding.events.map(e =>
      toCalendarEvent(e, wedding, wedding.studio.name, `${appUrl}/w/${wedding.slug}`),
    ),
  };
}

function coupleOf(w: { partnerOne: string; partnerTwo: string }) {
  return `${w.partnerOne} & ${w.partnerTwo}`;
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  location: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  dressCode: string | null;
};

type WeddingRow = {
  id: string;
  partnerOne: string;
  partnerTwo: string;
  venue: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  city: string | null;
};

/**
 * One event record becomes one calendar entry.
 *
 * The UID is derived from the event id and the deployment host rather than
 * randomly generated: importing the same file twice has to update the existing
 * entry instead of creating a duplicate, which is what a random UID does.
 */
export function toCalendarEvent(
  e: EventRow,
  w: WeddingRow,
  studioName: string,
  url: string,
): CalendarEvent {
  const place = resolvePlace(e, w);

  return {
    uid: `${e.id}@eventos`,
    title: e.title,
    weddingName: coupleOf(w),
    // Callers filter on startsAt before reaching here; the fallback keeps the
    // type honest without ever being used.
    startsAt: e.startsAt ?? new Date(),
    endsAt: e.endsAt,
    location: place.name,
    address: place.address ?? (placeQuery(place) || null),
    description: e.description,
    notes: [e.dressCode ? `Dress code: ${e.dressCode}` : null].filter((s): s is string => Boolean(s)),
    url,
    organizer: studioName,
  };
}

/** Only events with a real start can be put in a calendar. */
export function calendarable<T extends { startsAt: Date | null }>(rows: T[]) {
  return rows.filter((r): r is T & { startsAt: Date } => r.startsAt instanceof Date);
}
