import { prisma } from "@/lib/db";

/**
 * Real weddings to show off on the public site.
 *
 * Resolved from the database rather than hardcoded to a slug. A slug can be
 * changed by the planner who owns it, and a marketing page linking to a 404 is
 * worse than one with no example at all. If the pick is ever wrong, it is
 * overridden by env rather than by a deploy.
 *
 * Order of preference:
 *   1. `SHOWCASE_WEDDING_SLUGS` — comma-separated, shown in the order given.
 *      This is how you curate once there is more than one worth showing.
 *   2. Otherwise the most recently published weddings.
 *
 * Only PUBLISHED weddings are ever eligible: a draft is somebody's unfinished
 * work, and it is not ours to put on the front page.
 */
export type ShowcaseWedding = {
  slug: string;
  couple: string;
  date: Date;
  venue: string | null;
  city: string | null;
  studio: string;
};

export async function showcaseWeddings(limit = 3): Promise<ShowcaseWedding[]> {
  try {
    return await query(limit);
  } catch (err) {
    // The marketing page must not 500 because a query did. This section is the
    // one part of it that touches the database, and it is the least important
    // part of the page — so a database blip costs the example links and
    // nothing else.
    console.error("[showcase] could not load example weddings", err);
    return [];
  }
}

async function query(limit: number): Promise<ShowcaseWedding[]> {
  const curated = (process.env.SHOWCASE_WEDDING_SLUGS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const rows = await prisma.wedding.findMany({
    where: {
      status: "PUBLISHED",
      ...(curated.length ? { slug: { in: curated } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      slug: true,
      partnerOne: true,
      partnerTwo: true,
      date: true,
      venue: true,
      city: true,
      studio: { select: { name: true } },
    },
  });

  const mapped = rows.map(w => ({
    slug: w.slug,
    couple: `${w.partnerOne} & ${w.partnerTwo}`,
    date: w.date,
    venue: w.venue,
    city: w.city,
    studio: w.studio.name,
  }));

  // Respect the curated order, which findMany's `in` does not preserve.
  if (curated.length) {
    mapped.sort((a, b) => curated.indexOf(a.slug) - curated.indexOf(b.slug));
  }
  return mapped;
}
