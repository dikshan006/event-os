import type { PhotoSet, PhotoView } from "./photo-view";
import { toneStyle, type PhotoTone } from "./photo-tone";

/**
 * One fictional wedding, shared by every template preview.
 *
 * The point of holding the content constant is that a planner comparing
 * Blush Romance against Modern Sage is then comparing *design* — type, colour,
 * rhythm, how photographs are toned — rather than reading three different
 * stories and guessing. Same couple, same events, same words, three templates.
 *
 * Nothing here touches the database. The preview renders straight from these
 * objects, so opening it cannot create or modify a wedding.
 */

const DEMO_DATE = new Date("2027-06-12T16:00:00Z");

/**
 * Stand-in photographs.
 *
 * Generated as SVG data URIs rather than shipped as binaries: no storage, no
 * network, and they inherit each template's palette so the preview shows how
 * the toning system behaves rather than pasting the same stock image into
 * three different colour schemes. They are unmistakably indicative — the
 * preview says so — but they demonstrate the frame, crop, tone and spacing
 * accurately, which is what a planner is judging.
 */
function demoPhoto(id: string, w: number, h: number, hues: [string, string, string], tone: PhotoTone): PhotoView {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${hues[0]}"/><stop offset="0.55" stop-color="${hues[1]}"/><stop offset="1" stop-color="${hues[2]}"/>
</linearGradient>
<radialGradient id="v" cx="0.5" cy="0.45" r="0.75">
<stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/>
</radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<ellipse cx="${w * 0.42}" cy="${h * 0.52}" rx="${w * 0.15}" ry="${h * 0.3}" fill="#fff" opacity="0.07"/>
<ellipse cx="${w * 0.6}" cy="${h * 0.55}" rx="${w * 0.13}" ry="${h * 0.27}" fill="#fff" opacity="0.05"/>
<rect width="${w}" height="${h}" fill="url(#v)"/>
</svg>`;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return {
    id,
    alt: "Indicative photograph shown in the template preview",
    caption: null,
    width: w,
    height: h,
    blurData: src,
    // A data URI has no renditions; the same source serves every width.
    avif: `${src} ${w}w`,
    webp: `${src} ${w}w`,
    src,
    style: toneStyle(tone),
  };
}

export const DEMO_PHOTOS: PhotoSet = {
  hero: demoPhoto("demo-hero", 1600, 900, ["#6d6157", "#9a8478", "#c3ae9c"],
    { lum: 0.52, sat: 0.24, spread: 0.19, focusX: 50, focusY: 44 }),
  couple: [demoPhoto("demo-portrait", 800, 1000, ["#574f49", "#867364", "#b39c88"],
    { lum: 0.44, sat: 0.22, spread: 0.17, focusX: 50, focusY: 42 })],
  story: [],
  // The gallery is deliberately small: the preview demonstrates the gallery
  // experience without pretending a real wedding has been shot.
  gallery: [
    demoPhoto("demo-g1", 1200, 1200, ["#5f5a52", "#8d8175", "#bdae9c"],
      { lum: 0.5, sat: 0.2, spread: 0.18, focusX: 50, focusY: 50 }),
    demoPhoto("demo-g2", 1200, 1200, ["#4f4a46", "#7d7167", "#a89684"],
      { lum: 0.42, sat: 0.19, spread: 0.16, focusX: 50, focusY: 50 }),
    demoPhoto("demo-g3", 1200, 1200, ["#6a6259", "#9c8d7d", "#c8b7a3"],
      { lum: 0.56, sat: 0.22, spread: 0.2, focusX: 50, focusY: 50 }),
  ],
};

/** Shaped exactly like a Prisma Wedding + relations, so no preview-only code paths. */
export const DEMO_WEDDING = {
  id: "demo",
  studioId: "demo",
  slug: "demo",
  template: "BLUSH_ROMANCE" as const,
  status: "PUBLISHED" as const,
  partnerOne: "Amelia",
  partnerTwo: "Theodore",
  date: DEMO_DATE,
  venue: "Villa Aurelia",
  city: "Fiesole, Tuscany",
  story:
    "We met on a rainy Thursday in a bookshop that neither of us had meant to visit, " +
    "and argued for an hour about whether the last copy of a novel belonged to one of us.\n\n" +
    "Seven years, four cities and one very opinionated rescue dog later, we are asking the " +
    "people who shaped those years to join us for a weekend in the hills above Florence.",
  venueNote:
    "The villa sits above the city with the ceremony in the walled garden. Cars can reach " +
    "the upper gate; drivers will be waiting from four o'clock.",
  accommodation:
    "A block of rooms is held at Hotel Villa Fiesole under our names until the first of May. " +
    "Several smaller guesthouses sit within a short walk of the piazza.",
  travelNote:
    "Florence airport is thirty minutes away, Pisa about ninety. We are arranging a coach " +
    "from the piazza before the ceremony and back again at midnight.",
  sections: ["COUNTDOWN", "TRAVEL", "FAQ", "REGISTRY", "CASH", "GALLERY"],
  publishedAt: DEMO_DATE,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
  faqs: [
    { id: "f1", weddingId: "demo", sortOrder: 0,
      question: "What should we wear?",
      answer: "Black tie optional. The garden is grass, so heels may prefer a block." },
    { id: "f2", weddingId: "demo", sortOrder: 1,
      question: "Can we bring our children?",
      answer: "The ceremony and dinner are adults only; we would love to see them at the brunch." },
    { id: "f3", weddingId: "demo", sortOrder: 2,
      question: "Is there parking at the villa?",
      answer: "Yes, through the upper gate, with attendants from four o'clock." },
  ],
  registry: [
    { id: "r1", weddingId: "demo", sortOrder: 0, title: "Copper cookware set",
      imageUrl: null, price: "£320", retailer: "Divertimenti", url: "https://example.com" },
    { id: "r2", weddingId: "demo", sortOrder: 1, title: "Hand-thrown dinner service",
      imageUrl: null, price: "£240", retailer: "Leach Pottery", url: "https://example.com" },
    { id: "r3", weddingId: "demo", sortOrder: 2, title: "Linen bedding, ivory",
      imageUrl: null, price: "£180", retailer: "Piglet in Bed", url: "https://example.com" },
  ],
  funds: [
    { id: "c1", weddingId: "demo", name: "Honeymoon in Kyoto",
      blurb: "Two weeks in spring, mostly walking and eating.",
      venmoUrl: null, paypalUrl: "https://example.com", stripeUrl: "https://example.com", goalCents: null },
  ],
};

/** Public events for the preview — the same programme in every template. */
export const DEMO_EVENTS = [
  { id: "e1", weddingId: "demo", title: "Welcome Drinks", description: null,
    day: "Friday, 11 June", time: "7:00 PM", sortKey: 10,
    location: "Piazza Mino, Fiesole", dressCode: "Come as you are",
    isPublic: true, audiences: [] },
  { id: "e2", weddingId: "demo", title: "The Ceremony", description:
      "Please be seated by twenty to five; we would rather begin late than begin without you.",
    day: "Saturday, 12 June", time: "5:00 PM", sortKey: 20,
    location: "The Walled Garden", dressCode: "Black tie optional",
    isPublic: true, audiences: [] },
  { id: "e3", weddingId: "demo", title: "Dinner", description: null,
    day: "Saturday, 12 June", time: "7:30 PM", sortKey: 30,
    location: "The Limonaia", dressCode: null, isPublic: true, audiences: [] },
  { id: "e4", weddingId: "demo", title: "Farewell Brunch", description: null,
    day: "Sunday, 13 June", time: "11:00 AM", sortKey: 40,
    location: "Terrace, Villa Aurelia", dressCode: null, isPublic: true, audiences: [] },
];

export const DEMO_STUDIO = {
  id: "demo",
  name: "Your Studio",
  slug: "demo",
  status: "ACTIVE" as const,
  logoUrl: null,
  brandColor: "#9B5B63",
  website: null,
  instagram: null,
  contactEmail: null,
  contactPhone: null,
  stripeCustomerId: null,
  freeWeddingUsed: false,
  createdAt: DEMO_DATE,
};

/** A seated guest, so the preview shows the personalised table line too. */
export const DEMO_TABLE_BY_EVENT: Record<string, string> = { e3: "Table Four" };
