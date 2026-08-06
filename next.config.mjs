/**
 * Content Security Policy.
 *
 * `script-src` carries `'unsafe-inline'`, and that is a deliberate, bounded
 * decision rather than an oversight. Next's App Router inlines the RSC payload
 * and its bootstrap in `<script>` tags; removing `'unsafe-inline'` requires a
 * per-request nonce issued from middleware, which in turn makes every route
 * dynamic — the marketing pages are statically generated today and would stop
 * being so. That is a real cost for a defence that is, here, the second line:
 * the app renders no user-controlled HTML anywhere (no `dangerouslySetInnerHTML`
 * in the codebase, verified), so React's escaping is the first line and it is
 * intact. The nonce upgrade is the right move when the app starts rendering
 * rich text; it is written up in AUDIT.md rather than done speculatively.
 *
 * Everything else is closed:
 *
 *   default-src 'self'   nothing loads from anywhere unless named below.
 *   img-src     https:   registry items carry a retailer's own image URL,
 *                        chosen by the planner, so images genuinely can come
 *                        from any https origin. `data:` and `blob:` cover the
 *                        inline blur placeholders and client-side previews.
 *   style-src   inline   Next and the template system both set inline styles
 *                        (the per-template custom properties are computed at
 *                        render time and cannot be a static sheet).
 *   connect-src 'self'   plus Vercel Blob, which the browser fetches directly.
 *   frame-ancestors none clickjacking; also covered by X-Frame-Options for
 *                        older agents.
 *   form-action 'self'   a payment link is a navigation, not a form post, so
 *                        Stripe does not need to be here.
 *   upgrade-insecure-requests: any stray http:// asset is fetched over https
 *                        rather than blocked, which fails safe on a mixed page.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.public.blob.vercel-storage.com",
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  /**
   * Two years, subdomains included, preload-eligible. Vercel terminates TLS and
   * redirects http to https already; this stops the first request of a session
   * from going out in the clear at all.
   */
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  /**
   * Full URL to our own origin, origin only to third parties. A wedding site
   * URL contains the couple's slug and an invitation URL contains a guest's
   * code — neither should travel in a Referer header to a retailer when a guest
   * follows a registry link.
   */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /**
   * The app asks for none of these. Naming them explicitly means an embedded
   * third party cannot ask on our behalf either.
   */
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()", "autoplay=(self)", "camera=()", "display-capture=()",
      "encrypted-media=()", "fullscreen=(self)", "geolocation=()", "gyroscope=()",
      "magnetometer=()", "microphone=()", "midi=()", "payment=()", "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  /** Isolates the browsing context group; blocks cross-origin popup tampering. */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server version disclosure buys an attacker a free version-specific exploit
  // search and buys us nothing.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Must stay above MAX_UPLOAD_BYTES (4 MB) for multipart overhead, but below
      // Vercel's own 4.5 MB request-body cap — which this setting cannot raise.
      bodySizeLimit: "4.5mb",
      /**
       * The CSRF defence for server actions, pinned rather than inferred.
       *
       * Next already rejects an action whose `Origin` does not match the request
       * host, which is what makes a mutation from evil.example fail without any
       * token of our own. That comparison relies on the forwarded host header
       * being trustworthy — true behind Vercel, not true behind an arbitrary
       * proxy, and a spoofed `X-Forwarded-Host` would otherwise make the check
       * agree with the attacker.
       *
       * Naming the origins takes the header out of the decision. Derived from
       * APP_URL so there is one source of truth for what this deployment
       * answers to; empty locally, where the host check alone is fine.
       */
      allowedOrigins: [process.env.APP_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
        .filter(Boolean)
        .map(u => String(u).replace(/^https?:\/\//, "").replace(/\/.*$/, "")),
    },
  },
  // sharp is a native module; keep it external so Next never tries to bundle it.
  serverExternalPackages: ["sharp"],

  async headers() {
    return [
      {
        // Everything except the Stripe webhook, which is a server-to-server
        // POST: a CSP on it is meaningless and HSTS on a non-browser client is
        // noise. Excluded so the response stays exactly what Stripe expects.
        source: "/((?!api/webhooks).*)",
        headers: securityHeaders,
      },
      {
        // Immutable, content-hashed build output.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};
export default nextConfig;
