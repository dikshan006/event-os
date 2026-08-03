import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead, StatusChip } from "@/components/ui";
import { createPlanner, setPlannerStatus, deletePlanner, resetPlannerPassword } from "@/server/services/admin";
import { ActionDialog, DeleteStudioDialog, PasswordDialog } from "@/components/admin-dialogs";
import { money, fmtDate } from "@/lib/utils";
import { revalidatePath } from "next/cache";

const FLASH = "wpos_temp_cred";

type Flash = { email: string; password: string; kind: "created" | "reset" };

/**
 * Module scope, not a closure inside the component.
 *
 * A server action passed to a Client Component has its captured scope
 * serialized, and every captured function must itself be a server action.
 * Defining this helper inside the component made it part of that scope and
 * React refused the whole payload; hoisted here it is just a module import,
 * so nothing extra crosses the boundary and no needless action endpoint is
 * published either.
 */
async function setFlash(value: Flash) {
  (await cookies()).set(FLASH, JSON.stringify(value), {
    httpOnly: true, sameSite: "lax", maxAge: 90, path: "/admin/planners",
    secure: process.env.NODE_ENV === "production",
  });
}

export default async function PlannersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; name?: string; email?: string; studio?: string }> }) {
  await requireAdmin();
  const { q, status, name: preName, email: preEmail, studio: preStudio } = await searchParams;
  // Arrives from the requests inbox: approving a request should not mean
  // retyping what the person already told us.
  const prefilled = Boolean(preEmail || preName || preStudio);

  // Temp credentials travel via a short-lived httpOnly cookie — never the URL
  // (URLs land in browser history, proxies, and access logs).
  const jar = await cookies();
  const flashRaw = jar.get(FLASH)?.value;
  let flash: Flash | null = null;
  if (flashRaw) { try { flash = JSON.parse(flashRaw); } catch {} }

  const studios = await prisma.studio.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { users: { some: { email: { contains: q, mode: "insensitive" } } } }] } : {}),
      ...(status === "ACTIVE" || status === "SUSPENDED" ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      users: { where: { role: "PLANNER" }, take: 1 },
      _count: { select: { weddings: true } },
      payments: { where: { status: "PAID" }, select: { amountCents: true } },
    },
  });

  async function create(formData: FormData) {
    "use server";
    await requireAdmin();
    const email = String(formData.get("email"));
    const { tempPassword } = await createPlanner({
      studioName: String(formData.get("studioName")),
      ownerName: String(formData.get("ownerName")),
      email,
    });
    await setFlash({ email, password: tempPassword, kind: "created" });
    redirect("/admin/planners");
  }

  async function dismissFlash() {
    "use server";
    await requireAdmin();
    (await cookies()).delete(FLASH);
    redirect("/admin/planners");
  }

  async function toggle(formData: FormData) {
    "use server";
    await requireAdmin();
    await setPlannerStatus(String(formData.get("studioId")), formData.get("next") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE");
    revalidatePath("/admin/planners");
  }

  async function remove(formData: FormData) {
    "use server";
    await requireAdmin();
    await deletePlanner(String(formData.get("studioId")));
    revalidatePath("/admin/planners");
  }

  async function resetPassword(formData: FormData) {
    "use server";
    await requireAdmin();
    const custom = formData.get("mode") === "custom" ? String(formData.get("password") ?? "") : undefined;
    const cred = await resetPlannerPassword(String(formData.get("studioId")), custom);
    await setFlash({ ...cred, kind: "reset" });
    redirect("/admin/planners");
  }

  return (
    <>
      <PageHead back="/admin" eyebrow="Planners" title="Planner Studios"
        sub="Creating a planner automatically generates their private, branded studio with a secure login." />

      {flash && (
        <div className="note" style={{ marginBottom: 20, borderStyle: "solid" }}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <span>
              {flash.kind === "created" ? "Planner created. Temporary password" : "New password"} for{" "}
              <b>{flash.email}</b>: <code>{flash.password}</code> — visible for 90 seconds, share it securely.
            </span>
            <form action={dismissFlash}><button className="btn btn-ghost btn-sm" type="submit">Dismiss</button></form>
          </div>
        </div>
      )}

      <form method="GET" className="row wrap" style={{ marginBottom: 20 }}>
        <input className="inp" name="q" defaultValue={q ?? ""} placeholder="Search studio or email…" style={{ maxWidth: 280 }} />
        <select className="inp" name="status" defaultValue={status ?? ""} style={{ maxWidth: 170 }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button className="btn btn-outline" type="submit">Filter</button>
        {(q || status) && <Link className="btn btn-ghost" href="/admin/planners">Clear</Link>}
      </form>

      <div className="work">
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Studio</th><th>Owner</th><th>Created</th><th>Weddings</th>
                  <th>Revenue</th><th>Status</th><th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studios.map(s => {
                  const owner = s.users[0];
                  const suspended = s.status === "SUSPENDED";
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/admin/planners/${s.id}`} style={{ fontWeight: 500, textDecoration: "underline" }}>{s.name}</Link>
                      </td>
                      <td>
                        <div>{owner?.name ?? "—"}</div>
                        <div className="meta">{owner?.email}</div>
                      </td>
                      <td className="meta">{fmtDate(s.createdAt)}</td>
                      <td className="meta">{s._count.weddings}</td>
                      <td>{money(s.payments.reduce((a, p) => a + p.amountCents, 0))}</td>
                      <td><StatusChip s={s.status} /></td>
                      <td className="actions">
                        <div className="row">
                          {owner && (
                            <PasswordDialog
                              action={resetPassword}
                              studioId={s.id}
                              studioName={s.name}
                              email={owner.email}
                            />
                          )}

                          <ActionDialog
                            trigger={suspended ? "Reactivate" : "Suspend"}
                            title={suspended ? `Reactivate ${s.name}?` : `Suspend ${s.name}?`}
                            description={
                              suspended
                                ? "The owner can sign in again immediately. Published wedding websites are unaffected either way."
                                : "The owner is signed out and blocked from signing in. Nothing is deleted, published wedding websites stay online, and you can reactivate at any time."
                            }
                          >
                            <form action={toggle}>
                              <input type="hidden" name="studioId" value={s.id} />
                              <input type="hidden" name="next" value={suspended ? "ACTIVE" : "SUSPENDED"} />
                              <button className={`btn ${suspended ? "btn-primary" : "btn-outline"}`} type="submit">
                                {suspended ? "Reactivate studio" : "Suspend studio"}
                              </button>
                            </form>
                          </ActionDialog>

                          <DeleteStudioDialog
                            action={remove}
                            studioId={s.id}
                            studioName={s.name}
                            weddings={s._count.weddings}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!studios.length && <tr><td colSpan={7}><div className="empty">No planners match this filter.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <form action={create} className="card pad frm work-panel">
          <h2 className="section-t">New planner</h2>
          {prefilled && <p className="hint" style={{ marginTop: -8 }}>Filled in from an access request. Check it before creating.</p>}
          <div className="field"><label>Studio name</label><input className="inp" name="studioName" required defaultValue={preStudio ?? ""} placeholder="e.g. Atelier Blanc" /></div>
          <div className="field"><label>Owner name</label><input className="inp" name="ownerName" required defaultValue={preName ?? ""} /></div>
          <div className="field"><label>Login email</label><input className="inp" name="email" type="email" required defaultValue={preEmail ?? ""} /></div>
          <div className="note">The studio is generated instantly; an invite email goes out and their first published wedding is free.</div>
          <button className="btn btn-primary" type="submit">Create planner</button>
        </form>
      </div>
    </>
  );
}
