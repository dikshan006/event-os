/**
 * Runs once when a server instance boots, before it serves anything.
 *
 * Next calls this automatically. It is the only hook that runs early enough to
 * turn a configuration mistake into a failed deploy rather than into a 500 that
 * a user finds first.
 *
 * The runtime guard matters: this file is also loaded for the edge runtime,
 * where `server-only` modules and Node built-ins are unavailable, and the
 * middleware that runs there does not read any of these variables anyway.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("./lib/env");
  assertEnv();
}
