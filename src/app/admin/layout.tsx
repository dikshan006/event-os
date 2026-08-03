import { requireAdmin } from "@/server/services/context";
import { Sidebar } from "@/components/ui";
import { signOut } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  async function doSignOut() { "use server"; await signOut({ redirectTo: "/login" }); }

  return (
    <div className="shell" style={{ "--accent": "#211E1B", "--accent-soft": "#211E1B14" } as React.CSSProperties}>
      <Sidebar
        brand="EventOS Admin"
        brandMono="✦"
        items={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/planners", label: "Planners" },
          { href: "/admin/weddings", label: "Weddings" },
          { href: "/admin/templates", label: "Templates" },
          { href: "/admin/payments", label: "Payments" },
          { href: "/admin/activity", label: "Activity" },
          { href: "/admin/settings", label: "Settings" },
        ]}
        footer={
          <>
            <div className="me"><div className="ava">PO</div><div><b>{user.name}</b><span>Main Admin</span></div></div>
            <form action={doSignOut}><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </>
        }
      />
      <main className="main">{children}</main>
    </div>
  );
}
