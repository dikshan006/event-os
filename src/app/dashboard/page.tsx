import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/lib/auth";

/**
 * One URL that always lands you in the right place.
 *
 * The dashboards keep their existing paths — /studio and /admin — because
 * renaming live routes breaks bookmarks, in-flight emails and every link
 * already written into the app, for no user-visible gain. This sits alongside
 * them as the stable address: the public nav, the footer and anything we send
 * externally can point at /dashboard without needing to know who is reading.
 *
 * Nothing here is a security boundary. requireAdmin() and requireStudio() on
 * the destination pages are; this only saves a person a decision.
 */
export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (!user) redirect("/login?next=/dashboard");
  redirect(user.role === "ADMIN" ? "/admin" : "/studio");
}
