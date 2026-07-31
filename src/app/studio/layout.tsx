import { requireStudio } from "@/server/services/context";
import { Sidebar } from "@/components/ui";
import { signOut } from "@/lib/auth";
import { initials } from "@/lib/utils";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user, studio } = await requireStudio();
  async function doSignOut() { "use server"; await signOut({ redirectTo: "/login" }); }

  return (
    <div className="shell" style={{ "--accent": studio.brandColor, "--accent-soft": studio.brandColor + "1A" } as React.CSSProperties}>
      <Sidebar
        brand={studio.name}
        brandMono={studio.name[0]}
        accent={studio.brandColor}
        items={[
          { href: "/studio", label: "Dashboard" },
          { href: "/studio/weddings", label: "Weddings" },
          { href: "/studio/billing", label: "Billing" },
          { href: "/studio/settings", label: "Settings" },
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
