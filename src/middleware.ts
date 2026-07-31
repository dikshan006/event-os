import { NextRequest, NextResponse } from "next/server";

/**
 * Edge gate: requires a session cookie for app areas. Deliberately does not
 * decode the JWT (keeps the edge bundle free of auth internals). Role checks
 * are enforced server-side in requireAdmin()/requireStudio() — that is the
 * actual security boundary; this is fast-path UX.
 */
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/studio/:path*"] };
