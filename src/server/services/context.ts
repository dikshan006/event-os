import "server-only";
import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Security boundary: every service call derives its tenant from the session, never from input. */
export async function requireAdmin() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user || user.role !== "ADMIN") redirect("/login");
  return { user };
}

export async function requireStudio() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user || user.role !== "PLANNER" || !user.studioId) redirect("/login");
  const studio = await prisma.studio.findUnique({ where: { id: user.studioId } });
  if (!studio || studio.status === "SUSPENDED") redirect("/login");
  return { user, studio, studioId: studio.id };
}

/** Fetch a wedding only if it belongs to the caller's studio. 404 semantics: never leak existence. */
export async function ownWedding(studioId: string, weddingId: string) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) redirect("/studio/weddings");
  return wedding;
}
