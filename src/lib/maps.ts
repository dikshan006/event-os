/**
 * Map links.
 *
 * Both providers are given coordinates when we have them and a text query when
 * we do not — a pin is exact, a search is a guess, and "The Old Barn" is a
 * guess in a lot of places at once. The planner only ever types a venue and an
 * address; coordinates are optional and only sharpen the result.
 *
 * No API key, no SDK, no map embedded in the page. These are the documented
 * universal URL schemes, they open the installed app on a phone and the web
 * map on a desktop, and they cost nothing to render.
 */

export type MapPlace = {
  /** "Villa Aurelia" */
  name: string | null;
  /** "Via Angelo Masina 5, 00153 Roma" */
  address: string | null;
  lat: number | null;
  lng: number | null;
};

/** Somewhere worth linking to. */
export function hasPlace(p: MapPlace): boolean {
  return Boolean(p.name || p.address || (isCoord(p.lat) && isCoord(p.lng)));
}

function isCoord(n: number | null): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Coordinates only when both are present and in range. */
function coords(p: MapPlace): string | null {
  if (!isCoord(p.lat) || !isCoord(p.lng)) return null;
  if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return null;
  return `${p.lat},${p.lng}`;
}

/** What a human would type into a search box. */
export function placeQuery(p: MapPlace): string {
  return [p.name, p.address].filter(Boolean).join(", ");
}

/** One-line display of where something is. */
export function placeLabel(p: MapPlace): string | null {
  return placeQuery(p) || (coords(p) ? coords(p) : null);
}

/**
 * Google Maps universal cross-platform URL.
 *
 * `api=1` is the documented, stable form. On Android and iOS with the app
 * installed the OS hands it to Google Maps; otherwise it opens the web map.
 * When we have both a pin and a name we send the query as text and the
 * coordinates as `query_place_id`'s poorer but keyless cousin — the coordinate
 * query — because a coordinate always resolves to the right point.
 */
export function googleMapsUrl(p: MapPlace): string {
  const c = coords(p);
  const q = c ?? placeQuery(p);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Apple Maps.
 *
 * `maps.apple.com` opens the Maps app on Apple devices and falls back to a web
 * map elsewhere, so it is safe to show to everyone rather than sniffing the
 * user agent — which would be wrong for anyone on a Mac with an Android phone,
 * and for every guest opening the invitation on a shared device.
 *
 * `ll` places the pin, `q` names it. Given both, Apple shows the name at the
 * exact point, which is the best of the two.
 */
export function appleMapsUrl(p: MapPlace): string {
  const params = new URLSearchParams();
  const c = coords(p);
  if (c) {
    params.set("ll", c);
    if (p.name) params.set("q", p.name);
  } else {
    params.set("q", placeQuery(p));
  }
  return `https://maps.apple.com/?${params}`;
}

/**
 * An event's place, falling back to the wedding's venue.
 *
 * Most events happen at the main venue and the planner should not have to
 * retype the address on every one of them. An event only overrides when it
 * actually has its own location.
 */
export function resolvePlace(
  event: { location: string | null; address: string | null; lat: number | null; lng: number | null },
  wedding: { venue: string | null; venueAddress: string | null; venueLat: number | null; venueLng: number | null; city: string | null },
): MapPlace {
  const ownPlace = Boolean(event.location || event.address || (isCoord(event.lat) && isCoord(event.lng)));

  if (ownPlace) {
    return {
      name: event.location,
      // An event with its own name but no address of its own still benefits
      // from the venue's address when it is on the same site.
      address: event.address ?? (event.location === wedding.venue ? wedding.venueAddress : null),
      lat: event.lat,
      lng: event.lng,
    };
  }

  return {
    name: wedding.venue,
    address: wedding.venueAddress ?? wedding.city,
    lat: wedding.venueLat,
    lng: wedding.venueLng,
  };
}
