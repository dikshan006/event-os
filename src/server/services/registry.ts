import "server-only";
import { prisma } from "@/lib/db";
import type { z } from "zod";
import type { zRegistryItem } from "@/lib/validators";

export function listRegistry(studioId: string, weddingId: string) {
  return prisma.registryItem.findMany({ where: { weddingId, wedding: { studioId } }, orderBy: { sortOrder: "asc" } });
}
export function listFunds(studioId: string, weddingId: string) {
  return prisma.cashFund.findMany({ where: { weddingId, wedding: { studioId } } });
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
  return prisma.registryItem.create({
    data: { weddingId, title: input.title, url: input.url, price: input.price || null, retailer },
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
