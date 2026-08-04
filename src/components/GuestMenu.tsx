import Link from "next/link";

/**
 * Choose whose invitation the draft preview is showing.
 *
 * A native `<details>` rather than a listbox or a popover library: it opens,
 * closes and traps focus correctly with no JavaScript, which matters on a page
 * whose entire purpose is to render faithfully before anything is trusted.
 *
 * The public view comes first and is the default. It is what a guest following
 * a plain link sees, and a planner checking their own site is usually checking
 * that, not one particular guest's copy.
 */
export function GuestMenu({
  base,
  guests,
  current,
}: {
  base: string;
  guests: { id: string; name: string; groups: string[] }[];
  current: string | null;
}) {
  if (!guests.length) return null;

  const active = guests.find(g => g.id === current);

  return (
    <details className="pv-menu">
      <summary>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <circle cx="8" cy="5.5" r="2.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.75 13.5a5.25 5.25 0 0 1 10.5 0" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {active ? active.name : "Public view"}
      </summary>

      <div className="pv-menu-list">
        <p className="pv-menu-head">Viewing as</p>
        <Link href={base} className={current ? undefined : "is-on"}>
          Public view
          <small>Anyone with the link</small>
        </Link>
        {guests.map(g => (
          <Link
            key={g.id}
            href={`${base}?as=${g.id}`}
            className={g.id === current ? "is-on" : undefined}
          >
            {g.name}
            {g.groups.length > 0 && <small>{g.groups.join(" · ")}</small>}
          </Link>
        ))}
      </div>
    </details>
  );
}
