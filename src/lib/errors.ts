/**
 * Errors whose message is safe — and useful — to show the person who triggered
 * them.
 *
 * Everything else is a bug or an infrastructure fault: those get logged with a
 * reference id and reported generically, so we never leak a stack trace or a
 * connection string into the UI. The distinction exists because the previous
 * catch-all collapsed *every* failure into one opaque sentence, which hid a
 * plainly actionable "storage is not configured" message behind "that image
 * could not be processed".
 */
export class UserError extends Error {
  /**
   * An optional stable tag for callers that need to tell two expected failures
   * apart without matching on prose.
   *
   * Publishing can fail because the button was pressed twice or because billing
   * is not configured, and those want different words on the page. Branching on
   * `err.message` would work until somebody rewords a sentence, at which point
   * the wrong banner appears and nothing fails. Optional, so every existing
   * `new UserError("…")` keeps working untouched.
   */
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "UserError";
    this.code = code;
  }
}

/**
 * Log the real failure and return what the UI should say.
 *
 * `scope` is a short tag that makes the entry greppable in Vercel's log
 * explorer, e.g. `[photo-upload]`.
 */
export function reportError(scope: string, err: unknown, fallback: string) {
  if (err instanceof UserError) {
    // Expected, actionable, already phrased for a human — no stack needed.
    console.warn(`[${scope}] ${err.message}`);
    return err.message;
  }
  const ref = Math.random().toString(36).slice(2, 8);
  console.error(`[${scope}] ref=${ref}`, err);
  return `${fallback} (reference ${ref})`;
}
