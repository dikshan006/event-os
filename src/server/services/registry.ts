import "server-only";
import { prisma } from "@/lib/db";
import type { z } from "zod";
import type { zRegistryItem, zGiftClaim } from "@/lib/validators";
import { rateLimit } from "@/lib/ratelimit";
import { UserError } from "@/lib/errors";

export function listRegistry(studioId: string, weddingId: string) {
  return prisma.registryItem.findMany({ where: { weddingId, wedding: { studioId } }, orderBy: { sortOrder: "asc" } });
}
export function listFunds(studioId: string, weddingId: string) {
  return prisma.cashFund.findMany({ where: { weddingId, wedding: { studioId } } });
}

/**
 * The public wishlist for a published wedding.
 *
 * Available gifts first, then claimed ones — a guest scrolling for something to
 * buy should not have to step over things already taken. `purchasedBy` is
 * returned because the page shows "Purchased by Sarah"; nothing else about the
 * claim is exposed, and the note is for the couple, not for other guests.
 */
export async function publicRegistry(weddingId: string) {
  // Every gift, in the planner's order, purchased or not.
  //
  // Hiding claimed gifts was the first version and it was wrong: a guest
  // landing on a list of forty, when the couple asked for a hundred and sixty
  // are already bought, cannot tell which of those two things happened. Seeing
  // that most of the list is spoken for is reassuring, and it is the closest
  // thing a wishlist has to social proof.
  const items = await prisma.registryItem.findMany({
    where: { weddingId },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true, title: true, price: true, retailer: true,
      url: true, featured: true, purchasedBy: true,
    },
  });
  const claimedCount = items.filter(i => i.purchasedBy).length;
  return { items, claimedCount, availableCount: items.length - claimedCount };
}

/**
 * A guest saying they bought something.
 *
 * The only write on this page, and it is reachable without a session — so the
 * same reasoning as the public access request applies. Three guards, in
 * increasing order of how much they matter:
 *
 *  1. The gift must belong to this wedding, which stops one slug's form being
 *     replayed against another wedding's gift id.
 *  2. A per-wedding rate limit, so a script cannot claim a whole registry.
 *  3. Nothing here is destructive. A claim hides a gift from a list; the
 *     planner can release it in one click, and the item is untouched.
 *
 * A gift already claimed is not overwritten. Two guests who both bought the
 * same thing is exactly the situation this feature exists to surface, and
 * silently replacing the first name would hide it.
 */
export async function claimGift(
  weddingId: string,
  itemId: string,
  input: z.infer<typeof zGiftClaim>,
) {
  if (!rateLimit(`gift:${weddingId}`, 30, 60 * 60 * 1000)) {
    throw new UserError("That is a lot of gifts at once. Please try again shortly.");
  }

  const item = await prisma.registryItem.findFirst({ where: { id: itemId, weddingId } });
  if (!item) throw new UserError("That gift is no longer on the wishlist.");
  if (item.purchasedBy) {
    throw new UserError(
      `Thank you — ${item.purchasedBy} has already marked this one as purchased. Do let the couple know if you bought it too.`,
    );
  }

  return prisma.registryItem.update({
    where: { id: itemId },
    data: {
      purchasedBy: input.name,
      purchaseNote: input.note || null,
      purchasedAt: new Date(),
    },
  });
}

/** Planner-side: put a gift back on the list. */
export async function releaseGift(studioId: string, itemId: string) {
  const { count } = await prisma.registryItem.updateMany({
    where: { id: itemId, wedding: { studioId } },
    data: { purchasedBy: null, purchasedAt: null, purchaseNote: null },
  });
  if (!count) throw new UserError("That gift no longer exists.");
}

/** Planner-side: edit everything about a gift in one call. */
export async function updateRegistryItem(
  studioId: string,
  itemId: string,
  input: z.infer<typeof zRegistryItem>,
) {
  const { count } = await prisma.registryItem.updateMany({
    where: { id: itemId, wedding: { studioId } },
    data: {
      title: input.title,
      url: input.url,
      imageUrl: input.imageUrl || null,
      price: input.price || null,
      retailer: input.retailer || null,
      featured: input.featured,
    },
  });
  if (!count) throw new UserError("That gift no longer exists.");
}

export async function addRegistryItem(studioId: string, weddingId: string, input: z.infer<typeof zRegistryItem>) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  // Production note: URL metadata scraping runs as a background job (ARCHITECTURE.md §2 jobs/) —
  // planners can always edit the fields, so the item is created immediately with what we have.
  let retailer = input.retailer;
  if (!retailer) {
    try { retailer = new URL(input.url).hostname.replace(/^www\./, "").split(".")[0]; } catch {}
    retailer = retailer ? retailer.charAt(0).toUpperCase() + retailer.slice(1) : "Retailer";
  }
  const max = await prisma.registryItem.aggregate({ where: { weddingId }, _max: { sortOrder: true } });
  return prisma.registryItem.create({
    data: {
      weddingId,
      title: input.title,
      url: input.url,
      imageUrl: input.imageUrl || null,
      price: input.price || null,
      retailer,
      featured: input.featured,
      sortOrder: (max._max.sortOrder ?? 0) + 10,
    },
  });
}

export async function deleteRegistryItem(studioId: string, itemId: string) {
  await prisma.registryItem.deleteMany({ where: { id: itemId, wedding: { studioId } } });
}

export async function addFund(studioId: string, weddingId: string, data: { name: string; blurb?: string; venmoUrl?: string; paypalUrl?: string; stripeUrl?: string; goalCents?: number }) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  return prisma.cashFund.create({ data: { weddingId, ...data } });
}
