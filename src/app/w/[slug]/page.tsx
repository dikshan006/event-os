import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { WeddingSite } from "@/components/WeddingSite";
import { photoSetFor, toPhotoView } from "@/server/services/photos";
import { fmtDate } from "@/lib/utils";

// Public sites are read-heavy and change rarely — cache for 60s at the edge.
export const revalidate = 60;

export default async function PublicWeddingSite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wedding = await prisma.wedding.findFirst({
    where: { slug, status: "PUBLISHED" }, // drafts and other tenants' slugs are simply a 404
    include: {
      studio: true,
      faqs: { orderBy: { sortOrder: "asc" } },
      registry: { orderBy: { sortOrder: "asc" } },
      funds: true,
      events: { where: { isPublic: true }, orderBy: { sortKey: "asc" } },
    },
  });
  if (!wedding) notFound();

  const photos = await photoSetFor(wedding.id);

  return <WeddingSite wedding={wedding} studio={wedding.studio} events={wedding.events} photos={photos} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const w = await prisma.wedding.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { studio: true, photos: { where: { slot: "HERO" }, take: 1 } },
  });
  if (!w) return {};
  const title = `${w.partnerOne} & ${w.partnerTwo}`;
  const description = `Join us ${fmtDate(w.date)}${w.venue ? ` at ${w.venue}` : ""}${w.city ? `, ${w.city}` : ""}. Designed by ${w.studio.name}.`;
  const base = process.env.APP_URL;

  // The hero doubles as the social preview card, so a shared link shows the
  // couple's photograph rather than a blank rectangle.
  const hero = w.photos[0] ? toPhotoView(w.photos[0]) : null;
  const images = hero
    ? [{ url: hero.src, width: hero.width, height: hero.height, alt: hero.alt || title }]
    : undefined;

  return {
    title,
    description,
    ...(base ? { metadataBase: new URL(base) } : {}),
    openGraph: { title, description, type: "website", url: `/w/${w.slug}`, siteName: w.studio.name, images },
    twitter: { card: hero ? "summary_large_image" : "summary", title, description, images },
    robots: { index: true, follow: false },
  };
}
