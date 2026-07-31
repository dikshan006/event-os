import "server-only";
import { randomUUID } from "node:crypto";
import type { PhotoSlot } from "@prisma/client";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { processImage, ImageError, asVariants, srcSet, fallbackSrc } from "@/lib/images";
import { asTone, toneStyle } from "@/lib/photo-tone";
import { logAudit } from "./audit";
import type { PhotoView, PhotoSet } from "@/lib/photo-view";

/**
 * Tenant-scoped photo management.
 *
 * Every function takes `studioId` from the caller's session (never from form
 * input) and filters on it, exactly like the guest and registry services — a
 * planner cannot touch another studio's photos even with a valid photo id.
 */

/** HERO is a single image; the other slots are ordered collections. */
export const SINGLE_SLOTS: PhotoSlot[] = ["HERO"];

export const SLOT_META: Record<PhotoSlot, { label: string; blurb: string; max: number }> = {
  HERO: { label: "Hero image", blurb: "The full-width image at the top of the website. Landscape works best.", max: 1 },
  COUPLE: { label: "Couple photos", blurb: "Portraits of the couple, shown beneath the invitation.", max: 6 },
  STORY: { label: "Story photos", blurb: "Images that sit alongside your written story.", max: 4 },
  GALLERY: { label: "Gallery", blurb: "The full photo gallery. Shown when the Gallery section is enabled.", max: 40 },
};

export function listPhotos(studioId: string, weddingId: string) {
  return prisma.photo.findMany({
    where: { weddingId, studioId },
    orderBy: [{ slot: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Grouped by slot — what both the dashboard and the public site want. */
export async function photosBySlot(weddingId: string) {
  const photos = await prisma.photo.findMany({
    where: { weddingId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const bySlot: Record<PhotoSlot, typeof photos> = { HERO: [], COUPLE: [], STORY: [], GALLERY: [] };
  for (const p of photos) bySlot[p.slot].push(p);
  return bySlot;
}

/** Resolve stored keys into browser URLs. The boundary between storage and rendering. */
export function toPhotoView(photo: {
  id: string; alt: string; caption: string | null; width: number; height: number;
  blurData: string; variants: unknown; tone?: unknown;
}): PhotoView {
  const url = (key: string) => storage().publicUrl(key);
  const variants = asVariants(photo.variants);
  return {
    id: photo.id,
    alt: photo.alt,
    caption: photo.caption,
    width: photo.width,
    height: photo.height,
    blurData: photo.blurData,
    avif: srcSet(variants, "avif", url),
    webp: srcSet(variants, "webp", url),
    src: fallbackSrc(variants, url),
    style: toneStyle(asTone(photo.tone)),
  };
}

/** Everything the public wedding site needs, in one query. */
export async function photoSetFor(weddingId: string): Promise<PhotoSet> {
  const bySlot = await photosBySlot(weddingId);
  return {
    hero: bySlot.HERO[0] ? toPhotoView(bySlot.HERO[0]) : null,
    couple: bySlot.COUPLE.map(toPhotoView),
    story: bySlot.STORY.map(toPhotoView),
    gallery: bySlot.GALLERY.map(toPhotoView),
  };
}

export async function uploadPhoto(
  studioId: string,
  weddingId: string,
  slot: PhotoSlot,
  file: File,
  alt: string,
  actorName: string,
) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");

  const existing = await prisma.photo.count({ where: { weddingId, studioId, slot } });
  const { max, label } = SLOT_META[slot];
  if (existing >= max) {
    throw new ImageError(
      max === 1
        ? `${label} already has an image — replace or remove it first.`
        : `${label} is limited to ${max} photos.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.byteLength) throw new ImageError("That file was empty.");

  const store = storage();
  // One prefix owns every derivative, so cleanup is a single deletePrefix call.
  const basePath = `studios/${studioId}/weddings/${weddingId}/${randomUUID()}`;

  let processed;
  try {
    processed = await processImage(buffer, slot, basePath, (key, body, contentType) =>
      store.put(key, body, contentType),
    );
  } catch (err) {
    // Never leave half-written derivatives behind if encoding failed midway.
    await store.deletePrefix(basePath).catch(() => {});
    throw err;
  }

  const last = await prisma.photo.findFirst({
    where: { weddingId, studioId, slot },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const photo = await prisma.photo.create({
    data: {
      weddingId,
      studioId,
      slot,
      basePath,
      variants: processed.variants,
      blurData: processed.blurData,
      tone: processed.tone,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
      alt: alt.slice(0, 200),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: weddingId,
    action: `Uploaded a ${label.toLowerCase()} photo — ${wedding.partnerOne} & ${wedding.partnerTwo}`,
  });
  return photo;
}

/** Delete the row and every derivative behind it. Storage failure never orphans the row. */
export async function deletePhoto(studioId: string, photoId: string, actorName: string) {
  const photo = await prisma.photo.findFirst({ where: { id: photoId, studioId } });
  if (!photo) throw new Error("Not found");

  await prisma.photo.delete({ where: { id: photo.id } });
  try {
    await storage().deletePrefix(photo.basePath);
  } catch (err) {
    // The row is gone, so the photo has disappeared from the site as the
    // planner expects; the bytes are recoverable from this log line.
    console.error(`[photos] orphaned objects at ${photo.basePath}:`, err);
  }

  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: photo.weddingId,
    action: `Removed a ${SLOT_META[photo.slot].label.toLowerCase()} photo`,
  });
}

/** Replace = upload the new image, then delete the old one. Same slot, same position. */
export async function replacePhoto(
  studioId: string,
  photoId: string,
  file: File,
  actorName: string,
) {
  const old = await prisma.photo.findFirst({ where: { id: photoId, studioId } });
  if (!old) throw new Error("Not found");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.byteLength) throw new ImageError("That file was empty.");

  const store = storage();
  const basePath = `studios/${studioId}/weddings/${old.weddingId}/${randomUUID()}`;

  let processed;
  try {
    processed = await processImage(buffer, old.slot, basePath, (key, body, contentType) =>
      store.put(key, body, contentType),
    );
  } catch (err) {
    await store.deletePrefix(basePath).catch(() => {});
    throw err;
  }

  await prisma.photo.update({
    where: { id: old.id },
    data: {
      basePath,
      variants: processed.variants,
      blurData: processed.blurData,
      tone: processed.tone,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
    },
  });
  // Only after the new derivatives are committed do the old bytes go.
  await store.deletePrefix(old.basePath).catch(err =>
    console.error(`[photos] orphaned objects at ${old.basePath}:`, err),
  );

  await logAudit({
    actorType: "PLANNER", actorName, studioId, targetId: old.weddingId,
    action: `Replaced a ${SLOT_META[old.slot].label.toLowerCase()} photo`,
  });
}

export async function updatePhotoAlt(studioId: string, photoId: string, alt: string, caption: string) {
  await prisma.photo.updateMany({
    where: { id: photoId, studioId },
    data: { alt: alt.slice(0, 200), caption: caption.slice(0, 200) || null },
  });
}

/** Move one photo up or down within its slot by swapping sortOrder with its neighbour. */
export async function movePhoto(studioId: string, photoId: string, direction: "up" | "down") {
  const photo = await prisma.photo.findFirst({ where: { id: photoId, studioId } });
  if (!photo) throw new Error("Not found");

  const siblings = await prisma.photo.findMany({
    where: { weddingId: photo.weddingId, studioId, slot: photo.slot },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const index = siblings.findIndex(p => p.id === photo.id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= siblings.length) return;

  // Rewrite the whole slot's ordering: self-healing if sortOrder ever collides.
  const reordered = [...siblings];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  await prisma.$transaction(
    reordered.map((p, i) => prisma.photo.update({ where: { id: p.id }, data: { sortOrder: i } })),
  );
}
