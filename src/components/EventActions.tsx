import type { Event, Wedding } from "@prisma/client";
import { googleCalendarUrl } from "@/lib/calendar";
import { toCalendarEvent } from "@/server/services/calendar-feed";
import { appleMapsUrl, googleMapsUrl, hasPlace, placeLabel, resolvePlace } from "@/lib/maps";

/**
 * "Add to calendar" and "Directions", under each event on the invitation.
 *
 * Built as native <details> disclosures rather than as a JavaScript popover.
 * That gives keyboard support, screen-reader semantics and Escape-to-close for
 * free, works before hydration and with scripting off, and adds nothing to the
 * bundle — the whole feature ships as HTML. A hand-written menu would have been
 * more code and less accessible.
 *
 * Both controls are entirely derived. The planner enters a venue and a time;
 * nothing here is configured.
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

  // An event with no start time cannot become a calendar entry. Rather than
  // offering a button that produces a broken file, it is simply absent — the
  // planner is prompted for the time in the schedule editor instead.
  const canCalendar = event.startsAt instanceof Date;

  if (!canCalendar && !canMap) return null;

  const ics = `${appUrl}/calendar/${encodeURIComponent(token)}/${event.id}.ics`;

  return (
    <div className="s-act">
      {canCalendar && (
        <details className="s-act-item">
          <summary>
            Add to calendar
            <span className="s-act-caret" aria-hidden="true" />
          </summary>
          <div className="s-act-menu">
            <a
              href={googleCalendarUrl(toCalendarEvent(event, wedding, studioName, `${appUrl}/invite/${token}`))}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Calendar
              <span className="s-act-hint">Opens in a new tab</span>
            </a>
            {/*
              One file serves both: Apple Calendar and Outlook read the same
              RFC 5545 payload. They are listed separately because guests look
              for the name of their own application, not for a file format.
            */}
            <a href={ics} download>
              Apple Calendar
              <span className="s-act-hint">Downloads .ics</span>
            </a>
            <a href={ics} download>
              Outlook
              <span className="s-act-hint">Downloads .ics</span>
            </a>
          </div>
        </details>
      )}

      {canMap && (
        <details className="s-act-item">
          <summary>
            Directions
            <span className="s-act-caret" aria-hidden="true" />
          </summary>
          <div className="s-act-menu">
            <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
              Google Maps
            </a>
            <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
              Apple Maps
            </a>
            {placeLabel(place) && <p className="s-act-place">{placeLabel(place)}</p>}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * "Add the whole schedule" — one tap for every event a guest can see.
 *
 * Sits once at the head of the programme rather than repeating per event, and
 * is hidden entirely when nothing has a time yet.
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
 * Directions to the main venue, for the travel section.
 *
 * Separate from the per-event control because a guest looking at "Getting
 * here" wants the venue, not whichever event they last scrolled past.
 */
export function VenueDirections({ wedding }: { wedding: Wedding }) {
  const place = resolvePlace(
    { location: null, address: null, lat: null, lng: null },
    wedding,
  );
  if (!hasPlace(place)) return null;

  return (
    <div className="s-act s-act-venue">
      <a className="s-act-flat" href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
        Open in Google Maps
      </a>
      <a className="s-act-flat" href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
        Open in Apple Maps
      </a>
    </div>
  );
}
