import type { TemplateKey } from "@prisma/client";
import { customAlphabet } from "nanoid";

const codeAlphabet = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 10);
export const inviteCode = () => codeAlphabet();

export function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
export const weddingSlug = (a: string, b: string) =>
  `${slugify(`${a}-and-${b}`)}-${codeAlphabet().slice(0, 4).toLowerCase()}`;

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;

export const initials = (n: string) => n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

export const GROUPS = ["Family", "Close Friends", "Friends", "Bridesmaids", "Groomsmen", "Colleagues", "VIP", "Vendors"] as const;

export const SECTIONS = [
  ["COUNTDOWN", "Countdown"],
  ["TRAVEL", "Travel & Hotels"],
  ["FAQ", "FAQ"],
  ["REGISTRY", "Registry"],
  ["CASH", "Cash Gifts"],
  ["GALLERY", "Photo Gallery"],
] as const;

/**
 * The template registry.
 *
 * Typed as `Record<TemplateKey, ...>` rather than left to inference, which is
 * what makes it impossible to add a value to the Prisma enum without adding it
 * here: the build fails. `THEMES` is already keyed the same way, so the enum,
 * the palettes and this registry now rise and fall together.
 *
 * `import type` — erased at compile time, so this stays safe to import from a
 * Client Component.
 */
export const TEMPLATES: Record<TemplateKey, { name: string; color: string; desc: string }> = {
  BLUSH_ROMANCE: { name: "Blush Romance", color: "#9D5C64", desc: "Romantic and elegant with soft blush tones and delicate details." },
  MODERN_SAGE: { name: "Modern Sage", color: "#87A07A", desc: "Clean, modern and timeless with a fresh sage green palette." },
  CLASSIC_ELEGANCE: { name: "Classic Elegance", color: "#A93A42", desc: "Timeless and sophisticated with a classic red and cream aesthetic." },
  MIDNIGHT_BLOOM: { name: "Midnight Bloom", color: "#C8A99E", desc: "Dark, botanical and cinematic — hairline type and photography lit out of near-black." },
  PACIFIC_LINEN: { name: "Pacific Linen", color: "#26313A", desc: "Bright and textured — a signature hand on soft printed paper, with air to spare." },
  VELVET_BOTANICAL: { name: "Velvet Botanical", color: "#DDB9AD", desc: "A painted still life brought onto the web — burgundy and cream, dramatic serif, deep shadow." },
};

export type TemplateId = TemplateKey;

/**
 * Every template key, as a tuple, for the places that need a runtime list —
 * form validation above all. Derived, never written out: a hand-maintained
 * second copy of this list is what took wedding creation down for the three
 * newest templates.
 */
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as [TemplateKey, ...TemplateKey[]];

/** Is this string a template this build knows about? */
export const isTemplateKey = (v: unknown): v is TemplateKey =>
  typeof v === "string" && v in TEMPLATES;
