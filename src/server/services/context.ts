import "server-only";
import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasAcceptedCurrentLegal } from "./legal";

/** Security boundary: every service call derives its tenant from the session, never from input. */
export async function requireAdmin() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user || user.role !== "ADMIN") redirect("/login");
  return { user };
}

/**
 * A signed-in, active planner — without the legal gate.
 *
 * This is everything `requireStudio()` used to be, split out so exactly one
 * screen can use it: `/accept-terms`. That page needs a session to know
 * whose agreement it is recording, but it obviously cannot require the
 * agreement it exists to collect.
 *
 * **Do not call this anywhere else.** It is the un-gated door. Every other
 * planner surface wants `requireStudio()` below.
 */
export async function requireStudioSession() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user || user.role !== "PLANNER" || !user.studioId) redirect("/login");
  const studio = await prisma.studio.findUnique({ where: { id: user.studioId } });
  if (!studio || studio.status === "SUSPENDED") redirect("/login");
  return { user, studio, studioId: studio.id };
}

/**
 * A planner who may actually use the product.
 *
 * The legal gate lives here rather than in middleware, and that is the whole
 * design. `src/middleware.ts` runs on the edge where Prisma cannot, and it only
 * checks that a cookie exists — its own comment calls it fast-path UX rather
 * than a boundary. A gate that only ran there would be a redirect a determined
 * user could route around.
 *
 * This function is the real chokepoint: the studio layout calls it, every
 * planner page calls it, and every planner Server Action calls it again on its
 * own request rather than trusting the render that produced the form. So the
 * check covers page loads, direct URL navigation and mutations with one
 * statement.
 *
 * The gate screen lives at `/accept-terms`, outside the `/studio` tree on
 * purpose: `src/app/studio/layout.tsx` calls this function, so a page under
 * that layout would be redirected to itself forever. Keeping it outside means
 * the layout stays fully gated rather than being weakened to accommodate one
 * page.
 *
 * One surface does not pass through here — `/studio/weddings/[id]/guests/export`
 * is a route handler, and route handlers do not run layouts. It carries the
 * same check inline, and there is a test that says so.
 *
 * Admins are untouched: `requireAdmin()` has no legal gate, because this is an
 * agreement between EventOS and the planners who use it.
 */
export async function requireStudio() {
  const ctx = await requireStudioSession();
  if (!(await hasAcceptedCurrentLegal(ctx.user.id))) redirect("/accept-terms");
  return ctx;
}

/** Fetch a wedding only if it belongs to the caller's studio. 404 semantics: never leak existence. */
export async function ownWedding(studioId: string, weddingId: string) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) redirect("/studio/weddings");
  return wedding;
}
