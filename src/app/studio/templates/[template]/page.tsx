import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStudio } from "@/server/services/context";
import { WeddingSite } from "@/components/WeddingSite";
import { PreviewBar } from "@/components/PreviewBar";
import { TEMPLATES, type TemplateId } from "@/lib/utils";
import {
  DEMO_WEDDING, DEMO_EVENTS, DEMO_STUDIO, demoPhotosFor, DEMO_PHOTOS_NONE, DEMO_TABLE_BY_EVENT,
} from "@/lib/demo-wedding";

export const metadata: Metadata = { title: "Template preview — EventOS", robots: { index: false } };

/**
 * A live template preview, rendered from shared demo data.
 *
 * Deliberately the real `WeddingSite` component rather than a mock: the planner
 * sees the same typography, spacing, motion, photo toning and responsive
 * behaviour a guest will see, because it *is* the same code. A screenshot or a
 * simplified mock would drift from the product the first time either changed.
 *
 * Nothing is written. There is no wedding id, no database read beyond the
 * session check, and no mutation of any kind.
 */
export default async function TemplatePreview({
  params,
  searchParams,
}: {
  params: Promise<{ template: string }>;
  searchParams: Promise<{ photos?: string }>;
}) {
  await requireStudio();
  const [{ template }, { photos }] = await Promise.all([params, searchParams]);

  const key = template.toUpperCase() as TemplateId;
  if (!(key in TEMPLATES)) notFound();

  /**
   * Two ways to look at a template, and both are worth having.
   *
   * With photographs, a planner sees what their client will see. Without them,
   * they see the thing they are actually choosing between — the typography,
   * the rhythm, the way a page of text is set. Strong photography flatters
   * every layout equally, so comparing templates only in that mode tells you
   * very little; comparing them bare is how the differences become visible.
   *
   * A query parameter rather than client state: the mode survives a reload,
   * can be linked to a colleague, and needs no JavaScript.
   */
  const withPhotos = photos !== "none";
  const wedding = { ...DEMO_WEDDING, template: key };

  return (
    <div className="preview">
      <PreviewBar
        back={{ href: "/studio/weddings/new", label: "Back to templates" }}
        title={TEMPLATES[key].name}
        modes={{
          on: withPhotos ? "photos" : "none",
          photos: `/studio/templates/${template}`,
          none: `/studio/templates/${template}?photos=none`,
        }}
      />

      <div className="preview-frame">
        <WeddingSite
          wedding={wedding}
          studio={DEMO_STUDIO}
          events={DEMO_EVENTS}
          photos={withPhotos ? demoPhotosFor(key) : DEMO_PHOTOS_NONE}
          tableByEvent={DEMO_TABLE_BY_EVENT}
          guest={{
            id: "demo-guest", weddingId: "demo", studioId: "demo",
            name: "Eleanor Whitfield", email: null, phone: null,
            groups: ["Family", "Top Table"], inviteCode: "PREVIEW",
            invitedAt: null, createdAt: DEMO_WEDDING.date, rsvp: null,
          }}
        />
      </div>

      {/* One quiet way back out at the end of a long page, so a planner who has
          scrolled to the footer is not sent hunting for the bar. */}
      <div className="preview-tail">
        <Link href="/studio/weddings/new">Choose a template</Link>
      </div>
    </div>
  );
}
