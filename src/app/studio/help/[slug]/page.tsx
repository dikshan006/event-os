import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStudio } from "@/server/services/context";
import { articleBySlug, categoryBySlug, prevNext } from "@/lib/help";
import { HELP_BODIES } from "@/components/help/articles";

/**
 * One help article.
 *
 * Breadcrumbs, body, and a way to the next one. The previous/next pair matters
 * more than it looks: someone reading "Managing guests" because they are
 * setting up their first wedding has a next question, and it is almost always
 * the next article. Ending on a dead end sends them back to the index to work
 * out where they were.
 */

/**
 * No `generateStaticParams`.
 *
 * The article bodies are static, but the page is not: `requireStudio()` reads
 * the session cookie, so every render is dynamic regardless of what this file
 * asks for. Declaring static params would only invite Next to attempt a
 * prerender that cannot succeed.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const article = articleBySlug(slug);
  return {
    title: article ? `${article.title} — EventOS Help` : "Help — EventOS",
    description: article?.blurb,
    robots: { index: false, follow: false },
  };
}

export default async function HelpArticle(
  { params }: { params: Promise<{ slug: string }> },
) {
  await requireStudio();

  const { slug } = await params;
  const article = articleBySlug(slug);
  const Body = HELP_BODIES[slug];
  // Both must exist: an entry in the index with no body is a broken link the
  // planner would meet as a blank page.
  if (!article || !Body) notFound();

  const category = categoryBySlug(article.category);
  const { prev, next } = prevNext(slug);

  return (
    <article className="help-article">
      <nav className="help-crumbs" aria-label="Breadcrumb">
        <Link href="/studio/help">Help</Link>
        <span aria-hidden="true">→</span>
        {category && (
          <>
            <Link href={`/studio/help#${category.slug}`}>{category.title}</Link>
            <span aria-hidden="true">→</span>
          </>
        )}
        <b aria-current="page">{article.title}</b>
      </nav>

      <header className="help-head">
        <h1 className="h1 serif">{article.title}</h1>
      </header>

      <div className="help-body">
        <Body />
      </div>

      <nav className="help-nextprev" aria-label="More articles">
        {prev ? (
          <Link href={`/studio/help/${prev.slug}`} className="help-np">
            <em>← Previous</em>
            <b>{prev.title}</b>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/studio/help/${next.slug}`} className="help-np next">
            <em>Next →</em>
            <b>{next.title}</b>
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <p className="help-back">
        <Link href="/studio/help">← All help articles</Link>
      </p>
    </article>
  );
}
