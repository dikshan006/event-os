import { NextRequest, NextResponse } from "next/server";

/**
 * Edge gate: requires a session cookie for app areas. Deliberately does not
 * decode the JWT (keeps the edge bundle free of auth internals). Role checks
 * are enforced server-side in requireAdmin()/requireStudio() — that is the
 * actual security boundary; this is fast-path UX.
 *
 * The names are checked rather than imported from lib/auth: importing that
 * module pulls Prisma and bcrypt into the edge runtime, where neither can run.
 * All three names are accepted because the correct one depends on where this is
 * running — `__Host-` in production, the bare name locally — and being wrong
 * here bounces every signed-in planner to /login. Accepting a name that will not
 * verify is harmless: the server-side check rejects it a moment later.
 */
const SESSION_COOKIES = [
  "__Host-authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

export function middleware(req: NextRequest) {
  if (!SESSION_COOKIES.some(name => req.cookies.has(name))) {
    /**
     * Where they were going, so sign-in can return them there.
     *
     * `nextUrl.pathname` and nothing else: the value is echoed into a redirect,
     * and a full URL from the request would let someone craft
     * /studio?…&next=https://evil.example and turn our login page into an open
     * redirect. A path is not a destination anywhere but here.
     */
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/studio/:path*"] };
