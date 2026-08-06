import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { storage, storageEnabled } from "@/lib/storage";
import { processLogo, ImageError } from "@/lib/images";
import { UserError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { logAudit } from "./audit";

/**
 * A studio's own brand: the logo and the typeface its name is set in.
 *
 * Separate from `photos.ts` because the tenancy shape is different. A photo
 * belongs to a wedding and the service has to prove the wedding belongs to the
 * caller's studio; a logo *is* the studio, so `studioId` from the session is
 * both the authorisation and the address. There is nothing to look up and
 * nothing to leak.
 */

/**
 * Replace the studio's logo.
 *
 * Order is deliberate: encode and store the new object, commit the row, and
 * only then delete the old prefix. The reverse order has a window in which the
 * old logo is gone and the new one has failed to encode, and the studio's
 * branding is simply missing from every email sent in the meantime. Doing it
 * this way, the worst case is an orphaned object in the bucket, which costs
 * fractions of a cent and can be swept later.
 */
export async function uploadLogo(studioId: string, file: File, actorName: string) {
  if (!storageEnabled) {
    throw new UserError("File storage is not configured yet, so logos cannot be uploaded.");
  }

  /**
   * An upload is the most expensive thing an authenticated planner can ask for:
   * it decodes an arbitrary image with sharp and writes to a bucket we pay for.
   * Nothing else here bounds how often that happens, and a logo is something a
   * studio changes a handful of times ever — so a generous hourly ceiling costs
   * a legitimate planner nothing and caps both the CPU and the storage bill.
   */
  if (!(await rateLimit(`logo:${studioId}`, 20, 60 * 60 * 1000))) {
    throw new UserError("That is a lot of logo changes at once. Please try again shortly.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.byteLength) throw new ImageError("That file was empty.");

  const store = storage();
  const previous = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { logoKey: true },
  });

  const basePath = `studios/${studioId}/brand/${randomUUID()}`;

  let processed;
  try {
    processed = await processLogo(buffer, basePath, (key, body, contentType) =>
      store.put(key, body, contentType),
    );
  } catch (err) {
    await store.deletePrefix(basePath).catch(() => {});
    throw err;
  }

  await prisma.studio.update({
    where: { id: studioId },
    data: {
      logoUrl: store.publicUrl(processed.key),
      logoKey: basePath,
      logoWidth: processed.width,
      logoHeight: processed.height,
    },
  });

  // Best-effort. A failure here leaves an unreferenced object, not a broken
  // studio, so it must not turn a successful upload into an error.
  if (previous?.logoKey && previous.logoKey !== basePath) {
    await store.deletePrefix(previous.logoKey).catch(() => {});
  }

  await logAudit({
    actorType: "PLANNER",
    actorName,
    studioId,
    action: "Updated the studio logo",
  });
}

/** Remove the logo. The studio falls back to its name set in the chosen face. */
export async function removeLogo(studioId: string, actorName: string) {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { logoKey: true },
  });

  await prisma.studio.update({
    where: { id: studioId },
    data: { logoUrl: null, logoKey: null, logoWidth: null, logoHeight: null },
  });

  // The row is the source of truth for what is displayed; the object is just
  // bytes. Clearing the row first means a storage outage cannot leave a logo
  // still rendering after the planner asked for it to be gone.
  if (studio?.logoKey) await storage().deletePrefix(studio.logoKey).catch(() => {});

  await logAudit({
    actorType: "PLANNER",
    actorName,
    studioId,
    action: "Removed the studio logo",
  });
}
