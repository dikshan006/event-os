import { demoGiftRows } from "./demo-gifts";
import { DEMO_HERO, DEMO_STORY } from "./demo-photos.generated";
import { EMPTY_PHOTOS, type PhotoSet } from "./photo-view";

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
 * The demo photography.
 *
 * Two real photographs, run through the same pipeline a planner's upload goes
 * through — the AVIF/WebP ladder, the blur placeholder and, most importantly,
 * the tone measurement. The border colour, exposure and saturation a planner
 * sees in a preview are therefore computed from these images exactly as they
 * would be from their client's, rather than approximated.
 *
 * The same two appear in every template, on purpose: holding the photography
 * constant is what makes the comparison a comparison of design.
 *
 * The gallery re-uses them under distinct ids. WeddingSite de-duplicates by id
 * and excludes whichever photograph it promoted to the story portrait, so
 * without separate ids the Gallery section would render empty and a planner
 * would think the template lacked one.
 */
export const DEMO_PHOTOS: PhotoSet = {
  hero: DEMO_HERO,
  couple: [],
  story: [DEMO_STORY],
  gallery: [
    { ...DEMO_HERO, id: "demo-gallery-1", caption: "The old town, close to midnight" },
    { ...DEMO_STORY, id: "demo-gallery-2", caption: "The morning after the engagement" },
  ],
};

/** No photographs at all — the second preview mode. */
export const DEMO_PHOTOS_NONE: PhotoSet = EMPTY_PHOTOS;

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
  // Real enough that the preview's map links open somewhere plausible, and the
  // calendar buttons render exactly as they will on a live invitation.
  venueAddress: "Via Vecchia Fiesolana 62, 50014 Fiesole FI, Italy",
  venueLat: 43.8074,
  venueLng: 11.2925,
  timeZone: "Europe/Rome",
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
  registry: demoGiftRows("demo").map((g, i) =>
    // Two already claimed, so the preview shows the toggle and the badge doing
    // something rather than an unrealistically untouched list.
    i === 4 ? { ...g, purchasedBy: "Sarah Whitfield", purchasedAt: new Date("2027-04-02T10:00:00Z") }
    : i === 11 ? { ...g, purchasedBy: "Tom Iversen", purchasedAt: new Date("2027-04-06T18:20:00Z") }
    : g),
  funds: [
    { id: "c1", weddingId: "demo", name: "Honeymoon in Kyoto",
      blurb: "Two weeks in spring, mostly walking and eating.",
      venmoUrl: null, paypalUrl: "https://example.com", stripeUrl: "https://example.com", goalCents: null },
  ],
};

/**
 * Public events for the preview — the same programme in every template.
 *
 * `startsAt` is set so the preview shows the calendar controls in their real
 * state. Instants are UTC; June in Rome is CEST (+2), so 19:00 local is 17:00Z.
 */
const utc = (iso: string) => new Date(iso);

export const DEMO_EVENTS = [
  { id: "e1", weddingId: "demo", title: "Welcome Drinks", description: null,
    day: "Friday, 11 June", time: "7:00 PM", sortKey: 10,
    startsAt: utc("2027-06-11T17:00:00Z"), endsAt: utc("2027-06-11T20:00:00Z"),
    location: "Piazza Mino, Fiesole", address: "Piazza Mino da Fiesole, 50014 Fiesole FI, Italy",
    lat: 43.8073, lng: 11.2936, dressCode: "Come as you are",
    isPublic: true, audiences: [] },
  { id: "e2", weddingId: "demo", title: "The Ceremony", description:
      "Please be seated by twenty to five; we would rather begin late than begin without you.",
    day: "Saturday, 12 June", time: "5:00 PM", sortKey: 20,
    startsAt: utc("2027-06-12T15:00:00Z"), endsAt: utc("2027-06-12T16:00:00Z"),
    location: "The Walled Garden", address: null, lat: null, lng: null,
    dressCode: "Black tie optional",
    isPublic: true, audiences: [] },
  { id: "e3", weddingId: "demo", title: "Dinner", description: null,
    day: "Saturday, 12 June", time: "7:30 PM", sortKey: 30,
    startsAt: utc("2027-06-12T17:30:00Z"), endsAt: utc("2027-06-12T22:00:00Z"),
    location: "The Limonaia", address: null, lat: null, lng: null,
    dressCode: null, isPublic: true, audiences: [] },
  { id: "e4", weddingId: "demo", title: "Farewell Brunch", description: null,
    day: "Sunday, 13 June", time: "11:00 AM", sortKey: 40,
    startsAt: utc("2027-06-13T09:00:00Z"), endsAt: null,
    location: "Terrace, Villa Aurelia", address: null, lat: null, lng: null,
    dressCode: null, isPublic: true, audiences: [] },
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
