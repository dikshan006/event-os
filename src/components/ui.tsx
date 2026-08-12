import Link from "next/link";
import { BackLink } from "./BackLink";

export function PageHead({ eyebrow, title, sub, actions, back }: {
  eyebrow?: string; title: string; sub?: string; actions?: React.ReactNode;
  /**
   * Logical parent for the Back control, used when the planner arrived here
   * directly. Pages that are already a top level (the dashboard) omit it.
   */
  back?: string;
}) {
  return (
    <div className="page-head">
      <div>
        {back && <BackLink fallback={back} />}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

const toneMap: Record<string, string> = {
  PUBLISHED: "sage", ACTIVE: "sage", PAID: "sage", ACCEPTED: "sage", TRIALING: "sage",
  DRAFT: "", PENDING: "", AWAITING: "", INCOMPLETE: "",
  MAYBE: "wine", DECLINED: "wine", SUSPENDED: "wine", REFUNDED: "wine", FAILED: "wine",
  PAST_DUE: "wine", UNPAID: "wine", CANCELED: "wine", INCOMPLETE_EXPIRED: "wine", PAUSED: "wine",
};
export function StatusChip({ s }: { s: string }) {
  // Underscores become spaces so PAST_DUE reads as "Past due" rather than
  // "Past_due". No existing caller passes a value containing one — ticket
  // statuses, which do, have their own chip — so this only affects the
  // subscription statuses added alongside it.
  const label = (s.charAt(0) + s.slice(1).toLowerCase()).replace(/_/g, " ");
  return <span className={`chip ${toneMap[s] ?? ""}`}><i className="dot" />{label}</span>;
}

export function Sidebar({ brand, brandMono, items, footer, accent, wordmark, logo, face }: {
  brand: string; brandMono: string; items: { href: string; label: string }[];
  footer: React.ReactNode; accent?: string;
  /**
   * The studio's uploaded logo, when it has one.
   *
   * It replaces the monogram *and* the name rather than sitting beside them: a
   * logo already contains the studio's name, and showing both is the mark of
   * software that has been bolted onto a brand rather than dressed in it. The
   * name is kept as the image's alt text, so nothing is lost to a screen reader
   * or to a failed request.
   *
   * The platform's own admin sidebar passes nothing here. EventOS is not a
   * tenant and has no logo row to read.
   */
  logo?: { src: string; width: number; height: number } | null;
  /** CSS font stack for the brand line — see lib/branding.ts. */
  face?: string;
  /**
   * Whether `brand` is our own name rather than a studio's.
   *
   * The sidebar sets the brand line in tracked uppercase, which is right for a
   * studio's name — it reads as a label above the navigation. It is wrong for
   * ours, which has fixed casing: EventOS, never EVENTOS. Passed explicitly
   * rather than inferred from the string, because "is this our brand" is not a
   * question a component should be guessing at.
   */
  wordmark?: boolean;
}) {
  return (
    <aside className="side" style={accent ? ({ "--accent": accent, "--accent-soft": accent + "1A" } as React.CSSProperties) : undefined}>
      <div className="brand">
        {logo ? (
          /* Not next/image — the host is whatever bucket the deployment uses,
             and at this size there is nothing for the optimizer to win. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.src} alt={brand} width={logo.width} height={logo.height} className="brand-logo" />
        ) : (
          <>
            <div className="brand-mono">{brandMono}</div>
            <div className={`brand-name${wordmark ? " is-wordmark" : ""}`} style={face ? { fontFamily: face } : undefined}>
              {brand}
            </div>
          </>
        )}
      </div>
      <nav className="nav">
        {items.map(i => <Link key={i.href} href={i.href}>{i.label}</Link>)}
      </nav>
      <div className="side-foot">{footer}</div>
    </aside>
  );
}
