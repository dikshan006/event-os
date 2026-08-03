import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { PhotoSlot } from "@prisma/client";
import { requireStudio, ownWedding } from "@/server/services/context";
import {
  photosBySlot, toPhotoView, uploadPhoto, deletePhoto, replacePhoto, movePhoto, updatePhotoAlt,
  SLOT_META,
} from "@/server/services/photos";
import { storageEnabled } from "@/lib/storage";
import { ImageError, MAX_UPLOAD_BYTES } from "@/lib/images";
import { reportError } from "@/lib/errors";
import { PageHead } from "@/components/ui";

const SLOTS: PhotoSlot[] = ["HERO", "COUPLE", "STORY", "GALLERY"];
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

// Encoding a 15 MB photo into eight derivatives takes longer than Vercel's
// 10-second default. 60s is the ceiling on Hobby and comfortably above the
// worst case measured for a 24-megapixel source.
export const maxDuration = 60;

/** Server actions surface their outcome through a short-lived flash cookie. */
async function flash(message: string, tone: "ok" | "err") {
  (await cookies()).set("photo_flash", `${tone}:${message}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 15,
  });
}

/**
 * Evict the cached public wedding site.
 *
 * `/w/[slug]` is ISR (`revalidate = 60`), and purging it by literal path alone
 * did not reliably evict the entry for a dynamic segment — which is how the
 * site kept serving HTML that referenced derivatives from a *previous* upload.
 * Those objects are deleted the moment a photo is replaced, so the stale page
 * pointed at 404s and every image rendered broken while storage was perfectly
 * healthy. Purging the route pattern as well as the literal path fixes it.
 */
function revalidatePublicSite(slug: string) {
  if (slug && slug !== "undefined") revalidatePath(`/w/${slug}`);
  revalidatePath("/w/[slug]", "page");
}

export default async function PhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const bySlot = await photosBySlot(w.id);

  const jar = await cookies();
  const raw = jar.get("photo_flash")?.value;
  const notice = raw ? { tone: raw.slice(0, raw.indexOf(":")), message: raw.slice(raw.indexOf(":") + 1) } : null;

  async function upload(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const slot = String(formData.get("slot")) as PhotoSlot;
    const file = formData.get("file");
    try {
      if (!(file instanceof File) || !file.size) throw new ImageError("Choose an image to upload.");
      await uploadPhoto(studioId, weddingId, slot, file, String(formData.get("alt") ?? ""), user.name);
      await flash(`${SLOT_META[slot].label} updated.`, "ok");
    } catch (err) {
      await flash(reportError("photo-upload", err, "That image could not be processed."), "err");
    }
    revalidatePath(`/studio/weddings/${weddingId}/photos`);
    revalidatePublicSite(String(formData.get("slug")));
  }

  async function replace(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const file = formData.get("file");
    try {
      if (!(file instanceof File) || !file.size) throw new ImageError("Choose a replacement image.");
      await replacePhoto(studioId, String(formData.get("photoId")), file, user.name);
      await flash("Photo replaced.", "ok");
    } catch (err) {
      await flash(reportError("photo-replace", err, "That image could not be processed."), "err");
    }
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/photos`);
    revalidatePublicSite(String(formData.get("slug")));
  }

  async function remove(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    await deletePhoto(studioId, String(formData.get("photoId")), user.name);
    await flash("Photo removed.", "ok");
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/photos`);
    revalidatePublicSite(String(formData.get("slug")));
  }

  async function move(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    await movePhoto(studioId, String(formData.get("photoId")), formData.get("dir") === "up" ? "up" : "down");
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/photos`);
    revalidatePublicSite(String(formData.get("slug")));
  }

  async function saveText(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    await updatePhotoAlt(
      studioId,
      String(formData.get("photoId")),
      String(formData.get("alt") ?? ""),
      String(formData.get("caption") ?? ""),
    );
    await flash("Description saved.", "ok");
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/photos`);
    revalidatePublicSite(String(formData.get("slug")));
  }

  const tabs = [
    [`/studio/weddings/${w.id}`, "Content"],
    [`/studio/weddings/${w.id}/photos`, "Photos"],
    [`/studio/weddings/${w.id}/guests`, "Guests"],
    [`/studio/weddings/${w.id}/seating`, "Seating"],
    [`/studio/weddings/${w.id}/schedule`, "Schedule"],
    [`/studio/weddings/${w.id}/registry`, "Registry"],
    [`/studio/weddings/${w.id}/rsvps`, "RSVPs"],
  ] as const;

  const total = SLOTS.reduce((n, s) => n + bySlot[s].length, 0);
  const totalBytes = SLOTS.reduce((n, s) => n + bySlot[s].reduce((m, p) => m + p.bytes, 0), 0);

  return (
    <>
      <PageHead back={`/studio/weddings/${w.id}`}
        eyebrow={`${w.partnerOne} & ${w.partnerTwo}`}
        title="Photos"
        sub="Every image is resized, compressed and stored in four widths as AVIF and WebP the moment you upload it, so the website stays fast on a phone."
        actions={<a className="btn btn-outline" href={`/w/${w.slug}`} target="_blank">View website ↗</a>}
      />

      <div className="row wrap" style={{ marginBottom: 24 }}>
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={`btn btn-sm ${label === "Photos" ? "btn-accent" : "btn-outline"}`}>{label}</Link>
        ))}
      </div>

      {notice && (
        <div className="note" style={{ marginBottom: 20, borderStyle: "solid", ...(notice.tone === "err" ? { color: "var(--wine)" } : {}) }}>
          {notice.message}
        </div>
      )}

      {!storageEnabled && (
        <div className="note" style={{ marginBottom: 20 }}>
          <b>Local storage mode.</b> No object store is connected, so images are written to{" "}
          <code>public/uploads</code> on this machine — fine for development, but connect a
          Vercel Blob store (or set the <code>S3_*</code> variables) before going live so
          photos survive a deploy.
        </div>
      )}

      <div className="row between wrap" style={{ marginBottom: 18 }}>
        <div className="meta">
          {total} {total === 1 ? "photo" : "photos"}
          {total > 0 && ` · ${(totalBytes / 1024 / 1024).toFixed(1)} MB of derivatives stored`}
        </div>
        <div className="meta">Up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB per image · JPEG, PNG, WebP, AVIF or HEIC</div>
      </div>

      <div style={{ display: "grid", gap: 22 }}>
        {SLOTS.map(slot => {
          const photos = bySlot[slot];
          const meta = SLOT_META[slot];
          const atCapacity = photos.length >= meta.max;

          return (
            <section key={slot} className="card pad">
              <div className="row between wrap" style={{ marginBottom: 4 }}>
                <h2 className="section-t" style={{ margin: 0 }}>{meta.label}</h2>
                <span className="chip">{photos.length} / {meta.max}</span>
              </div>
              <p className="meta" style={{ marginBottom: 18 }}>{meta.blurb}</p>

              {photos.length > 0 && (
                <div className="ph-grid">
                  {photos.map((p, i) => {
                    const view = toPhotoView(p);
                    return (
                      <div key={p.id} className="ph-item">
                        <div className="ph-thumb" style={{ backgroundImage: `url("${view.blurData}")` }}>
                          <picture>
                            <source type="image/avif" srcSet={view.avif} sizes="320px" />
                            <source type="image/webp" srcSet={view.webp} sizes="320px" />
                            <img src={view.src} alt={view.alt} loading="lazy" decoding="async" />
                          </picture>
                        </div>

                        <div className="ph-meta">
                          <span>{p.width}×{p.height}</span>
                          <span>{(p.bytes / 1024).toFixed(0)} KB</span>
                        </div>

                        <form action={saveText} className="ph-text">
                          <input type="hidden" name="photoId" value={p.id} />
                          <input type="hidden" name="weddingId" value={w.id} />
                          <input type="hidden" name="slug" value={w.slug} />
                          <input className="inp" name="alt" defaultValue={p.alt} placeholder="Describe this photo (for screen readers)" />
                          {slot === "GALLERY" && (
                            <input className="inp" name="caption" defaultValue={p.caption ?? ""} placeholder="Caption (optional)" />
                          )}
                          {slot !== "GALLERY" && <input type="hidden" name="caption" value={p.caption ?? ""} />}
                          <button className="btn btn-ghost btn-sm" type="submit">Save text</button>
                        </form>

                        <div className="ph-actions">
                          {meta.max > 1 && (
                            <>
                              <form action={move}>
                                <input type="hidden" name="photoId" value={p.id} />
                                <input type="hidden" name="weddingId" value={w.id} />
                                <input type="hidden" name="slug" value={w.slug} />
                                <input type="hidden" name="dir" value="up" />
                                <button className="btn btn-outline btn-sm" type="submit" disabled={i === 0} aria-label="Move earlier">↑</button>
                              </form>
                              <form action={move}>
                                <input type="hidden" name="photoId" value={p.id} />
                                <input type="hidden" name="weddingId" value={w.id} />
                                <input type="hidden" name="slug" value={w.slug} />
                                <input type="hidden" name="dir" value="down" />
                                <button className="btn btn-outline btn-sm" type="submit" disabled={i === photos.length - 1} aria-label="Move later">↓</button>
                              </form>
                            </>
                          )}

                          <form action={replace} className="ph-replace">
                            <input type="hidden" name="photoId" value={p.id} />
                            <input type="hidden" name="weddingId" value={w.id} />
                            <input type="hidden" name="slug" value={w.slug} />
                            <label className="btn btn-outline btn-sm">
                              Replace
                              <input type="file" name="file" accept={ACCEPT} required
                                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                            </label>
                            <button className="btn btn-ghost btn-sm" type="submit">Upload</button>
                          </form>

                          <form action={remove}>
                            <input type="hidden" name="photoId" value={p.id} />
                            <input type="hidden" name="weddingId" value={w.id} />
                            <input type="hidden" name="slug" value={w.slug} />
                            <button className="btn btn-danger btn-sm" type="submit">Delete</button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {atCapacity ? (
                <p className="meta" style={{ marginTop: 16 }}>
                  {meta.max === 1
                    ? "Replace or delete the current image to use a different one."
                    : `This section is full — remove a photo to add another.`}
                </p>
              ) : (
                <form action={upload} className="ph-upload">
                  <input type="hidden" name="weddingId" value={w.id} />
                  <input type="hidden" name="slug" value={w.slug} />
                  <input type="hidden" name="slot" value={slot} />
                  <input className="inp" type="file" name="file" accept={ACCEPT} required aria-label={`Upload to ${meta.label}`} />
                  <input className="inp" name="alt" placeholder="Describe this photo (optional)" />
                  <button className="btn btn-primary" type="submit">Upload</button>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
