import type { Event, Wedding } from "@prisma/client";
import { googleCalendarUrl } from "@/lib/calendar";
import { toCalendarEvent } from "@/server/services/calendar-feed";
import { appleMapsUrl, googleMapsUrl, hasPlace, placeQuery, resolvePlace } from "@/lib/maps";

/**
 * Everything practical about an event, in one block under it: where it is, how
 * to get there, and how to put it in a calendar.
 *
 * The first version hid these behind two <details> disclosures. That kept the
 * page quiet but made a guest hunt — two taps to find out an address, and no
 * way to see at a glance that directions existed at all. They are now simply
 * present. Five links is not clutter when they are the five things a guest
 * actually wants; grouping and type weight do the work that hiding was doing.
 *
 * Still no JavaScript, and no icons: a wedding invitation set in Cormorant does
 * not want an emoji in it, and the labels already say what each link is.
 */

type Props = {
  event: Event;
  wedding: Wedding;
  studioName: string;
  /** Invite code for a guest, wedding slug on the public site. */
  token: string;
  appUrl: string;
};

export function EventActions({ event, wedding, studioName, token, appUrl }: Props) {
  const place = resolvePlace(event, wedding);
  const canMap = hasPlace(place);

  // An event with no start cannot become a calendar entry. Rather than offering
  // a control that produces a broken file, it is absent — and the planner is
  // prompted for the time in the Schedule Builder instead.
  const canCalendar = event.startsAt instanceof Date;
  if (!canMap && !canCalendar) return null;

  const ics = `${appUrl}/calendar/${encodeURIComponent(token)}/${event.id}.ics`;
  // The address line, but never a repeat of the venue name already printed
  // directly above it.
  const address = place.address && place.address !== place.name ? place.address : null;

  return (
    <div className="s-detail">
      {address && <p className="s-detail-address">{address}</p>}

      <div className="s-detail-groups">
        {canMap && (
          <div className="s-detail-group">
            <p className="s-detail-label">Directions</p>
            <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
              Open in Google Maps
            </a>
            <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
              Open in Apple Maps
            </a>
          </div>
        )}

        {canCalendar && (
          <div className="s-detail-group">
            <p className="s-detail-label">Add to calendar</p>
            <a
              href={googleCalendarUrl(
                toCalendarEvent(event, wedding, studioName, `${appUrl}/invite/${token}`),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Calendar
            </a>
            {/*
              One file serves both: Apple Calendar and Outlook read the same
              RFC 5545 payload. They are named separately because a guest looks
              for their own application, not for a file format.
            */}
            <a href={ics} download>
              Apple Calendar
            </a>
            <a href={ics} download>
              Outlook
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Add the whole schedule" — one tap for every event a guest can see.
 * Once, at the foot of the programme, and hidden when nothing has a time yet.
 */
export function ScheduleCalendarLink({
  events,
  token,
  appUrl,
}: {
  events: Event[];
  token: string;
  appUrl: string;
}) {
  if (!events.some(e => e.startsAt instanceof Date)) return null;
  return (
    <a className="s-act-all" href={`${appUrl}/calendar/${encodeURIComponent(token)}/all.ics`} download>
      Add the whole schedule to your calendar
    </a>
  );
}

/**
 * Directions to the main venue, for the Travel section — separate from the
 * per-event block because a guest reading "Getting here" wants the venue, not
 * whichever event they last scrolled past.
 */
export function VenueDirections({ wedding }: { wedding: Wedding }) {
  const place = resolvePlace({ location: null, address: null, lat: null, lng: null }, wedding);
  if (!hasPlace(place)) return null;

  return (
    <div className="s-detail-group s-detail-venue">
      <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
        Open in Google Maps
      </a>
      <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
        Open in Apple Maps
      </a>
      <p className="s-detail-address">{placeQuery(place)}</p>
    </div>
  );
}
