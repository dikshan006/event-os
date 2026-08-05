import { NextResponse } from "next/server";

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
 * So the build says who it is. Open this path on any deployment URL and it
 * answers with the commit it was built from. If the SHA is not the commit you
 * expect, the problem is the deployment, not the CSS.
 *
 * `VERCEL_GIT_COMMIT_SHA` and friends are injected at build time; locally they
 * are absent, which is itself the answer.
 */
export const dynamic = "force-dynamic";

export function GET() {
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
