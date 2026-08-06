import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/lib/auth";

/**
 * Where sign-in lands, so nobody arrives on the marketing site holding a
 * session and has to find the "Dashboard" link themselves.
 *
 * A separate route rather than a smarter `redirectTo`, because `redirectTo` is
 * a constant handed to `signIn` before anything is known about who is signing
 * in — and planners and platform admins belong in different places. This runs
 * after the session exists, so it can simply ask.
 *
 * Nothing renders. It is a redirect with a session read in front of it.
 */
export const metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Continue() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  // No session: the sign-in did not take. Back to the form rather than into a
  // dashboard that would only bounce them out again.
  if (!user) redirect("/login");

  redirect(user.role === "ADMIN" ? "/admin" : "/studio");
}
