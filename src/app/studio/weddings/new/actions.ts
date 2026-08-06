"use server";

import { requireStudio } from "@/server/services/context";
import { requestCustomDesign } from "@/server/services/custom-design";
import { reportError } from "@/lib/errors";

export type CustomDesignResult = { ok: true } | { ok: false; message: string };

/**
 * The "Request Custom Template" button on the picker.
 *
 * Deliberately takes no arguments. The card sits inside the new-wedding form,
 * and anything this action accepted from the client would be a field the
 * planner had not knowingly filled in — the useful context (who asked, which
 * studio) is on the session, where it cannot be forged. If a free-text note is
 * wanted later it should be a real labelled input, not a hidden one.
 *
 * Returns a result rather than throwing, because a throw inside a server action
 * reaches the browser as "an error occurred in the Server Components render"
 * with no message at all — which is exactly what a rate-limited planner would
 * see instead of the sentence explaining why nothing happened.
 */
export async function requestCustomTemplate(): Promise<CustomDesignResult> {
  const { studio, user } = await requireStudio();

  try {
    await requestCustomDesign({
      studioId: studio.id,
      studioName: studio.name,
      actorName: user.name ?? user.email ?? "A planner",
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: reportError(
        "custom-design",
        err,
        "That request could not be sent. Please try again in a moment.",
      ),
    };
  }
}
