import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead, StatusChip } from "@/components/ui";
import { money, fmtDate, initials, TEMPLATES } from "@/lib/utils";
import { resolveAllPrices } from "@/server/services/pricing";
import { setPrice, clearStudioPrice } from "@/server/services/pricing-admin";
import { studioSubscription } from "@/server/services/subscriptions";
import { revalidatePath } from "next/cache";
import type { PricePlanKind } from "@prisma/client";

/**
 * One studio, as the platform owner sees it.
 *
 * Reorganised, not rewritten. Every number, row and field that was here before
 * is still here — the query is untouched — but the page had four different
 * kinds of information competing at the same visual weight: a stat strip, two
 * tables in the left column, and the account details and activity feed stacked
 * in a narrow right rail below the fold.
 *
 * The problem that caused was one of reading order. "Who is this studio and are
 * they in good standing" is the question every visit starts with, and the
 * answer was in the last place the eye reached. So the page is now four labelled
 * sections in the order the questions get asked:
 *
 *   Studio overview — who they are, what state the account is in
 *   Weddings        — what they have built
 *   Billing history — what they have paid
 *   Recent activity — what they have been doing
 *
 * Full width and stacked rather than a 1.7fr/1fr split. The split existed to
 * fill a wide screen, but it put account details in a column too narrow to read
 * comfortably and pushed activity below two tables of unbounded length.
 */
export default async function PlannerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const studio = await prisma.studio.findUnique({
    where: { id },
    include: {
      users: true,
      weddings: { orderBy: { createdAt: "desc" }, include: { _count: { select: { guests: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!studio) notFound();
  const [guestCount, activity, emailStats, prices, subscription] = await Promise.all([
    prisma.guest.count({ where: { studioId: id } }),
    prisma.auditLog.findMany({ where: { studioId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.emailLog.groupBy({ by: ["status"], where: { studioId: id }, _count: true }),
    resolveAllPrices(id),
    studioSubscription(id),
  ]);

  /**
   * Set or clear one custom price for this studio.
   *
   * `studioId` comes from the route rather than the form, and the amount is
   * validated inside `setPrice`, which also requires an admin session of its
   * own. Clearing archives the override rather than deleting it — a receipt or
   * a live subscription may still point at that row.
   */
  async function savePrice(formData: FormData) {
    "use server";
    await requireAdmin();
    const kind = String(formData.get("kind")) as PricePlanKind;
    if (!["PER_WEDDING", "MONTHLY", "YEARLY"].includes(kind)) return;

    const raw = String(formData.get("amount") ?? "").trim();
    if (raw === "") {
      await clearStudioPrice({ studioId: id, kind });
    } else {
      const dollars = Number(raw);
      if (!Number.isFinite(dollars)) return;
      await setPrice({ kind, amountCents: Math.round(dollars * 100), studioId: id });
    }
    revalidatePath(`/admin/planners/${id}`);
  }

  const PRICE_ROWS: Array<{ kind: PricePlanKind; label: string; unit: string }> = [
    { kind: "PER_WEDDING", label: "Per published wedding", unit: "each" },
    { kind: "MONTHLY", label: "Monthly subscription", unit: "/ month" },
    { kind: "YEARLY", label: "Yearly subscription", unit: "/ year" },
  ];
  const planFor = (k: PricePlanKind) =>
    k === "PER_WEDDING" ? prices.perWedding : k === "MONTHLY" ? prices.monthly : prices.yearly;
  const owner = studio.users.find(u => u.role === "PLANNER");
  const revenue = studio.payments.filter(p => p.status === "PAID").reduce((a, p) => a + p.amountCents, 0);
  const emailOf = (s: string) => emailStats.find(e => e.status === s)?._count ?? 0;
  const published = studio.weddings.filter(w => w.status === "PUBLISHED").length;

  return (
    <>
      {/*
        One back control, not two. `PageHead` already renders a BackLink from
        its `back` prop; the standalone link above it was a second one saying
        the same thing, which is the kind of duplication that reads as clutter
        before it reads as anything.
      */}
      <PageHead
        back="/admin/planners"
        eyebrow="Planner profile"
        title={studio.name}
        actions={<StatusChip s={studio.status} />}
      />

      {/* ───────────────────────────────────────────── studio overview ─── */}
      <section className="sec">
        <h2 className="sec-t">Studio overview</h2>

        <div className="card pad ov">
          <div className="ov-id">
            {studio.logoUrl ? (
              /* A plain <img>, matching how `Sidebar` renders the same logo: the
                 URL points at whichever storage provider the deployment uses,
                 so next/image's loader cannot be configured for it ahead of
                 time. Decorative here — the studio name is right beside it — so
                 the alt is deliberately empty. */
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ov-logo" src={studio.logoUrl} alt="" width={56} height={56} />
            ) : (
              <div className="ov-mono" style={{ background: studio.brandColor }}>
                {initials(studio.name)}
              </div>
            )}
            <div className="ov-name">
              <b>{studio.name}</b>
              <span className="meta">
                {[studio.website, studio.instagram].filter(Boolean).join(" · ") || "No website on file"}
              </span>
            </div>
          </div>

          <dl className="ov-facts">
            <div><dt>Owner</dt><dd>{owner?.name ?? "—"}</dd></div>
            <div><dt>Email</dt><dd className="ov-wrap">{owner?.email ?? "—"}</dd></div>
            <div><dt>Contact address</dt><dd className="ov-wrap">{studio.contactEmail ?? "—"}</dd></div>
            <div><dt>Joined</dt><dd>{fmtDate(studio.createdAt)}</dd></div>
            <div><dt>Last signed in</dt><dd>{owner?.lastLoginAt ? fmtDate(owner.lastLoginAt) : "Never"}</dd></div>
            <div>
              <dt>Brand colour</dt>
              <dd className="row" style={{ gap: 7 }}>
                <i className="ov-swatch" style={{ background: studio.brandColor }} />
                {studio.brandColor}
              </dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd><StatusChip s={studio.status} /></dd>
            </div>
            <div>
              <dt>Free wedding</dt>
              <dd>{studio.freeWeddingUsed ? "Used" : "Available"}</dd>
            </div>
          </dl>
        </div>

        <div className="stats">
          <div className="card stat">
            <div className="v">{studio.weddings.length}</div>
            <div className="l">Weddings</div>
            <div className="d">{published} published</div>
          </div>
          <div className="card stat">
            <div className="v">{guestCount}</div>
            <div className="l">Guests</div>
            <div className="d">across every wedding</div>
          </div>
          <div className="card stat">
            <div className="v">{money(revenue)}</div>
            <div className="l">Paid to date</div>
            <div className="d">{studio.payments.length} payment{studio.payments.length === 1 ? "" : "s"}</div>
          </div>
          <div className="card stat">
            <div className="v">{emailOf("SENT")}</div>
            <div className="l">Emails delivered</div>
            <div className="d">{emailOf("FAILED")} failed · {emailOf("SKIPPED")} skipped</div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────── pricing & plan ─── */}
      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-t">Pricing &amp; plan</h2>
          <span className="meta">
            {subscription
              ? `${subscription.pricePlan.kind === "YEARLY" ? "Yearly" : "Monthly"} subscription`
              : "No subscription"}
          </span>
        </div>

        {subscription && (
          <div className="card pad" style={{ marginBottom: 14 }}>
            <dl className="ov-facts">
              <div><dt>Plan</dt><dd>{subscription.pricePlan.kind === "YEARLY" ? "Yearly" : "Monthly"}</dd></div>
              <div>
                <dt>Price they pay</dt>
                <dd>{money(subscription.pricePlan.amountCents)}</dd>
              </div>
              <div><dt>Status</dt><dd><StatusChip s={subscription.status} /></dd></div>
              <div>
                <dt>{subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"}</dt>
                <dd>{subscription.currentPeriodEnd ? fmtDate(subscription.currentPeriodEnd) : "—"}</dd>
              </div>
            </dl>
            {/*
              The number above is the version of the price this studio actually
              subscribed at, read from the plan the subscription points at — not
              the current default. Those two drift apart the moment the default
              changes, and showing the default here would quietly misreport what
              a customer is being billed.
            */}
            <p className="meta" style={{ marginTop: 10 }}>
              Locked at the price they subscribed on. Changing the default below
              or on the settings page does not affect it.
            </p>
          </div>
        )}

        <div className="card tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Charge</th><th>Effective price</th><th>Source</th><th>Custom price</th></tr>
            </thead>
            <tbody>
              {PRICE_ROWS.map(row => {
                const plan = planFor(row.kind);
                const isCustom = plan.studioId === id;
                return (
                  <tr key={row.kind}>
                    <td style={{ fontWeight: 500 }}>{row.label}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(plan.amountCents)} <span className="meta">{row.unit}</span>
                    </td>
                    <td className="meta">{isCustom ? "Custom for this studio" : "Platform default"}</td>
                    <td>
                      <form action={savePrice} className="row" style={{ gap: 8 }}>
                        <input type="hidden" name="kind" value={row.kind} />
                        <input
                          className="inp" name="amount" type="number" step="1" min="0"
                          style={{ maxWidth: 120 }}
                          placeholder="default"
                          defaultValue={isCustom ? plan.amountCents / 100 : ""}
                          aria-label={`Custom ${row.label.toLowerCase()} price in dollars`}
                        />
                        <button className="btn btn-outline btn-sm" type="submit">Save</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="meta" style={{ marginTop: 8 }}>
          Leave a box empty and save to remove the custom price and fall back to
          the platform default. A change here applies to this studio&rsquo;s next
          charge — it never reprices a subscription that is already running.
        </p>
      </section>

      {/* ─────────────────────────────────────────────────── weddings ─── */}
      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-t">Weddings</h2>
          <span className="meta">
            {studio.weddings.length === 0
              ? "None yet"
              : `${studio.weddings.length} total · ${published} published`}
          </span>
        </div>
        <div className="card tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Couple</th><th>Template</th><th>Date</th><th>Guests</th><th>Status</th></tr>
            </thead>
            <tbody>
              {studio.weddings.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 500 }}>{w.partnerOne} &amp; {w.partnerTwo}</td>
                  <td className="meta">{TEMPLATES[w.template].name}</td>
                  <td className="meta">{fmtDate(w.date)}</td>
                  <td className="meta">{w._count.guests}</td>
                  <td><StatusChip s={w.status} /></td>
                </tr>
              ))}
              {!studio.weddings.length && (
                <tr><td colSpan={5}><div className="empty">No weddings yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ────────────────────────────────────────────── billing history ─── */}
      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-t">Billing history</h2>
          <span className="meta">
            {studio.payments.length === 0 ? "No payments" : `${money(revenue)} paid to date`}
          </span>
        </div>
        <div className="card tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {studio.payments.map(p => (
                <tr key={p.id}>
                  <td className="meta">{fmtDate(p.createdAt)}</td>
                  <td>{p.description}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{money(p.amountCents)}</td>
                  <td><StatusChip s={p.status} /></td>
                </tr>
              ))}
              {!studio.payments.length && (
                <tr><td colSpan={4}><div className="empty">No payments.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ────────────────────────────────────────────── recent activity ─── */}
      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-t">Recent activity</h2>
          {activity.length > 0 && <span className="meta">Last {activity.length} actions</span>}
        </div>
        <div className="card pad">
          {activity.length === 0 ? (
            <span className="meta">No activity yet.</span>
          ) : (
            <ol className="act">
              {activity.map(a => (
                <li key={a.id}>
                  <span className="act-dot" aria-hidden="true" />
                  <div>
                    <div className="act-what">{a.action}</div>
                    <div className="meta">
                      {a.actorName ?? a.actorType} ·{" "}
                      <time dateTime={a.createdAt.toISOString()}>
                        {a.createdAt.toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <p className="meta" style={{ marginTop: 8 }}>
        <Link href="/admin/planners">← All planners</Link>
      </p>
    </>
  );
}
