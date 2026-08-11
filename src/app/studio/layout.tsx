import { requireStudio } from "@/server/services/context";
import { Sidebar } from "@/components/ui";
import { signOut } from "@/lib/auth";
import { initials } from "@/lib/utils";
import { brandingFor, brandVars } from "@/lib/branding";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user, studio } = await requireStudio();
  async function doSignOut() { "use server"; await signOut({ redirectTo: "/login" }); }

  // One resolver for the logo, the accent and the typeface, shared with the
  // settings preview and the wedding-site credit so the three cannot drift.
  const brand = brandingFor(studio);

  return (
    <div className="shell" style={brandVars(brand)}>
      <Sidebar
        brand={studio.name}
        brandMono={studio.name[0]}
        accent={studio.brandColor}
        logo={brand.logo}
        face={brand.font.stack}
        items={[
          { href: "/studio", label: "Dashboard" },
          { href: "/studio/weddings", label: "Weddings" },
          { href: "/studio/billing", label: "Billing" },
          { href: "/studio/settings", label: "Settings" },
          // Last, and always present. A planner looks for help at the moment
          // something is confusing, which is not a moment to go hunting for
          // where help lives — so it sits in the same place on every page.
          { href: "/studio/help", label: "Help" },
        ]}
        footer={
          <>
            <div className="me">
              <div className="ava">{initials(user.name)}</div>
              <div><b>{user.name}</b><span>Planner</span></div>
            </div>
            <form action={doSignOut}><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </>
        }
      />
      <main className="main">{children}</main>
    </div>
  );
}
