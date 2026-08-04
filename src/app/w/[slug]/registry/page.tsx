import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { publicRegistry, claimGift } from "@/server/services/registry";
import { zGiftClaim } from "@/lib/validators";
import { reportError } from "@/lib/errors";
import { Wishlist, type ClaimResult } from "@/components/Wishlist";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Reveal } from "@/components/Reveal";
import { THEMES } from "@/lib/themes";
import { fmtDate } from "@/lib/utils";

/**
 * The wishlist, as a page of the wedding website rather than a store.
 *
 * It reuses the site's own shell — the same masthead, the same cream, the same
 * type scale — so arriving here from the invitation feels like turning a page
 * rather than following a link somewhere else. Nothing about it is new design.
 *
 * Claims are written, so this cannot be statically cached the way `/w/[slug]`
 * is; it revalidates on demand instead.
 */
export const dynamic = "force-dynamic";

/**
 * Module scope, not a closure inside the component.
 *
 * A server action passed to a Client Component has its captured scope
 * serialized, and every captured function must itself be a server action. This
 * has taken the seating page down once already; the rule is cheap to keep.
 */
async function claim(
  slug: string,
  _state: ClaimResult | null,
  formData: FormData,
): Promise<ClaimResult> {
  "use server";
  const wedding = await prisma.wedding.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!wedding) return { ok: false, message: "This wishlist is no longer available." };

  const parsed = zGiftClaim.safeParse({
    name: formData.get("name"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your name." };
  }

  try {
    await claimGift(wedding.id, String(formData.get("itemId")), parsed.data);
  } catch (err) {
    return { ok: false, message: reportError("gift-claim", err, "That could not be saved.") };
  }
  return { ok: true, name: parsed.data.name.split(" ")[0] || parsed.data.name };
}

export default async function RegistryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wedding = await prisma.wedding.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { studio: true },
  });
  if (!wedding) notFound();

  const { items } = await publicRegistry(wedding.id);
  const theme = THEMES[wedding.template];
  const vars = {
    "--sb": theme.bg, "--si": theme.ink, "--sa": theme.accent, "--sd": theme.deep,
  } as React.CSSProperties;

  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const claimWithSlug = claim.bind(null, slug);

  return (
    <div className="site" style={vars}>
      <SmoothScroll />
      <a href="#wishlist" className="skip">Skip to the wishlist</a>

      <div className="s-wrap">
        <main id="wishlist">
          {/* The invitation's own masthead, reused rather than reinterpreted, so
              arriving here reads as turning a page of the same website. */}
          <header className="s-masthead">
            <p className="s-kicker">{couple}</p>
            <h1 className="s-h" style={{ marginTop: 0 }}>Wishlist</h1>
            <div className="s-hs">with love and thanks</div>
            <p className="s-meta" style={{ marginTop: "var(--sp-5)" }}>{fmtDate(wedding.date)}</p>
          </header>

        <section className="s-sec">

          {/* The request. Set as a piece of stationery — a rule, a small serif
              heading, and room to breathe — rather than as a notice. No icon,
              no colour, nothing that reads as a system message. */}
          <Reveal>
            <div className="s-callout">
              <p className="s-callout-title">A small request</p>
              <p className="s-callout-body">
                If you purchase a gift from our wishlist, please return to this
                page afterwards and click &ldquo;I purchased this gift&rdquo;.
                This helps us keep the wishlist up to date and prevents
                duplicate gifts from being purchased. Thank you for helping us
                celebrate this special moment.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <Wishlist gifts={items} claimAction={claimWithSlug} />
          </Reveal>
        </section>

          <footer className="s-foot">
            <Link className="s-quiet-link" href={`/w/${wedding.slug}`}>
              Back to the invitation
            </Link>
            <p className="by">Designed by {wedding.studio.name}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const w = await prisma.wedding.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { partnerOne: true, partnerTwo: true },
  });
  if (!w) return {};
  return {
    title: `Wishlist — ${w.partnerOne} & ${w.partnerTwo}`,
    description: "A few things we would love as we begin this new chapter.",
  };
}
