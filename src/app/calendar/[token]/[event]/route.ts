import { NextResponse } from "next/server";
import { calendarFeed, calendarable } from "@/server/services/calendar-feed";
import { buildIcs, icsFilename, calendarTitle } from "@/lib/calendar";

/**
 * The .ics endpoint. One route serves every case.
 *
 *   /calendar/{inviteCode}/all.ics        every event that guest can see
 *   /calendar/{inviteCode}/{eventId}.ics  one of them
 *   /calendar/{weddingSlug}/all.ics       the public schedule
 *
 * Served over HTTP rather than generated as a Blob in the browser on purpose.
 * On iOS, navigating to a `text/calendar` response opens the system's own
 * "Add to Calendar" sheet — the native, one-tap behaviour the feature is meant
 * to have. Blob and data: URLs are handled inconsistently there, and on some
 * versions render the file as text instead of importing it.
 *
 * Authorisation is entirely inherited: `calendarFeed` resolves the token
 * through the same rules the invitation page uses, so this endpoint cannot
 * expose an event the corresponding page would not.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string; event: string }> },
) {
  const { token, event } = await ctx.params;

  // The path ends in .ics so that clients which sniff the extension — Outlook
  // desktop among them — recognise it before reading a single header.
  const eventId = event.replace(/\.ics$/i, "");

  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
  const feed = await calendarFeed(token, appUrl);

  // 404 rather than 403: a wrong token should not confirm that a right one
  // exists, and these URLs are capabilities.
  if (!feed) return new NextResponse("Not found", { status: 404 });

  const dated = calendarable(feed.events);
  const selected = eventId === "all" ? dated : dated.filter(e => e.uid.startsWith(`${eventId}@`));

  if (!selected.length) {
    return new NextResponse(
      "This event does not have a scheduled time yet.",
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const name =
    selected.length === 1 ? calendarTitle(selected[0]) : `${feed.calendarName} — Schedule`;

  return new NextResponse(buildIcs(selected, name), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // `attachment` is what makes a desktop browser hand the file to the
      // calendar application rather than printing it into the tab.
      "Content-Disposition": `attachment; filename="${icsFilename(name)}"`,
      // A personal feed is one guest's schedule and must never be held by a
      // shared cache. The public one is safe to keep briefly.
      "Cache-Control": feed.personal
        ? "private, no-store"
        : "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
