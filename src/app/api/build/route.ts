import { NextResponse } from "next/server";
import { auth, type SessionUser } from "@/lib/auth";

/**
 * Which build is actually serving this request.
 *
 * Three times now a change has shipped, landed on the default branch, and
 * looked absent in the browser, and each time the first hour went into deciding
 * whether the code was wrong or the deployment was old. That is not a question
 * anyone should have to reason about: a preview URL is immutable and pinned to
 * one commit, a failed build leaves the previous deployment serving, and both
 * look identical from the outside.
 *
 * So the build says who it is — but only to an admin.
 *
 * It used to answer anyone, and returned the commit SHA, the branch name and
 * the full commit message. None of those are credentials, which is exactly why
 * it survived several reviews; the problem is that commit messages are written
 * for colleagues and routinely name the customer a fix was for, the bug that
 * made it necessary, or the internal ticket behind it. That is free
 * reconnaissance, published at a guessable path, for no benefit to anyone
 * outside the team.
 *
 * 404 rather than 401 for a non-admin, so the endpoint does not confirm its own
 * existence — the same reasoning `ownWedding` uses for another studio's
 * wedding. Anyone who needs the commit and cannot sign in can read it from the
 * Vercel dashboard, which is where that information belongs.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? "development",
      builtAt: process.env.VERCEL_DEPLOYMENT_ID ? undefined : "not a Vercel build",
      now: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
