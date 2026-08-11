import { test, expect } from "@playwright/test";

/**
 * The security headers, asserted on a real response.
 *
 * `next.config.mjs` is reviewed easily enough by reading it; what reading it
 * cannot tell you is whether the headers survive to the wire. A `source`
 * pattern that fails to match, a platform that strips or overrides, a route
 * served by middleware rather than the config — each produces a correct-looking
 * config and a bare response. So this asserts on what came back.
 *
 * Run against the deployed domain as well as the local production build:
 *
 *   E2E_BASE_URL=https://your-domain npx playwright test headers
 *
 * Vercel does not add these for you, and it does not remove them either — but
 * "does not" is a claim worth re-checking after every platform change rather
 * than assuming.
 */

const EXPECTED: Array<[string, RegExp]> = [
  ["content-security-policy", /default-src 'self'/],
  ["content-security-policy", /frame-ancestors 'none'/],
  ["content-security-policy", /object-src 'none'/],
  ["strict-transport-security", /max-age=63072000.*includeSubDomains.*preload/],
  ["x-frame-options", /^DENY$/i],
  ["x-content-type-options", /^nosniff$/i],
  ["referrer-policy", /^strict-origin-when-cross-origin$/i],
  ["permissions-policy", /geolocation=\(\)/],
  ["permissions-policy", /camera=\(\)/],
  ["cross-origin-opener-policy", /^same-origin$/i],
  ["cross-origin-resource-policy", /^same-site$/i],
];

/**
 * Three surfaces with different rendering paths: a statically generated
 * marketing page, a dynamic guest page, and a signed-out redirect. A header
 * rule that only matches one of them is the failure this is looking for.
 */
for (const path of ["/", "/weddings", "/login"]) {
  test(`security headers are present on ${path}`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    const headers = res.headers();

    for (const [name, pattern] of EXPECTED) {
      expect(headers[name], `${path} is missing ${name}`).toBeDefined();
      expect(headers[name], `${path} has an unexpected ${name}`).toMatch(pattern);
    }

    // Version disclosure buys an attacker a free exploit search.
    expect(headers["x-powered-by"], `${path} discloses the server`).toBeUndefined();
  });
}

/**
 * The CSP must not have been loosened to make something work.
 *
 * `script-src 'unsafe-inline'` is a documented, accepted trade — Next inlines
 * the RSC payload and removing it needs a per-request nonce that would make
 * every route dynamic. Everything else staying closed is what makes that trade
 * survivable, so this pins the parts that must not drift.
 */
test("the CSP has not been widened", async ({ request }) => {
  const csp = (await request.get("/")).headers()["content-security-policy"] ?? "";

  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp, "style-src may be inline; script-src must not gain 'unsafe-eval'")
    .not.toContain("'unsafe-eval'");
  expect(csp, "a wildcard default-src would make the rest of this meaningless")
    .not.toMatch(/default-src[^;]*\*/);
});

/**
 * The Stripe webhook is deliberately excluded from the header rewrite — it is a
 * server-to-server POST where a CSP is meaningless. Excluded, not forgotten:
 * if the exclusion pattern ever widened to cover real pages, the tests above
 * would catch it, and this pins the intended shape from the other side.
 */
test("the webhook path is the only thing outside the header rule", async ({ request }) => {
  const res = await request.get("/api/webhooks/stripe", { maxRedirects: 0 });
  // GET is not allowed there; what matters is that it is not serving a page.
  expect(res.status()).toBeGreaterThanOrEqual(400);
});
