/**
 * The Help Center's table of contents.
 *
 * Plain data, no JSX, no `server-only` — the index page, the article page, the
 * search box (a Client Component) and the previous/next control all need the
 * same list, and a second copy of it is how a help centre ends up with a link
 * to an article that no longer exists.
 *
 * Order is the order a planner meets the product, not alphabetical and not the
 * order we built it. `prevNext()` walks this array, so moving an article means
 * moving its entry and nothing else.
 *
 * `keywords` exist because people search for the word they have, not the word
 * we chose. Someone looking for "table plan" will not type "seating", and
 * someone looking for "save the date" is asking about invitations.
 */

export type HelpCategory = {
  slug: string;
  title: string;
  blurb: string;
};

export type HelpArticle = {
  slug: string;
  title: string;
  category: string;
  /** One line, shown under the title in the index and in search results. */
  blurb: string;
  /** Extra search terms. Never shown; matched against. */
  keywords: string[];
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    blurb: "Create a wedding, choose how it looks, and fill in the details.",
  },
  {
    slug: "guests",
    title: "Guests",
    blurb: "Add the people coming, and sort them into groups.",
  },
  {
    slug: "the-day",
    title: "The day itself",
    blurb: "The running order, and who sits where.",
  },
  {
    slug: "website",
    title: "The website",
    blurb: "Photographs, gifts, and the sections guests see.",
  },
  {
    slug: "replies",
    title: "Replies",
    blurb: "What guests send back, and where to read it.",
  },
  {
    slug: "going-live",
    title: "Going live",
    blurb: "Publishing, sharing invitations, and what happens afterwards.",
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "creating-your-first-wedding",
    title: "Creating your first wedding",
    category: "getting-started",
    blurb: "Start a new wedding and understand what you have just made.",
    keywords: ["new", "create", "add wedding", "start", "first", "begin", "setup"],
  },
  {
    slug: "choosing-a-template",
    title: "Choosing a template",
    category: "getting-started",
    blurb: "Six designs, and how to pick the one that suits the couple.",
    keywords: ["design", "theme", "style", "look", "colours", "colors", "font", "stationery"],
  },
  {
    slug: "adding-wedding-details",
    title: "Adding wedding details",
    category: "getting-started",
    blurb: "Names, date, venue, and the story that opens the website.",
    keywords: ["date", "venue", "location", "address", "time zone", "timezone", "story", "couple"],
  },
  {
    slug: "branding-your-wedding",
    title: "Branding your wedding",
    category: "getting-started",
    blurb: "Put your studio's name and logo on everything the couple sees.",
    keywords: ["logo", "brand", "colour", "color", "white label", "font", "studio", "letterhead"],
  },
  {
    slug: "managing-guests",
    title: "Managing guests",
    category: "guests",
    blurb: "Add guests one at a time, or bring in a whole list at once.",
    keywords: ["add guest", "import", "csv", "spreadsheet", "list", "export", "delete", "invite code"],
  },
  {
    slug: "creating-groups",
    title: "Creating groups",
    category: "guests",
    blurb: "Label guests so each one sees only the events that apply to them.",
    keywords: ["group", "family", "bridal party", "audience", "tags", "segment", "vip"],
  },
  {
    slug: "building-the-schedule",
    title: "Building the schedule",
    category: "the-day",
    blurb: "Add every event, and decide who is told about each one.",
    keywords: ["events", "timeline", "running order", "ceremony", "reception", "dress code", "agenda"],
  },
  {
    slug: "seating",
    title: "Seating",
    category: "the-day",
    blurb: "Build tables for each event and sit your guests at them.",
    keywords: ["tables", "table plan", "seating chart", "place", "assign", "capacity"],
  },
  {
    slug: "photos-and-gallery",
    title: "Photos & gallery",
    category: "website",
    blurb: "The four places a photograph can go, and what each one is for.",
    keywords: ["photo", "image", "hero", "gallery", "upload", "picture", "album"],
  },
  {
    slug: "registry-and-cash-gifts",
    title: "Registry & cash gifts",
    category: "website",
    blurb: "A wishlist of things, and funds for guests who would rather give money.",
    keywords: ["gift", "present", "wishlist", "registry", "honeymoon fund", "cash", "money", "claim"],
  },
  {
    slug: "rsvps",
    title: "RSVPs",
    category: "replies",
    blurb: "Read replies, meal choices and dietary notes as they arrive.",
    keywords: ["rsvp", "reply", "attending", "declined", "maybe", "meal", "dietary", "allergy"],
  },
  {
    slug: "publishing-your-wedding",
    title: "Publishing your wedding",
    category: "going-live",
    blurb: "Preview it, publish it, and understand what publishing changes.",
    keywords: ["publish", "live", "go live", "preview", "draft", "payment", "pay", "billing"],
  },
  {
    slug: "the-guest-experience",
    title: "Understanding the guest experience",
    category: "going-live",
    blurb: "What arrives, what a guest sees, and why no two guests see the same thing.",
    keywords: ["guest", "invitation", "link", "personal", "portal", "what they see", "experience"],
  },
  {
    slug: "calendar-and-guest-schedule",
    title: "Calendar & guest schedule",
    category: "going-live",
    blurb: "How guests add your events to the calendar on their phone.",
    keywords: ["calendar", "ics", "apple", "google", "outlook", "add to calendar", "reminder"],
  },
  {
    slug: "managing-your-published-website",
    title: "Managing your published website",
    category: "going-live",
    blurb: "Editing after it is live, re-sending invitations, and unpublishing.",
    keywords: ["edit", "change", "update", "unpublish", "resend", "after", "live site"],
  },
];

/* ------------------------------------------------------------- lookups -- */

export const articleBySlug = (slug: string) =>
  HELP_ARTICLES.find(a => a.slug === slug);

export const categoryBySlug = (slug: string) =>
  HELP_CATEGORIES.find(c => c.slug === slug);

export const articlesIn = (categorySlug: string) =>
  HELP_ARTICLES.filter(a => a.category === categorySlug);

/**
 * The article before and after this one, in reading order.
 *
 * Reading order across the whole list rather than within a category: someone
 * working through the help centre from the top is following the workflow, and
 * stopping them at the end of "Guests" to make them go back to the index is a
 * dead end in the middle of a sentence.
 */
export function prevNext(slug: string) {
  const i = HELP_ARTICLES.findIndex(a => a.slug === slug);
  if (i === -1) return { prev: undefined, next: undefined };
  return {
    prev: i > 0 ? HELP_ARTICLES[i - 1] : undefined,
    next: i < HELP_ARTICLES.length - 1 ? HELP_ARTICLES[i + 1] : undefined,
  };
}

/**
 * Substring matching over title, blurb, category and keywords.
 *
 * Deliberately not fuzzy. Fifteen articles is small enough that a plain
 * `includes` finds everything a planner is looking for, and a fuzzy matcher on
 * a list this size mostly produces confident wrong answers — searching "table"
 * and being shown "Choosing a template" first is worse than no result at all.
 */
export function searchHelp(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return HELP_ARTICLES.filter(a => {
    const hay = [
      a.title,
      a.blurb,
      categoryBySlug(a.category)?.title ?? "",
      ...a.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}
