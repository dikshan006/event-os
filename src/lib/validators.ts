import { z } from "zod";

export const zWedding = z.object({
  partnerOne: z.string().min(1).max(60),
  partnerTwo: z.string().min(1).max(60),
  date: z.string().min(4),
  venue: z.string().max(120).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
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
  day: z.string().min(1).max(80),
  time: z.string().min(1).max(40),
  location: z.string().max(160).optional().or(z.literal("")),
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
