import { requireStudio } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { zStudioBranding } from "@/lib/validators";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export default async function StudioSettings() {
  const { studio } = await requireStudio();

  async function save(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const input = zStudioBranding.parse({
      name: formData.get("name"),
      brandColor: formData.get("brandColor"),
      website: formData.get("website") ?? "",
      instagram: formData.get("instagram") ?? "",
      contactEmail: formData.get("contactEmail") ?? "",
      contactPhone: formData.get("contactPhone") ?? "",
    });
    await prisma.studio.update({
      where: { id: studioId },
      data: {
        name: input.name, brandColor: input.brandColor,
        website: input.website || null, instagram: input.instagram || null,
        contactEmail: input.contactEmail || null, contactPhone: input.contactPhone || null,
      },
    });
    revalidatePath("/studio", "layout");
  }

  return (
    <>
      <PageHead back="/studio" eyebrow="Settings" title="Studio Branding"
        sub="Your brand appears on every wedding you publish. The platform itself stays invisible." />
      <div className="split">
        <form action={save} className="card pad frm">
          <div className="field"><label>Studio name</label><input className="inp" name="name" defaultValue={studio.name} required /></div>
          <div className="frm two">
            <div className="field"><label>Brand color</label><input className="inp" name="brandColor" type="color" defaultValue={studio.brandColor} style={{ height: 42, padding: 4 }} /></div>
            <div className="field"><label>Website</label><input className="inp" name="website" defaultValue={studio.website ?? ""} /></div>
            <div className="field"><label>Instagram</label><input className="inp" name="instagram" defaultValue={studio.instagram ?? ""} /></div>
            <div className="field"><label>Contact email</label><input className="inp" name="contactEmail" defaultValue={studio.contactEmail ?? ""} /></div>
            <div className="field"><label>Phone</label><input className="inp" name="contactPhone" defaultValue={studio.contactPhone ?? ""} /></div>
          </div>
          <div><button className="btn btn-primary" type="submit">Save changes</button></div>
        </form>
        <div className="card pad" style={{ background: "var(--cream)", border: "none" }}>
          <div className="eyebrow" style={{ color: "var(--soft)" }}>White label</div>
          <h2 className="section-t" style={{ marginTop: 6 }}>What guests see</h2>
          <p className="meta" style={{ marginBottom: 18 }}>Every wedding website carries your studio's name — never ours.</p>
          <div className="card pad" style={{ textAlign: "center" }}>
            <div className="script" style={{ fontSize: 26, color: studio.brandColor }}>Sarah &amp; James</div>
            <div className="meta" style={{ letterSpacing: ".2em", textTransform: "uppercase", fontSize: 10, marginTop: 10 }}>
              Designed by {studio.name}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
