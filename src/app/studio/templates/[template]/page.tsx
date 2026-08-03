import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStudio } from "@/server/services/context";
import { WeddingSite } from "@/components/WeddingSite";
import { TEMPLATES, type TemplateId } from "@/lib/utils";
import {
  DEMO_WEDDING, DEMO_EVENTS, DEMO_STUDIO, DEMO_PHOTOS, DEMO_TABLE_BY_EVENT,
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
export default async function TemplatePreview({ params }: { params: Promise<{ template: string }> }) {
  await requireStudio();
  const { template } = await params;

  const key = template.toUpperCase() as TemplateId;
  if (!(key in TEMPLATES)) notFound();

  const wedding = { ...DEMO_WEDDING, template: key };

  return (
    <div className="preview">
      <div className="preview-bar">
        <Link className="preview-back" href="/studio/weddings/new">
          <span aria-hidden="true">←</span> Back to templates
        </Link>
        <p className="preview-name">{TEMPLATES[key].name}</p>
        <p className="preview-note">Sample wedding · nothing is saved</p>
      </div>

      <div className="preview-frame">
        <WeddingSite
          wedding={wedding}
          studio={DEMO_STUDIO}
          events={DEMO_EVENTS}
          photos={DEMO_PHOTOS}
          tableByEvent={DEMO_TABLE_BY_EVENT}
          guest={{
            id: "demo-guest", weddingId: "demo", studioId: "demo",
            name: "Eleanor Whitfield", email: null, phone: null,
            groups: ["Family", "Top Table"], inviteCode: "PREVIEW",
            invitedAt: null, createdAt: DEMO_WEDDING.date, rsvp: null,
          }}
        />
      </div>
    </div>
  );
}
