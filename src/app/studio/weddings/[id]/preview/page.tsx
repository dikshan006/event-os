import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireStudio, ownWedding } from "@/server/services/context";
import { WeddingSite } from "@/components/WeddingSite";
import { PreviewBar } from "@/components/PreviewBar";
import { GuestMenu } from "@/components/GuestMenu";
import { photoSetFor } from "@/server/services/photos";
import { personalEvents } from "@/server/services/events";
import { seatsForGuest } from "@/server/services/seating";

export const metadata: Metadata = {
  title: "Draft preview — EventOS",
  robots: { index: false, follow: false },
};

/**
 * The planner's own wedding, exactly as it will look once published.
 *
 * Before this existed, `View website` on a draft pointed at `/w/[slug]`, which
 * filters on `status: PUBLISHED` and therefore 404s — the first time a planner
 * could see their own work was after publishing it, which will shortly mean
 * after paying for it. That is the wrong order, and it is the reason this page
 * renders the same `WeddingSite` component the public route does rather than
 * some approximation: an approximation would have to be trusted, and a planner
 * about to pay has no reason to trust it.
 *
 * Draft data, live features, no publishing and no payment. The only difference
 * a planner can see is the badge in the bar, and a guest can never reach this
 * URL to see even that.
 *
 * `force-dynamic`: the public site is cached for 60s at the edge, which is
 * right for guests and wrong here — a planner who saves a change and comes
 * back has to see it, not a minute-old copy.
 */
export const dynamic = "force-dynamic";

export default async function DraftPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `as` is a guest id: preview the personalised invitation that guest receives. */
  searchParams: Promise<{ as?: string }>;
}) {
  const { studioId } = await requireStudio();
  const [{ id }, { as }] = await Promise.all([params, searchParams]);

  // Ownership first. Everything below is scoped to a wedding this studio owns,
  // so no query further down needs to re-check the tenant.
  await ownWedding(studioId, id);

  const wedding = await prisma.wedding.findFirstOrThrow({
    where: { id, studioId },
    include: {
      studio: true,
      faqs: { orderBy: { sortOrder: "asc" } },
      registry: { orderBy: { sortOrder: "asc" } },
      funds: true,
    },
  });

  /**
   * Who the planner is looking through the eyes of.
   *
   * Unset is the public view — what someone following a plain link sees, and
   * the right default because it is the version most guests get. Choosing a
   * guest switches to their invitation: their name, their table, their
   * schedule filtered by the groups they belong to. Those are the parts of a
   * wedding most likely to be wrong and, until now, the parts a planner could
   * not check without publishing and mailing themselves a real invitation.
   *
   * The guest is re-fetched scoped to this wedding rather than trusted from
   * the query string, so `?as=` cannot address a guest of another studio.
   */
  const guest = as
    ? await prisma.guest.findFirst({
        where: { id: as, weddingId: id, studioId },
        include: { rsvp: true },
      })
    : null;

  const [guests, photos, events, seats] = await Promise.all([
    prisma.guest.findMany({
      where: { weddingId: id },
      select: { id: true, name: true, groups: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    photoSetFor(id),
    guest
      ? personalEvents(id, guest.groups)
      : prisma.event.findMany({ where: { weddingId: id, isPublic: true }, orderBy: { sortKey: "asc" } }),
    guest ? seatsForGuest(guest.id) : Promise.resolve([]),
  ]);

  const tableByEvent = Object.fromEntries(seats.map(s => [s.eventId, s.table.name]));
  const base = `/studio/weddings/${id}/preview`;

  return (
    <div className="preview">
      <PreviewBar
        back={{ href: `/studio/weddings/${id}`, label: "Back to wedding" }}
        title={`${wedding.partnerOne} & ${wedding.partnerTwo}`}
        // Shown only here. `WeddingSite` itself has no notion of draft state,
        // so there is no path by which this could reach a guest's page.
        badge={wedding.status === "PUBLISHED" ? "Published" : "Draft"}
      >
        <GuestMenu base={base} guests={guests} current={guest?.id ?? null} />
      </PreviewBar>

      <div className="preview-frame">
        <WeddingSite
          wedding={wedding}
          studio={wedding.studio}
          events={events}
          photos={photos}
          guest={guest}
          tableByEvent={tableByEvent}
          // No `rsvpAction`: the form renders and is inspectable, but a preview
          // must not be able to file an RSVP against a real guest.
        />
      </div>

      <div className="preview-tail">
        <Link href={`/studio/weddings/${id}`}>Back to {wedding.partnerOne} &amp; {wedding.partnerTwo}</Link>
      </div>
    </div>
  );
}
