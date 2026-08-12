import { TEMPLATE_KEYS } from "./utils";
import { BRAND_FONT_KEYS, DEFAULT_BRAND_FONT } from "./branding";
import { z } from "zod";

/**
 * The passwords that actually appear in credential-stuffing runs.
 *
 * A denylist rather than a composition rule, following current NIST guidance:
 * requiring an uppercase, a digit and a symbol produces `Password1!` across an
 * entire user base and stops nobody, while eight characters plus a check
 * against the known-bad list removes the credentials that are genuinely tried.
 *
 * Short on purpose. The full breach corpus is millions of entries and belongs
 * behind a k-anonymity API call, not in a bundle; these are the ones that lead
 * every list, plus the ones this product invites by name. Comparison is
 * case-insensitive and ignores trailing digits, because `wedding123` is not a
 * meaningfully better password than `wedding`.
 */
const TRIVIAL_PASSWORDS = new Set([
  "password", "passw0rd", "letmein", "welcome", "iloveyou", "admin", "administrator",
  "qwerty", "qwertyui", "asdfgh", "zxcvbnm", "abc", "abcdef", "abcdefg", "abcd",
  "12345678", "123456789", "1234567890", "11111111", "00000000", "87654321",
  "monkey", "dragon", "sunshine", "princess", "football", "baseball", "shadow",
  "master", "superman", "trustno", "changeme", "secret", "login", "test",
  // This is a wedding product. These are the first things anyone tries here.
  "wedding", "weddings", "bride", "groom", "married", "marriage", "eventos",
]);

export function isTrivialPassword(raw: string): boolean {
  const p = raw.trim().toLowerCase();
  if (p.length < 8) return true;
  // Trailing digits and punctuation are the usual way a banned word is smuggled
  // past a denylist, so they are stripped before the comparison.
  const core = p.replace(/[\d\W_]+$/, "");
  return TRIVIAL_PASSWORDS.has(p) || TRIVIAL_PASSWORDS.has(core);
}


export const zWedding = z.object({
  partnerOne: z.string().min(1).max(60),
  partnerTwo: z.string().min(1).max(60),
  date: z.string().min(4),
  venue: z.string().max(120).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  /**
   * The address behind the map links. The planner types it once here and every
   * event inherits it unless it overrides with its own.
   */
  venueAddress: z.string().max(240).optional().or(z.literal("")),
  /** Optional. Only ever used to make the map pin exact. */
  venueLat: z.string().max(24).optional().or(z.literal("")),
  venueLng: z.string().max(24).optional().or(z.literal("")),
  /** IANA zone of the venue. Every event time is read as local time here. */
  timeZone: z.string().max(64).default("UTC"),
  story: z.string().max(4000).optional().or(z.literal("")),
  // Travel details. Optional throughout — the Travel section hides itself when
  // all three are blank rather than filling the gap with invented copy.
  venueNote: z.string().max(1200).optional().or(z.literal("")),
  accommodation: z.string().max(1200).optional().or(z.literal("")),
  travelNote: z.string().max(1200).optional().or(z.literal("")),
  /**
   * Derived from the registry, never written out again.
   *
   * This line used to list three template keys literally. Three more templates
   * were added to the Prisma enum, to the registry and to the picker — and not
   * here, because nothing connected them. The picker offered six, the form
   * posted one of the new three, `parse` threw, and the server action returned
   * a 500. Templates 1-3 worked, which is exactly what made it look like a
   * problem with the new templates rather than with this list.
   */
  template: z.enum(TEMPLATE_KEYS),
  sections: z.array(z.string()).default([]),
});

export const zGuest = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  groups: z.array(z.string()).default([]),
});

export const zEvent = z.object({
  title: z.string().min(1).max(120),
  /**
   * The real date and time, entered as local wall time at the venue. `date` is
   * required — an event has to happen on a day — while `startTime` and
   * `endTime` are optional, because "the morning after, whenever people
   * surface" is a real entry on a real wedding schedule.
   */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  /**
   * Display overrides. Left blank they are generated from the date and time,
   * which is the normal case; filled in they win, so a planner can still write
   * "Late" or "Sunday morning".
   */
  dayLabel: z.string().max(80).optional().or(z.literal("")),
  timeLabel: z.string().max(40).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(160).optional().or(z.literal("")),
  address: z.string().max(240).optional().or(z.literal("")),
  lat: z.string().max(24).optional().or(z.literal("")),
  lng: z.string().max(24).optional().or(z.literal("")),
  dressCode: z.string().max(120).optional().or(z.literal("")),
  isPublic: z.boolean().default(false),
  audiences: z.array(z.string()).default([]),
});

export const zRsvp = z.object({
  status: z.enum(["ACCEPTED", "DECLINED", "MAYBE"]),
  meal: z.string().max(60).optional().or(z.literal("")),
  dietary: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

/** A guest claiming a gift. Name only — there is nothing to verify against. */
export const zGiftClaim = z.object({
  name: z.string().trim().min(2, "Please add your name so the couple know who to thank.").max(80),
  note: z.string().trim().max(600).optional().or(z.literal("")),
});

export const zRegistryItem = z.object({
  title: z.string().min(1).max(140),
  url: z.string().url("Paste the full product link, including https://"),
  imageUrl: z.string().max(600).optional().or(z.literal("")),
  price: z.string().max(30).optional().or(z.literal("")),
  retailer: z.string().max(80).optional().or(z.literal("")),
  featured: z.boolean().default(false),
});

export const zStudioBranding = z.object({
  name: z.string().min(1).max(120),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /**
   * The column is a plain String — this is what keeps it a closed set.
   *
   * `BRAND_FONT_KEYS` is the same array the picker renders from, so a value can
   * only be stored if it was offerable, and adding a face is a one-line change
   * in `lib/branding.ts` rather than a change in three places.
   */
  brandFont: z.enum(BRAND_FONT_KEYS as [string, ...string[]]).default(DEFAULT_BRAND_FONT),
  website: z.string().max(200).optional().or(z.literal("")),
  instagram: z.string().max(120).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional().or(z.literal("")),
});

/**
 * Public access request. Deliberately forgiving: this is the first thing a
 * prospective customer ever submits, and a form that rejects "eventos.co" for
 * missing a scheme loses the lead rather than improving the data.
 *
 * Only name and email are required. Everything else is context we would like
 * but will not trade a submission for.
 */
export const zAccessRequest = z.object({
  name: z.string().trim().min(2, "Please tell us your name.").max(120),
  email: z.string().trim().toLowerCase().email("That does not look like an email address."),
  company: z.string().trim().max(140).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  volume: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Honeypot. Real people never see this field, so anything in it is a bot. */
  role: z.string().max(0).optional().or(z.literal("")),
});
export type AccessRequestInput = z.infer<typeof zAccessRequest>;

/* ------------------------------------------------------------- support -- */

export const TICKET_CATEGORIES = [
  "GETTING_STARTED", "GUESTS_AND_RSVPS", "WEBSITE_AND_DESIGN",
  "SCHEDULE_AND_SEATING", "BILLING", "SOMETHING_BROKEN", "OTHER",
] as const;

/**
 * A new support ticket.
 *
 * Neither `studioId` nor `userId` appears here, and that is the point: both are
 * taken from the session in the service. A schema that accepted them would make
 * it possible to file a ticket into another studio by editing a form field, and
 * the only reliable way to prevent that is for the parameter not to exist.
 */
export const zTicket = z.object({
  subject: z.string().trim().min(4, "Give it a short subject so we can find it again.").max(140),
  category: z.enum(TICKET_CATEGORIES),
  body: z.string().trim().min(10, "Tell us a little more about what is happening.").max(5000),
});
export type TicketInput = z.infer<typeof zTicket>;

export const zTicketReply = z.object({
  body: z.string().trim().min(1, "Write a reply first.").max(5000),
});

/**
 * A coordinate typed into a text field, or nothing.
 *
 * Returns null for blank and for anything out of range rather than throwing:
 * coordinates are an optional refinement, and a mistyped one should quietly
 * fall back to searching by address instead of blocking the save.
 */
export function parseCoord(raw: string | undefined | null, limit: 90 | 180): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}
