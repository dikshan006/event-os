/**
 * Calendar links and .ics files, generated from event records.
 *
 * Two outputs from one shape:
 *   - a Google Calendar template URL, which opens in a new tab
 *   - an RFC 5545 VCALENDAR, which Apple Calendar and Outlook both import
 *
 * Nothing here is configurable by the planner. Everything is derived from the
 * event, the wedding and the studio that already exist.
 */

export type CalendarEvent = {
  /** Stable per event, so re-importing updates rather than duplicating. */
  uid: string;
  title: string;
  /** The wedding it belongs to, e.g. "Amelia & Theodore" — used in the title. */
  weddingName: string;
  /** UTC instants. An event without a start cannot be put in a calendar. */
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  address: string | null;
  description: string | null;
  /** Dress code, table number — anything worth carrying into the entry. */
  notes: string[];
  url: string | null;
  organizer: string | null;
};

/** Default length for an event whose end the planner did not set. */
const DEFAULT_DURATION_MIN = 120;

export function eventEnd(e: Pick<CalendarEvent, "startsAt" | "endsAt">): Date {
  if (e.endsAt && e.endsAt > e.startsAt) return e.endsAt;
  return new Date(e.startsAt.getTime() + DEFAULT_DURATION_MIN * 60_000);
}

/** "Ceremony — Amelia & Theodore" */
export function calendarTitle(e: Pick<CalendarEvent, "title" | "weddingName">) {
  return e.weddingName ? `${e.title} — ${e.weddingName}` : e.title;
}

/** The single place that decides where an event physically is. */
export function calendarLocation(e: Pick<CalendarEvent, "location" | "address">) {
  return [e.location, e.address].filter(Boolean).join(", ") || null;
}

/** Description, assembled from the parts that exist. */
export function calendarBody(e: CalendarEvent) {
  return [e.description, ...e.notes, e.url].filter(Boolean).join("\n\n");
}

/* --------------------------------------------------------------- Google -- */

/** `20260912T140000Z` — the only format both Google and RFC 5545 accept. */
function utcStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Google Calendar's event template. Times are given in UTC with a trailing Z,
 * which Google converts into whatever the signed-in user's calendar timezone
 * is — so the entry is correct regardless of where the guest happens to be.
 */
export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(e),
    dates: `${utcStamp(e.startsAt)}/${utcStamp(eventEnd(e))}`,
  });
  const body = calendarBody(e);
  if (body) p.set("details", body);
  const where = calendarLocation(e);
  if (where) p.set("location", where);
  return `https://calendar.google.com/calendar/render?${p}`;
}

/* -------------------------------------------------------------- Outlook -- */

/**
 * Outlook on the web, via its documented compose deeplink.
 *
 * Opens the new-event form with everything filled in — no download, no import
 * step. Times are given as UTC instants with a trailing Z, which Outlook
 * converts to the signed-in user's calendar timezone.
 *
 * `outlook.live.com` is the personal-account host. Work and school accounts
 * live on `outlook.office.com`, and there is no way to know which a guest has
 * from a link on a wedding website — the two are separate products behind the
 * same brand. Personal accounts are overwhelmingly the case for wedding
 * guests, so that is the host used, and the .ics remains for everyone else:
 * Outlook desktop, Office 365, and any other calendar application.
 */
export function outlookCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: calendarTitle(e),
    startdt: e.startsAt.toISOString(),
    enddt: eventEnd(e).toISOString(),
  });
  const body = calendarBody(e);
  if (body) p.set("body", body);
  const where = calendarLocation(e);
  if (where) p.set("location", where);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}

/* ---------------------------------------------------------- subscriptions -- */

/**
 * Adding a whole schedule without downloading anything.
 *
 * Neither Google nor Outlook has a URL that creates several events at once —
 * the compose links above take exactly one. What both *do* have is a way to
 * subscribe to a calendar feed, which turns out to be the better answer
 * anyway: the guest gets every event in one action, and if the planner moves
 * the dinner an hour later, it moves in the guest's calendar too. An imported
 * file would have gone stale the moment the schedule changed.
 *
 * Both take the public URL of an .ics feed — the same endpoint the download
 * uses, which is already addressable by the guest's own capability token.
 */
export function googleSubscribeUrl(icsUrl: string): string {
  // `webcal:` is the conventional scheme for a subscribable feed; Google
  // rewrites it to https on its side.
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(toWebcal(icsUrl))}`;
}

export function outlookSubscribeUrl(icsUrl: string, name: string): string {
  const p = new URLSearchParams({ url: toWebcal(icsUrl), name });
  return `https://outlook.live.com/calendar/0/addfromweb/?${p}`;
}

/** Apple subscribes natively from a webcal: link, without a download. */
export function webcalUrl(icsUrl: string): string {
  return toWebcal(icsUrl);
}

function toWebcal(url: string) {
  return url.replace(/^https?:/i, "webcal:");
}

/* ------------------------------------------------------------------ ics -- */

/**
 * Escape a value for a content line. Per RFC 5545 §3.3.11 backslash, semicolon
 * and comma are special, and literal newlines have to become `\n`.
 */
function esc(v: string) {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to 75 octets per RFC 5545 §3.1.
 *
 * Counted in UTF-8 bytes, not characters: a line of accented text or an emoji
 * measured by `.length` sails past the limit and some parsers — Outlook among
 * them — then truncate or reject the entry. Continuation lines begin with a
 * single space.
 */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte sequence: continuation bytes are 10xxxxxx.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return out.join("\r\n ");
}

function line(name: string, value: string) {
  return fold(`${name}:${esc(value)}`);
}

/**
 * A complete VCALENDAR for one or more events.
 *
 * Times are emitted as UTC instants rather than as a local time with a TZID.
 * That avoids shipping a VTIMEZONE block with its own DST rules — which is
 * where hand-rolled .ics files usually go wrong — and every client resolves a
 * UTC instant to the right local time on its own.
 */
export function buildIcs(events: CalendarEvent[], calendarName: string): string {
  const stamp = utcStamp(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventOS//Wedding Schedule//EN",
    "CALSCALE:GREGORIAN",
    // Not standard, but Apple Calendar and Outlook both read it for the name
    // of an imported calendar, and there is no standard property that does.
    line("X-WR-CALNAME", calendarName),
    "METHOD:PUBLISH",
  ];

  for (const e of events) {
    const body = calendarBody(e);
    const where = calendarLocation(e);

    lines.push(
      "BEGIN:VEVENT",
      // Stable and globally unique: importing the same file twice updates the
      // entry instead of creating a second one.
      line("UID", e.uid),
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(e.startsAt)}`,
      `DTEND:${utcStamp(eventEnd(e))}`,
      line("SUMMARY", calendarTitle(e)),
    );
    if (body) lines.push(line("DESCRIPTION", body));
    if (where) lines.push(line("LOCATION", where));
    if (e.url) lines.push(line("URL", e.url));
    if (e.organizer) lines.push(line("ORGANIZER;CN=" + esc(e.organizer), "MAILTO:noreply@invalid"));
    if (typeof e.notes[0] === "string" && e.notes.length) {
      // Categories help Apple Calendar group them; harmless where unsupported.
      lines.push(line("CATEGORIES", "Wedding"));
    }
    lines.push("TRANSP:OPAQUE", "STATUS:CONFIRMED", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // CRLF throughout, and a trailing one — RFC 5545 §3.1. Outlook is strict.
  return lines.join("\r\n") + "\r\n";
}

/** A filename that survives every operating system. */
export function icsFilename(name: string) {
  const safe = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${safe || "event"}.ics`;
}
