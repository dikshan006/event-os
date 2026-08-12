import Link from "next/link";
import type { Metadata } from "next";
import { requireStudio } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { HelpSearch } from "@/components/help/HelpSearch";
import { StillNeedHelp } from "@/components/help/Ticket";
import { HELP_CATEGORIES, HELP_ARTICLES, articlesIn } from "@/lib/help";

export const metadata: Metadata = {
  title: "Help Center — EventOS",
  robots: { index: false, follow: false },
};

/**
 * The front page of the help centre: a table of contents, first.
 *
 * Deliberately not a search box over an empty page, and deliberately not a
 * landing page of tiles that hide the articles one click away. A planner
 * arriving here has one of two shapes of question — "how do I do this specific
 * thing" or "what am I supposed to do next" — and a numbered list answers both:
 * the first person scans for their word, the second reads it top to bottom as
 * the order of work.
 *
 * The numbering runs across the whole list rather than restarting per category,
 * so "article 8" means one thing, and the order matches the order a wedding is
 * actually built.
 *
 * `requireStudio()` gates this the same way it gates every other studio page.
 * Nothing here is secret, but the help centre lives inside the product and a
 * signed-out visitor should meet the marketing site, not a bare page.
 */
export default async function HelpIndex() {
  await requireStudio();

  // One running number across every category, computed once so the index and
  // the article header cannot disagree about which article is which.
  let n = 0;
  const numbered = new Map<string, number>();
  for (const c of HELP_CATEGORIES) {
    for (const a of articlesIn(c.slug)) numbered.set(a.slug, ++n);
  }

  return (
    <>
      <PageHead
        eyebrow="EventOS"
        title="Help Center"
        sub={`Everything from creating a wedding to publishing it — ${HELP_ARTICLES.length} short guides, in the order you will need them.`}
      />

      <HelpSearch />

      <div className="help-index">
        {HELP_CATEGORIES.map(c => (
          <section key={c.slug} className="help-cat">
            <div className="help-cat-head">
              <h2 className="section-t">{c.title}</h2>
              <p className="meta">{c.blurb}</p>
            </div>
            <ol className="help-toc">
              {articlesIn(c.slug).map(a => (
                <li key={a.slug}>
                  <Link href={`/studio/help/${a.slug}`}>
                    <span className="help-toc-n">
                      {String(numbered.get(a.slug)).padStart(2, "0")}
                    </span>
                    <span className="help-toc-t">
                      <b>{a.title}</b>
                      <em>{a.blurb}</em>
                    </span>
                    <span className="help-toc-go" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <StillNeedHelp />
    </>
  );
}
