import "server-only";
import { prisma } from "@/lib/db";
import { emails } from "@/lib/email";
import { emailBrandingFor } from "@/lib/branding";
import { logAudit } from "./audit";
import type { z } from "zod";
import type { zRsvp } from "@/lib/validators";

/** Guest-facing: the invite code IS the credential. No account required. */
export async function submitRsvp(code: string, input: z.infer<typeof zRsvp>) {
  const guest = await prisma.guest.findUnique({
    where: { inviteCode: code },
    include: { wedding: { include: { studio: true } } },
  });
  if (!guest) throw new Error("Invalid invitation");
  // Defense in depth: the portal page already 404s drafts, but the server
  // action is callable directly — enforce the same rule here.
  if (guest.wedding.status !== "PUBLISHED") throw new Error("Invalid invitation");

  await prisma.rsvp.upsert({
    where: { guestId: guest.id },
    create: { guestId: guest.id, status: input.status, meal: input.meal || null, dietary: input.dietary || null, notes: input.notes || null },
    update: { status: input.status, meal: input.meal || null, dietary: input.dietary || null, notes: input.notes || null, respondedAt: new Date() },
  });

  const couple = `${guest.wedding.partnerOne} & ${guest.wedding.partnerTwo}`;
  await logAudit({
    actorType: "GUEST", actorName: guest.name, studioId: guest.studioId,
    action: `RSVP received \u2014 ${guest.name} (${couple}): ${input.status.toLowerCase()}`, targetId: guest.weddingId,
  });
  if (guest.email) {
    const brand = emailBrandingFor(guest.wedding.studio);
    await emails.rsvpConfirmation({
      to: guest.email, guestName: guest.name, couple,
      studio: guest.wedding.studio.name, color: guest.wedding.studio.brandColor,
      status: input.status, studioId: guest.studioId,
      // The planner's letterhead, matching the invitation this replies to.
      logo: brand.logo, face: brand.face,
      // Same reasoning as the invitation: a reply should reach the planner.
      studioEmail: guest.wedding.studio.contactEmail,
    });
  }
}
