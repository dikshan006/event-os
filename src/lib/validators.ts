import { z } from "zod";

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
  template: z.enum(["BLUSH_ROMANCE", "MODERN_SAGE", "CLASSIC_ELEGANCE"]),
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

export const zRegistryItem = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
  price: z.string().max(30).optional().or(z.literal("")),
  retailer: z.string().max(80).optional().or(z.literal("")),
});

export const zStudioBranding = z.object({
  name: z.string().min(1).max(120),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
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
