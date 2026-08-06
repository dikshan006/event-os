# Security

## Reporting

Email the address in `README.md`. Please do not open a public issue for a
suspected vulnerability.

## Dependency posture

`npm audit` is run on every CI job and is advisory rather than blocking — a
transitive high in a dev-only tool should not stand between a security fix and
production. It is printed on every run so it cannot rot unnoticed.

Current state, triaged rather than counted. A raw advisory count is not a risk
assessment: what matters is whether the vulnerable code path is reachable by an
attacker in production.

| Package | Severity | Reachable in production? | Action |
|---|---|---|---|
| `sharp` <0.35.0 | High | **Yes** | Bumped to `^0.35.3`. |
| `next` (postcss chain) | High | No | Deferred. |
| `vitest`, `@vitest/coverage-v8`, `vite` | Critical | No | Left as-is. |

### `sharp` — the one that mattered

Four inherited libvips CVEs (CVE-2026-33327, -33328, -35590, -35591). This is
the only entry that processes attacker-controlled bytes: a planner uploads a
photograph and `sharp` decodes it. Malformed image files are the classic vector
for a decoder bug, and the upload path deliberately runs with `failOn: "none"`
so that slightly-broken camera files still work — which means marginal input
reaches the decoder by design.

`package.json` now declares `^0.35.3`. **Run `npm install` locally and commit the
lockfile**, then upload a photo in the studio to confirm the pipeline still
produces AVIF and WebP derivatives. This was not verified in the environment the
change was made in, because installing a native module there failed on a
filesystem rename; treat it as unverified until that upload succeeds.

### `next` — deferred deliberately

The advisory chain is `postcss`, and the fix is `next@16`, a major upgrade. The
`postcss` issues are all source-map disclosure and stringify-escaping bugs that
require an attacker to control CSS *at build time*. Nobody outside the
repository can do that; there is no runtime CSS compilation and no
user-submitted stylesheet anywhere in the product. The exposure is a build
machine reading its own files.

A Next 16 upgrade is a real piece of work with its own regression risk, and it
should be scheduled rather than bundled into a security fix. Revisit if a Next
advisory ever lands that is reachable at runtime.

### Dev-only criticals

`vitest`, `@vitest/coverage-v8` and `vite` carry critical advisories. Both
require the **Vitest UI server** to be listening — `vitest --ui`, which this
project never runs. CI uses `vitest run`, which starts no server. These
packages are not installed in the production image at all: Vercel builds with
`--omit=dev`. Not a production risk.

## What protects the application

- **Authentication** — Auth.js with JWT sessions; passwords hashed with bcrypt.
- **Authorization** — every service derives its tenant from the session, never
  from input. Cross-tenant access is prevented by construction: an id from a
  form is always looked up together with the session's `studioId`. Enforced by
  tests in `tests/tenancy.test.ts`, including a static check that no service
  reads a wedding by id alone.
- **Password reset** — 32 bytes from `crypto.randomBytes`, stored as a hash, so
  a database read does not yield usable tokens.
- **Invitation codes** — 10 characters from a 31-symbol alphabet (~8.2 × 10^14),
  rate-limited to 6 attempts per minute per code.
- **Uploads** — format determined from decoded content rather than from the
  filename or the declared MIME type; 4 MB cap; 100-megapixel cap against
  decompression bombs; derivatives cleaned up if encoding fails midway.
- **Stripe webhook** — signature verified with `constructEvent` before the body
  is trusted.
- **SQL injection** — Prisma parameterises everything. The one raw query in the
  codebase is `SELECT 1` in the health check, with no interpolation.
- **XSS** — no `dangerouslySetInnerHTML` anywhere; React escaping is intact. CSP
  is defence in depth.
- **Logging** — `src/lib/logger.ts` redacts secrets by key name and by value
  shape, and strips email addresses, before anything reaches a log drain.
