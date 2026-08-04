/**
 * Converting between a venue's local wall time and a UTC instant.
 *
 * A planner types "12 September 2026, 2:00 PM" meaning two o'clock *at the
 * venue*. To put that in a guest's calendar correctly we need the instant it
 * refers to, which depends on the venue's IANA zone and on whether daylight
 * saving is in effect on that date.
 *
 * Done here with `Intl` rather than a date library. `Intl.DateTimeFormat` with
 * a `timeZone` can tell us what wall time any instant corresponds to in that
 * zone; inverting that gives the offset. That is roughly 40 lines and no
 * dependency, versus ~20KB for date-fns-tz doing the same thing.
 */

/**
 * The offset, in minutes, that `zone` was at on the given instant.
 * Positive means ahead of UTC (Europe/Rome in summer is +120).
 */
function offsetMinutesAt(instant: Date, zone: string): number {
  // `en-CA` gives an ISO-ordered date, so the parts can be reassembled without
  // locale-specific ordering surprises.
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }

  // Hour can come back as "24" for midnight in some engines.
  const hour = Number(parts.hour) % 24;

  // What that wall time would be if it were UTC. The gap between the two is
  // precisely the zone's offset at this instant.
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );

  return (asIfUtc - instant.getTime()) / 60_000;
}

/**
 * Turn a local wall time in `zone` into the UTC instant it names.
 *
 * `parts` is plain civil time — no offset, no Z. The two-pass approach handles
 * the fact that the offset itself depends on the instant we are solving for:
 * guess using the offset at the naive timestamp, then correct once. A second
 * pass is enough for every real zone, including the half-hour and 45-minute
 * ones, because offsets never shift by more than a couple of hours.
 *
 * Ambiguous times (the hour that repeats when clocks go back) resolve to the
 * first occurrence, and times that do not exist (the hour skipped when clocks
 * go forward) resolve forward. Both match how calendar software behaves, and
 * neither can occur for a wedding scheduled at a sane hour.
 */
export function zonedWallTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  zone: string,
): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);

  let guess = new Date(naive - offsetMinutesAt(new Date(naive), zone) * 60_000);
  // One correction pass, in case the first guess landed on the other side of a
  // DST boundary from the answer.
  guess = new Date(naive - offsetMinutesAt(guess, zone) * 60_000);
  return guess;
}

/** Parse "2026-09-12" and "14:00" (the value shape of <input type=date|time>). */
export function parseLocalInput(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (![y, m, d, hh, mm].every(n => Number.isFinite(n))) return null;
  return { year: y, month: m, day: d, hour: hh, minute: mm };
}

/** The civil time an instant corresponds to in `zone`, for re-filling a form. */
export function utcToZonedInputs(instant: Date, zone: string): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  const hour = String(Number(p.hour) % 24).padStart(2, "0");
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}` };
}

/** Human display of an instant in the venue's zone, e.g. "Saturday, 12 September". */
export function formatInZone(instant: Date, zone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...opts }).format(instant);
}

/**
 * Zones offered to the planner.
 *
 * `Intl.supportedValuesOf("timeZone")` returns all ~450, which is a miserable
 * select element. This is the shortlist of places weddings in this product
 * actually happen, and the field accepts any IANA string, so nothing is
 * excluded — the list is a convenience, not a constraint.
 */
export const COMMON_TIME_ZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Lisbon",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Athens",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "UTC",
] as const;

/** True when the string is a zone this runtime actually knows. */
export function isValidTimeZone(zone: string): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
