import "./marketing.css";
import { auth, type SessionUser } from "@/lib/auth";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SmoothScroll } from "@/components/SmoothScroll";

/**
 * Chrome for the public site: homepage, /weddings, /request-access.
 *
 * A route group rather than a path segment, so these pages sit at the root
 * URLs a marketing site needs while keeping their own layout, stylesheet and
 * scroll behaviour. Nothing here is visible to /studio, /admin, /w or /invite.
 *
 * The stylesheet is imported here rather than in globals.css so the dashboards
 * never download it, and so the two systems cannot leak into one another.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Resolved once, at the layout, so every public page gets a session-aware nav
  // without each of them repeating the lookup.
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  return (
    <div className="m">
      {/* Same Lenis instance the guest wedding sites use. It gates itself on
          prefers-reduced-motion and leaves touch scrolling native. */}
      <SmoothScroll />
      <div className="m-grain" aria-hidden="true" />

      <SiteNav
        signedIn={Boolean(user)}
        dashboardHref={user?.role === "ADMIN" ? "/admin" : "/studio"}
      />

      {/* The nav is fixed and the hero sits under it deliberately, so the skip
          link is what gives keyboard users a way past it. */}
      <a href="#main" className="skip">
        Skip to content
      </a>

      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
