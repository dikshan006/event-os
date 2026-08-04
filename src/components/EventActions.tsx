import type { Event, Wedding } from "@prisma/client";
import {
  googleCalendarUrl,
  outlookCalendarUrl,
  googleSubscribeUrl,
  outlookSubscribeUrl,
} from "@/lib/calendar";
import { toCalendarEvent } from "@/server/services/calendar-feed";
import { appleMapsUrl, googleMapsUrl, hasPlace, placeQuery, resolvePlace } from "@/lib/maps";

/**
 * The practical block under each event.
 *
 * Two tiers, deliberately. Directions are a quiet pair of links immediately
 * under the venue — a guest glances at them once, and on a page with five
 * events, five full-weight "DIRECTIONS" blocks were the loudest thing on the
 * schedule. The calendar row keeps a label because "add to calendar" is a
 * decision rather than a glance.
 *
 * Only Apple downloads a file. Google and Outlook open their own web calendar
 * with the event already composed, which is what a guest on a phone actually
 * wants — a downloaded .ics on Android is a file in a folder, not an event.
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
  const canCalendar = event.startsAt instanceof Date;
  if (!canMap && !canCalendar) return null;

  const ics = `${appUrl}/calendar/${encodeURIComponent(token)}/${event.id}.ics`;
  const cal = canCalendar
    ? toCalendarEvent(event, wedding, studioName, `${appUrl}/invite/${token}`)
    : null;

  // Never repeat the venue name already printed directly above.
  const address = place.address && place.address !== place.name ? place.address : null;

  return (
    <div className="s-detail">
      {address && <p className="s-detail-address">{address}</p>}

      {canMap && (
        <p className="s-inline s-inline-quiet">
          <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
            Google Maps
          </a>
          <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
            Apple Maps
          </a>
        </p>
      )}

      {cal && (
        <div className="s-detail-group">
          <p className="s-detail-label">Add to calendar</p>
          <p className="s-inline">
            <a href={googleCalendarUrl(cal)} target="_blank" rel="noopener noreferrer">
              Google
            </a>
            <a href={outlookCalendarUrl(cal)} target="_blank" rel="noopener noreferrer">
              Outlook
            </a>
            {/* The only download. On an Apple device this opens the system's
                own Add to Calendar sheet, which is the native workflow; it is
                also the file every other calendar application can read. */}
            <a href={ics} download>
              Apple
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The whole schedule, once at the foot of the programme.
 *
 * Google and Outlook subscribe to the feed rather than importing a copy of it.
 * Neither has a URL that creates several events at once, and subscribing is the
 * better answer regardless: one action for every event, and if the planner
 * moves the dinner an hour later it moves in the guest's calendar too. An
 * imported file goes stale the moment the schedule changes.
 */
export function ScheduleCalendarLink({
  events,
  token,
  appUrl,
  weddingName,
}: {
  events: Event[];
  token: string;
  appUrl: string;
  weddingName: string;
}) {
  if (!events.some(e => e.startsAt instanceof Date)) return null;

  const feed = `${appUrl}/calendar/${encodeURIComponent(token)}/all.ics`;

  return (
    <div className="s-detail s-detail-all">
      <p className="s-detail-label">Add the whole schedule</p>
      <p className="s-inline">
        <a href={googleSubscribeUrl(feed)} target="_blank" rel="noopener noreferrer">
          Google
        </a>
        <a href={outlookSubscribeUrl(feed, weddingName)} target="_blank" rel="noopener noreferrer">
          Outlook
        </a>
        <a href={feed} download>
          Apple
        </a>
      </p>
      <p className="s-detail-address">
        Google and Outlook stay up to date if anything changes.
      </p>
    </div>
  );
}

/**
 * Directions to the main venue, for the Travel section — separate from the
 * per-event links because a guest reading "Getting here" wants the venue, not
 * whichever event they last scrolled past.
 */
export function VenueDirections({ wedding }: { wedding: Wedding }) {
  const place = resolvePlace({ location: null, address: null, lat: null, lng: null }, wedding);
  if (!hasPlace(place)) return null;

  return (
    <div className="s-detail-venue">
      <p className="s-inline s-inline-quiet">
        <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
          Google Maps
        </a>
        <a href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
          Apple Maps
        </a>
      </p>
      <p className="s-detail-address">{placeQuery(place)}</p>
    </div>
  );
}
