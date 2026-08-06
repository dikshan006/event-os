import { requireStudio } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { StudioBrandForm } from "@/components/StudioBrandForm";
import { zStudioBranding } from "@/lib/validators";
import { uploadLogo, removeLogo } from "@/server/services/branding";
import { brandingFor } from "@/lib/branding";
import { MAX_UPLOAD_BYTES } from "@/lib/images";
import { reportError } from "@/lib/errors";
import { storageEnabled } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export default async function StudioSettings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { studio } = await requireStudio();
  const { error } = await searchParams;
  const brand = brandingFor(studio);

  async function save(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const parsed = zStudioBranding.safeParse({
      name: formData.get("name"),
      brandColor: formData.get("brandColor"),
      brandFont: formData.get("brandFont") ?? undefined,
      website: formData.get("website") ?? "",
      instagram: formData.get("instagram") ?? "",
      contactEmail: formData.get("contactEmail") ?? "",
      contactPhone: formData.get("contactPhone") ?? "",
    });

    // Same reasoning as the new-wedding form: a rejected field is an expected
    // outcome of a submission, and a throw here renders as an opaque digest.
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      redirect(`/studio/settings?error=${encodeURIComponent(`${issue?.path.join(".") || "form"}: ${issue?.message ?? "invalid value"}`)}`);
    }

    const input = parsed.data;
    await prisma.studio.update({
      where: { id: studioId },
      data: {
        name: input.name,
        brandColor: input.brandColor,
        brandFont: input.brandFont,
        website: input.website || null,
        instagram: input.instagram || null,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
      },
    });
    // "layout" — the sidebar reads the studio, and it lives above this page.
    revalidatePath("/studio", "layout");
  }

  async function saveLogo(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const file = formData.get("logo");

    if (!(file instanceof File) || !file.size) {
      redirect("/studio/settings?error=" + encodeURIComponent("Choose an image file to upload."));
    }

    try {
      await uploadLogo(studioId, file, user.name ?? "A planner");
    } catch (err) {
      const message = reportError("studio-logo", err, "That logo could not be uploaded.");
      redirect(`/studio/settings?error=${encodeURIComponent(message)}`);
    }
    revalidatePath("/studio", "layout");
  }

  async function dropLogo() {
    "use server";
    const { studioId, user } = await requireStudio();
    await removeLogo(studioId, user.name ?? "A planner");
    revalidatePath("/studio", "layout");
  }

  return (
    <>
      <PageHead back="/studio" eyebrow="Settings" title="Studio Branding"
        sub="Your brand appears on every wedding you publish. The platform itself stays invisible." />

      {error && (
        <p className="note" role="alert" style={{ maxWidth: 760, marginBottom: 16, borderColor: "var(--wine)", color: "var(--wine)" }}>
          {error}
        </p>
      )}

      <StudioBrandForm
        action={save}
        logo={brand.logo}
        studio={{
          name: studio.name,
          brandColor: studio.brandColor,
          brandFont: brand.font.key,
          website: studio.website ?? "",
          instagram: studio.instagram ?? "",
          contactEmail: studio.contactEmail ?? "",
          contactPhone: studio.contactPhone ?? "",
        }}
      />

      <div className="card pad frm" style={{ marginTop: 20, maxWidth: 760 }}>
        <h2 className="section-t">Your logo</h2>
        <p className="hint" style={{ marginTop: -8 }}>
          PNG with a transparent background works best, at least 80&nbsp;pixels
          on its longest edge and under {MAX_UPLOAD_BYTES / 1024 / 1024}&nbsp;MB.
          It is shown on cream and on white, so a logo drawn in white alone will
          disappear — use your darkest version.
        </p>

        {!storageEnabled ? (
          <p className="note" role="status">
            File storage is not configured on this deployment yet, so logo
            uploads are unavailable. Your studio name is used instead.
          </p>
        ) : (
          <>
            {brand.logo && (
              <div className="logo-current">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.logo.src}
                  alt={`${studio.name} logo`}
                  width={brand.logo.width}
                  height={brand.logo.height}
                  className="brand-logo"
                />
                <form action={dropLogo}>
                  <button className="btn btn-ghost btn-sm" type="submit">Remove logo</button>
                </form>
              </div>
            )}
            <form action={saveLogo} className="frm">
              <div className="field">
                <label htmlFor="sb-logo">{brand.logo ? "Replace it" : "Upload a logo"}</label>
                <input id="sb-logo" className="inp" name="logo" type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif" required />
              </div>
              <div><button className="btn btn-primary" type="submit">Upload</button></div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
