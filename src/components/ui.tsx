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
  PUBLISHED: "sage", ACTIVE: "sage", PAID: "sage", ACCEPTED: "sage",
  DRAFT: "", PENDING: "", AWAITING: "",
  MAYBE: "wine", DECLINED: "wine", SUSPENDED: "wine", REFUNDED: "wine", FAILED: "wine",
};
export function StatusChip({ s }: { s: string }) {
  const label = s.charAt(0) + s.slice(1).toLowerCase();
  return <span className={`chip ${toneMap[s] ?? ""}`}><i className="dot" />{label}</span>;
}

export function Sidebar({ brand, brandMono, items, footer, accent }: {
  brand: string; brandMono: string; items: { href: string; label: string }[];
  footer: React.ReactNode; accent?: string;
}) {
  return (
    <aside className="side" style={accent ? ({ "--accent": accent, "--accent-soft": accent + "1A" } as React.CSSProperties) : undefined}>
      <div className="brand">
        <div className="brand-mono">{brandMono}</div>
        <div className="brand-name">{brand}</div>
      </div>
      <nav className="nav">
        {items.map(i => <Link key={i.href} href={i.href}>{i.label}</Link>)}
      </nav>
      <div className="side-foot">{footer}</div>
    </aside>
  );
}
