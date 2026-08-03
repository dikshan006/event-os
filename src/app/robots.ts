import type { MetadataRoute } from "next";

/**
 * The public site should be indexed. The application and the guest invitations
 * must not be.
 *
 * `/invite/` matters most: an invitation URL *is* the credential for that
 * guest's page. It is unguessable, but "unguessable" and "listed in a search
 * index" are not compatible, so it is excluded here as well as carrying its own
 * `noindex`.
 *
 * `/w/` is deliberately left crawlable, matching the `index: true` those pages
 * already declare — a published wedding site is meant to be shared. Worth
 * revisiting as a product decision: couples may not expect their wedding to be
 * findable by searching their names, and defaulting to noindex per wedding
 * would be the more conservative choice.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/studio",
        "/api",
        "/invite/",
        "/reset-password/",
        "/forgot-password",
        "/dashboard",
      ],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  };
}
