import "server-only";
import { prisma } from "@/lib/db";
import { weddingSlug } from "@/lib/utils";
import { logAudit } from "./audit";
import type { z } from "zod";
import type { zWedding } from "@/lib/validators";

export function listWeddings(studioId: string) {
  return prisma.wedding.findMany({
    where: { studioId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { guests: true } }, guests: { select: { rsvp: { select: { id: true } } } } },
  });
}

export async function createWedding(studioId: string, actorName: string, input: z.infer<typeof zWedding>) {
  const wedding = await prisma.wedding.create({
    data: {
      studioId,
      slug: weddingSlug(input.partnerOne, input.partnerTwo),
      template: input.template,
      partnerOne: input.partnerOne,
      partnerTwo: input.partnerTwo,
      date: new Date(input.date + "T16:00:00Z"),
      venue: input.venue || null,
      city: input.city || null,
      story: input.story || null,
      sections: input.sections,
      faqs: {
        create: [
          { question: "What should I wear?", answer: "Dress codes are listed with each event in your personal schedule.", sortOrder: 0 },
          { question: "Can I bring a plus one?", answer: "Invitations are addressed to everyone included in your party.", sortOrder: 1 },
        ],
      },
    },
  });
  await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Created wedding \u201C${input.partnerOne} & ${input.partnerTwo}\u201D`, targetId: wedding.id });
  return wedding;
}

export async function updateWedding(studioId: string, weddingId: string, input: z.infer<typeof zWedding>) {
  // updateMany + studioId in the WHERE clause = tenant isolation at the query level
  await prisma.wedding.updateMany({
    where: { id: weddingId, studioId },
    data: {
      template: input.template,
      partnerOne: input.partnerOne,
      partnerTwo: input.partnerTwo,
      date: new Date(input.date + "T16:00:00Z"),
      venue: input.venue || null,
      city: input.city || null,
      story: input.story || null,
      sections: input.sections,
    },
  });
}

export async function unpublishWedding(studioId: string, weddingId: string) {
  await prisma.wedding.updateMany({ where: { id: weddingId, studioId }, data: { status: "DRAFT" } });
}

export async function deleteWedding(studioId: string, actorName: string, weddingId: string) {
  const w = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!w) return;
  await prisma.wedding.delete({ where: { id: w.id } }); // cascades to guests/events/registry/faqs/funds
  await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Deleted wedding \u201C${w.partnerOne} & ${w.partnerTwo}\u201D`, targetId: w.id });
}

export async function duplicateWedding(studioId: string, actorName: string, weddingId: string) {
  const w = await prisma.wedding.findFirst({
    where: { id: weddingId, studioId },
    include: { events: true, registry: true, funds: true, faqs: true },
  });
  if (!w) return;
  const copy = await prisma.wedding.create({
    data: {
      studioId,
      slug: weddingSlug(w.partnerOne, w.partnerTwo + "-copy"),
      template: w.template,
      status: "DRAFT",
      partnerOne: w.partnerOne,
      partnerTwo: `${w.partnerTwo} (Copy)`,
      date: w.date, venue: w.venue, city: w.city, story: w.story, sections: w.sections,
      events: { create: w.events.map(({ id, weddingId, ...e }) => e) },
      registry: { create: w.registry.map(({ id, weddingId, ...r }) => r) },
      funds: { create: w.funds.map(({ id, weddingId, ...f }) => f) },
      faqs: { create: w.faqs.map(({ id, weddingId, ...f }) => f) },
    },
  });
  await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Duplicated wedding \u201C${w.partnerOne} & ${w.partnerTwo}\u201D`, targetId: copy.id });
  return copy;
}
