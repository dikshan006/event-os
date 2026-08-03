import type { MetadataRoute } from "next";

/**
 * Only the three public marketing pages.
 *
 * Deliberately not generated from the database: published wedding sites belong
 * to the couples, not to us, and listing them here would put a stranger's guest
 * list one crawl away from a search index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  if (!base) return [];

  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/weddings`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/request-access`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
  ];
}
