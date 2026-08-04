/**
 * Guessing a venue's IANA timezone from the location the planner already typed.
 *
 * The planner should almost never open the timezone select. They write
 * "Charleston, SC" or "Tuscany, Italy" in the city field, and that is enough to
 * infer the zone in the great majority of cases.
 *
 * Deliberately a lookup table rather than a geocoding API:
 *   - no key to obtain, no vendor to depend on, no per-request latency or cost
 *   - deterministic and testable, which a network guess is not
 *   - it runs on the server and in the browser from the same module, so the
 *     form can fill the field in as you type
 *
 * The trade-off is coverage. This resolves countries, the subdivisions of the
 * handful of countries that span several zones, and a few hundred cities. It
 * will not resolve a village. That is fine: the field stays editable, the
 * detection is shown rather than applied silently, and a wrong guess is one
 * select away from being right.
 */

/** Countries with a single practical zone. Keyed by lowercase name and ISO code. */
const COUNTRY: Record<string, string> = {
  // Europe
  "united kingdom": "Europe/London", uk: "Europe/London", gb: "Europe/London",
  england: "Europe/London", scotland: "Europe/London", wales: "Europe/London",
  "northern ireland": "Europe/London",
  ireland: "Europe/Dublin", ie: "Europe/Dublin",
  france: "Europe/Paris", fr: "Europe/Paris",
  spain: "Europe/Madrid", es: "Europe/Madrid",
  portugal: "Europe/Lisbon", pt: "Europe/Lisbon",
  italy: "Europe/Rome", it: "Europe/Rome",
  germany: "Europe/Berlin", de: "Europe/Berlin",
  netherlands: "Europe/Amsterdam", nl: "Europe/Amsterdam", holland: "Europe/Amsterdam",
  belgium: "Europe/Brussels", be: "Europe/Brussels",
  switzerland: "Europe/Zurich", ch: "Europe/Zurich",
  austria: "Europe/Vienna", at: "Europe/Vienna",
  greece: "Europe/Athens", gr: "Europe/Athens",
  croatia: "Europe/Zagreb", hr: "Europe/Zagreb",
  slovenia: "Europe/Ljubljana", czechia: "Europe/Prague", "czech republic": "Europe/Prague",
  poland: "Europe/Warsaw", pl: "Europe/Warsaw",
  hungary: "Europe/Budapest", romania: "Europe/Bucharest", bulgaria: "Europe/Sofia",
  denmark: "Europe/Copenhagen", sweden: "Europe/Stockholm", norway: "Europe/Oslo",
  finland: "Europe/Helsinki", iceland: "Atlantic/Reykjavik",
  turkey: "Europe/Istanbul", tr: "Europe/Istanbul",
  malta: "Europe/Malta", cyprus: "Asia/Nicosia", luxembourg: "Europe/Luxembourg",
  monaco: "Europe/Monaco", montenegro: "Europe/Podgorica", albania: "Europe/Tirane",
  serbia: "Europe/Belgrade", estonia: "Europe/Tallinn", latvia: "Europe/Riga",
  lithuania: "Europe/Vilnius", ukraine: "Europe/Kyiv",

  // Americas (single-zone ones only; the rest are handled by subdivision)
  jamaica: "America/Jamaica", cuba: "America/Havana",
  "dominican republic": "America/Santo_Domingo", "puerto rico": "America/Puerto_Rico",
  "costa rica": "America/Costa_Rica", panama: "America/Panama",
  guatemala: "America/Guatemala", belize: "America/Belize",
  colombia: "America/Bogota", peru: "America/Lima", "el salvador": "America/El_Salvador",
  ecuador: "America/Guayaquil", bolivia: "America/La_Paz",
  venezuela: "America/Caracas", uruguay: "America/Montevideo",
  paraguay: "America/Asuncion", argentina: "America/Argentina/Buenos_Aires",
  chile: "America/Santiago", barbados: "America/Barbados",
  bahamas: "America/Nassau", bermuda: "Atlantic/Bermuda", aruba: "America/Aruba",
  "saint lucia": "America/St_Lucia", "st lucia": "America/St_Lucia",
  "antigua and barbuda": "America/Antigua", grenada: "America/Grenada",
  "turks and caicos": "America/Grand_Turk", "cayman islands": "America/Cayman",

  // Africa & Middle East
  morocco: "Africa/Casablanca", egypt: "Africa/Cairo", tunisia: "Africa/Tunis",
  "south africa": "Africa/Johannesburg", za: "Africa/Johannesburg",
  kenya: "Africa/Nairobi", tanzania: "Africa/Dar_es_Salaam", uganda: "Africa/Kampala",
  nigeria: "Africa/Lagos", ghana: "Africa/Accra", ethiopia: "Africa/Addis_Ababa",
  mauritius: "Indian/Mauritius", seychelles: "Indian/Mahe",
  "united arab emirates": "Asia/Dubai", uae: "Asia/Dubai", ae: "Asia/Dubai",
  qatar: "Asia/Qatar", "saudi arabia": "Asia/Riyadh", oman: "Asia/Muscat",
  bahrain: "Asia/Bahrain", kuwait: "Asia/Kuwait", jordan: "Asia/Amman",
  lebanon: "Asia/Beirut", israel: "Asia/Jerusalem",

  // Asia & Pacific
  india: "Asia/Kolkata", in: "Asia/Kolkata",
  "sri lanka": "Asia/Colombo", nepal: "Asia/Kathmandu", pakistan: "Asia/Karachi",
  bangladesh: "Asia/Dhaka", maldives: "Indian/Maldives",
  thailand: "Asia/Bangkok", vietnam: "Asia/Ho_Chi_Minh", cambodia: "Asia/Phnom_Penh",
  singapore: "Asia/Singapore", sg: "Asia/Singapore",
  malaysia: "Asia/Kuala_Lumpur", philippines: "Asia/Manila",
  "hong kong": "Asia/Hong_Kong", hk: "Asia/Hong_Kong",
  taiwan: "Asia/Taipei", japan: "Asia/Tokyo", jp: "Asia/Tokyo",
  "south korea": "Asia/Seoul", korea: "Asia/Seoul", china: "Asia/Shanghai", cn: "Asia/Shanghai",
  "new zealand": "Pacific/Auckland", nz: "Pacific/Auckland",
  fiji: "Pacific/Fiji", "french polynesia": "Pacific/Tahiti", tahiti: "Pacific/Tahiti",
};

/**
 * Countries that span several zones. Keyed by subdivision — the state, province
 * or territory a planner would actually write — plus its postal abbreviation
 * where one exists.
 */
const SUBDIVISION: Record<string, string> = {
  /* --- United States ------------------------------------------------------ */
  alabama: "America/Chicago", al: "America/Chicago",
  alaska: "America/Anchorage", ak: "America/Anchorage",
  arizona: "America/Phoenix", az: "America/Phoenix",
  arkansas: "America/Chicago", ar: "America/Chicago",
  california: "America/Los_Angeles", ca: "America/Los_Angeles",
  colorado: "America/Denver", co: "America/Denver",
  connecticut: "America/New_York", ct: "America/New_York",
  delaware: "America/New_York", de_us: "America/New_York",
  florida: "America/New_York", fl: "America/New_York",
  georgia_us: "America/New_York", ga: "America/New_York",
  hawaii: "Pacific/Honolulu", hi: "Pacific/Honolulu",
  idaho: "America/Boise", id: "America/Boise",
  illinois: "America/Chicago", il: "America/Chicago",
  indiana: "America/Indiana/Indianapolis",
  iowa: "America/Chicago", ia: "America/Chicago",
  kansas: "America/Chicago", ks: "America/Chicago",
  kentucky: "America/New_York", ky: "America/New_York",
  louisiana: "America/Chicago", la: "America/Chicago",
  maine: "America/New_York", me: "America/New_York",
  maryland: "America/New_York", md: "America/New_York",
  massachusetts: "America/New_York", ma: "America/New_York",
  michigan: "America/Detroit", mi: "America/Detroit",
  minnesota: "America/Chicago", mn: "America/Chicago",
  mississippi: "America/Chicago", ms: "America/Chicago",
  missouri: "America/Chicago", mo: "America/Chicago",
  montana: "America/Denver", mt: "America/Denver",
  nebraska: "America/Chicago", ne: "America/Chicago",
  nevada: "America/Los_Angeles", nv: "America/Los_Angeles",
  "new hampshire": "America/New_York", nh: "America/New_York",
  "new jersey": "America/New_York", nj: "America/New_York",
  "new mexico": "America/Denver", nm: "America/Denver",
  "new york": "America/New_York", ny: "America/New_York",
  "north carolina": "America/New_York", nc: "America/New_York",
  "north dakota": "America/Chicago", nd: "America/Chicago",
  ohio: "America/New_York", oh: "America/New_York",
  oklahoma: "America/Chicago", ok: "America/Chicago",
  oregon: "America/Los_Angeles", or: "America/Los_Angeles",
  pennsylvania: "America/New_York", pa: "America/New_York",
  "rhode island": "America/New_York", ri: "America/New_York",
  "south carolina": "America/New_York", sc: "America/New_York",
  "south dakota": "America/Chicago", sd: "America/Chicago",
  tennessee: "America/Chicago", tn: "America/Chicago",
  texas: "America/Chicago", tx: "America/Chicago",
  utah: "America/Denver", ut: "America/Denver",
  vermont: "America/New_York", vt: "America/New_York",
  virginia: "America/New_York", va: "America/New_York",
  washington: "America/Los_Angeles", wa: "America/Los_Angeles",
  "west virginia": "America/New_York", wv: "America/New_York",
  wisconsin: "America/Chicago", wi: "America/Chicago",
  wyoming: "America/Denver", wy: "America/Denver",
  "washington dc": "America/New_York", "district of columbia": "America/New_York",

  /* --- Canada ------------------------------------------------------------- */
  "british columbia": "America/Vancouver", bc: "America/Vancouver",
  alberta: "America/Edmonton", ab: "America/Edmonton",
  saskatchewan: "America/Regina", sk: "America/Regina",
  manitoba: "America/Winnipeg", mb: "America/Winnipeg",
  ontario: "America/Toronto", on: "America/Toronto",
  quebec: "America/Toronto", qc: "America/Toronto",
  "new brunswick": "America/Moncton", nb: "America/Moncton",
  "nova scotia": "America/Halifax", ns: "America/Halifax",
  "prince edward island": "America/Halifax", pe: "America/Halifax",
  newfoundland: "America/St_Johns", nl_ca: "America/St_Johns",

  /* --- Australia ---------------------------------------------------------- */
  "new south wales": "Australia/Sydney", nsw: "Australia/Sydney",
  victoria: "Australia/Melbourne", vic: "Australia/Melbourne",
  queensland: "Australia/Brisbane", qld: "Australia/Brisbane",
  "south australia": "Australia/Adelaide", sa: "Australia/Adelaide",
  "western australia": "Australia/Perth", wa_au: "Australia/Perth",
  tasmania: "Australia/Hobart", tas: "Australia/Hobart",
  "northern territory": "Australia/Darwin",

  /* --- Other multi-zone countries ----------------------------------------- */
  bali: "Asia/Makassar", jakarta: "Asia/Jakarta",
};

/**
 * Cities, where the city alone is unambiguous enough to be worth resolving.
 * Cities beat subdivisions, which beat countries — the most specific signal
 * present in the text wins.
 */
const CITY: Record<string, string> = {
  london: "Europe/London", edinburgh: "Europe/London", bath: "Europe/London",
  cotswolds: "Europe/London", oxford: "Europe/London", cambridge: "Europe/London",
  dublin: "Europe/Dublin", paris: "Europe/Paris", provence: "Europe/Paris",
  bordeaux: "Europe/Paris", nice: "Europe/Paris", cannes: "Europe/Paris",
  "cote d'azur": "Europe/Paris", normandy: "Europe/Paris", loire: "Europe/Paris",
  barcelona: "Europe/Madrid", madrid: "Europe/Madrid", seville: "Europe/Madrid",
  mallorca: "Europe/Madrid", majorca: "Europe/Madrid", ibiza: "Europe/Madrid",
  marbella: "Europe/Madrid", "canary islands": "Atlantic/Canary", tenerife: "Atlantic/Canary",
  lisbon: "Europe/Lisbon", porto: "Europe/Lisbon", algarve: "Europe/Lisbon",
  madeira: "Atlantic/Madeira",
  rome: "Europe/Rome", florence: "Europe/Rome", tuscany: "Europe/Rome",
  venice: "Europe/Rome", milan: "Europe/Rome", amalfi: "Europe/Rome",
  sicily: "Europe/Rome", puglia: "Europe/Rome", "lake como": "Europe/Rome",
  como: "Europe/Rome", positano: "Europe/Rome", capri: "Europe/Rome",
  fiesole: "Europe/Rome", siena: "Europe/Rome",
  berlin: "Europe/Berlin", munich: "Europe/Berlin", amsterdam: "Europe/Amsterdam",
  brussels: "Europe/Brussels", vienna: "Europe/Vienna", zurich: "Europe/Zurich",
  geneva: "Europe/Zurich", athens: "Europe/Athens", santorini: "Europe/Athens",
  mykonos: "Europe/Athens", crete: "Europe/Athens", corfu: "Europe/Athens",
  dubrovnik: "Europe/Zagreb", split: "Europe/Zagreb", istanbul: "Europe/Istanbul",
  prague: "Europe/Prague", budapest: "Europe/Budapest", copenhagen: "Europe/Copenhagen",
  stockholm: "Europe/Stockholm", oslo: "Europe/Oslo", reykjavik: "Atlantic/Reykjavik",

  "new york city": "America/New_York", nyc: "America/New_York",
  brooklyn: "America/New_York", manhattan: "America/New_York",
  "the hamptons": "America/New_York", hamptons: "America/New_York",
  boston: "America/New_York", philadelphia: "America/New_York",
  charleston: "America/New_York", savannah: "America/New_York",
  miami: "America/New_York", "palm beach": "America/New_York",
  atlanta: "America/New_York", nashville: "America/Chicago",
  chicago: "America/Chicago", austin: "America/Chicago", dallas: "America/Chicago",
  houston: "America/Chicago", "new orleans": "America/Chicago",
  denver: "America/Denver", aspen: "America/Denver", "santa fe": "America/Denver",
  scottsdale: "America/Phoenix", sedona: "America/Phoenix",
  "las vegas": "America/Los_Angeles", "los angeles": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles", "napa valley": "America/Los_Angeles",
  napa: "America/Los_Angeles", sonoma: "America/Los_Angeles",
  "santa barbara": "America/Los_Angeles", "big sur": "America/Los_Angeles",
  seattle: "America/Los_Angeles", portland: "America/Los_Angeles",
  honolulu: "Pacific/Honolulu", maui: "Pacific/Honolulu",
  toronto: "America/Toronto", montreal: "America/Toronto", vancouver: "America/Vancouver",
  banff: "America/Edmonton", "mexico city": "America/Mexico_City",
  "cabo san lucas": "America/Mazatlan", "los cabos": "America/Mazatlan",
  cancun: "America/Cancun", "playa del carmen": "America/Cancun",
  tulum: "America/Cancun", "puerto vallarta": "America/Mexico_City",
  "rio de janeiro": "America/Sao_Paulo", "sao paulo": "America/Sao_Paulo",
  "buenos aires": "America/Argentina/Buenos_Aires",

  marrakech: "Africa/Casablanca", marrakesh: "Africa/Casablanca",
  "cape town": "Africa/Johannesburg", johannesburg: "Africa/Johannesburg",
  nairobi: "Africa/Nairobi", zanzibar: "Africa/Dar_es_Salaam",
  dubai: "Asia/Dubai", "abu dhabi": "Asia/Dubai", doha: "Asia/Qatar",

  mumbai: "Asia/Kolkata", bombay: "Asia/Kolkata", delhi: "Asia/Kolkata",
  "new delhi": "Asia/Kolkata", jaipur: "Asia/Kolkata", udaipur: "Asia/Kolkata",
  goa: "Asia/Kolkata", bangalore: "Asia/Kolkata", bengaluru: "Asia/Kolkata",
  hyderabad: "Asia/Kolkata", chennai: "Asia/Kolkata", kolkata: "Asia/Kolkata",
  kerala: "Asia/Kolkata", punjab: "Asia/Kolkata", chandigarh: "Asia/Kolkata",
  colombo: "Asia/Colombo", kathmandu: "Asia/Kathmandu",
  bangkok: "Asia/Bangkok", phuket: "Asia/Bangkok", "koh samui": "Asia/Bangkok",
  "hong kong": "Asia/Hong_Kong", tokyo: "Asia/Tokyo", kyoto: "Asia/Tokyo",
  seoul: "Asia/Seoul", shanghai: "Asia/Shanghai", beijing: "Asia/Shanghai",
  sydney: "Australia/Sydney", melbourne: "Australia/Melbourne",
  brisbane: "Australia/Brisbane", perth: "Australia/Perth", adelaide: "Australia/Adelaide",
  auckland: "Pacific/Auckland", queenstown: "Pacific/Auckland",
  wellington: "Pacific/Auckland", nadi: "Pacific/Fiji",
};

/** Normalise for matching: lowercase, strip accents and punctuation. */
function norm(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type TimeZoneGuess = { zone: string; matched: string } | null;

/**
 * Resolve a zone from whatever the planner has typed.
 *
 * Matching is most-specific-first — city, then subdivision, then country —
 * because "Charleston, SC" and "Charleston, WV" are different places and the
 * city is the stronger signal. Within a tier the longest match wins, so
 * "new york" is not beaten by "york".
 */
export function guessTimeZone(...parts: (string | null | undefined)[]): TimeZoneGuess {
  const text = norm(parts.filter(Boolean).join(" "));
  if (!text) return null;

  for (const table of [CITY, SUBDIVISION, COUNTRY]) {
    let best: TimeZoneGuess = null;
    for (const [key, zone] of Object.entries(table)) {
      // Keys carrying a disambiguating suffix (`de_us`, `wa_au`) are matched on
      // the part before the underscore; the suffix only keeps the object keys
      // unique where two places share an abbreviation.
      const needle = key.split("_")[0];
      // Word-boundary match, so "or" does not fire inside "Oregon" and "in"
      // does not fire inside "Indiana".
      const re = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
      if (re.test(text) && (!best || needle.length > best.matched.length)) {
        best = { zone, matched: needle };
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * The zone to store for a wedding.
 *
 * Falls back to the zone of whoever is filling the form — a planner usually
 * works in the same country as the wedding, so it is a better default than UTC
 * — and to UTC only when nothing else is known.
 */
export function resolveTimeZone(
  location: { city?: string | null; venue?: string | null; venueAddress?: string | null },
  fallback?: string | null,
): string {
  const guess = guessTimeZone(location.city, location.venueAddress, location.venue);
  if (guess) return guess.zone;
  if (fallback && fallback !== "UTC") return fallback;
  return "UTC";
}
