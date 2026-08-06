import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { WeddingSite } from "@/components/WeddingSite";
import { personalEvents } from "@/server/services/events";
import { photoSetFor } from "@/server/services/photos";
import { seatsForGuest } from "@/server/services/seating";
import { submitRsvp } from "@/server/services/rsvp";
import { zRsvp } from "@/lib/validators";
import { rateLimit } from "@/lib/ratelimit";

// Personal capability URLs: never index, never cache across guests.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function GuestPortal({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const guest = await prisma.guest.findUnique({
    where: { inviteCode: code },
    include: {
      rsvp: true,
      wedding: {
        include: {
          studio: true,
          faqs: { orderBy: { sortOrder: "asc" } },
          registry: { orderBy: { sortOrder: "asc" } },
          funds: true,
        },
      },
    },
  });
  // Portals work for PUBLISHED weddings; drafts stay private to the studio.
  if (!guest || guest.wedding.status !== "PUBLISHED") notFound();

  const [events, photos, seats] = await Promise.all([
    personalEvents(guest.weddingId, guest.groups),
    photoSetFor(guest.weddingId),
    seatsForGuest(guest.id),
  ]);

  // Table name per event, so the invitation can show it beside the event it
  // belongs to rather than as one detached "your table" line.
  const tableByEvent = Object.fromEntries(seats.map(s => [s.eventId, s.table.name]));

  async function rsvpAction(inviteCode: string, input: { status: string; meal: string; dietary: string; notes: string }) {
    "use server";
    // Invite code as the limiter key: a code can update its RSVP, not hammer the endpoint.
    if (!(await rateLimit(`rsvp:${inviteCode}`, 6, 60_000))) throw new Error("Too many attempts \u2014 please wait a moment.");
    await submitRsvp(inviteCode, zRsvp.parse(input));
  }

  return (
    <WeddingSite
      wedding={guest.wedding}
      studio={guest.wedding.studio}
      events={events}
      guest={guest}
      photos={photos}
      tableByEvent={tableByEvent}
      rsvpAction={rsvpAction}
    />
  );
}
