"use client";

import { useEffect, useRef, useState } from "react";
import { COMMON_TIME_ZONES } from "@/lib/timezone";
import { guessTimeZone } from "@/lib/timezone-lookup";

/**
 * The timezone field, which mostly fills itself in.
 *
 * It watches the city input in the same form and proposes a zone as the planner
 * types. The proposal is applied, not merely suggested — a field that says "did
 * you mean Europe/Rome?" and waits is one more thing to click — but it is
 * always visible, always editable, and never overwrites a zone the planner
 * chose by hand.
 *
 * The lookup is the same module the server uses, so what the form shows and
 * what gets saved cannot disagree.
 */
export function TimeZoneField({
  name = "timeZone",
  value,
  citySelector = 'input[name="city"]',
  addressSelector = 'input[name="venueAddress"]',
  label = "Time zone",
}: {
  name?: string;
  /** Existing value when editing. Empty on a new wedding. */
  value?: string | null;
  citySelector?: string;
  addressSelector?: string;
  label?: string;
}) {
  const [zone, setZone] = useState(value || "");
  const [source, setSource] = useState<"detected" | "chosen" | "none">(value ? "chosen" : "none");
  const [matched, setMatched] = useState<string | null>(null);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const root = ref.current?.form;
    if (!root) return;

    const city = root.querySelector<HTMLInputElement>(citySelector);
    const address = root.querySelector<HTMLInputElement>(addressSelector);
    if (!city && !address) return;

    const detect = () => {
      // A zone the planner picked themselves is never overwritten. They know
      // something the lookup does not — a venue over a border, a marquee in a
      // field — and having it snap back while they type would be maddening.
      setSource(prev => {
        if (prev === "chosen") return prev;
        const guess = guessTimeZone(city?.value, address?.value);
        if (guess) {
          setZone(guess.zone);
          setMatched(guess.matched);
          return "detected";
        }
        setMatched(null);
        return "none";
      });
    };

    detect();
    city?.addEventListener("input", detect);
    address?.addEventListener("input", detect);
    return () => {
      city?.removeEventListener("input", detect);
      address?.removeEventListener("input", detect);
    };
  }, [citySelector, addressSelector]);

  // The stored zone may not be one of the common ones; list it so that opening
  // and saving the form can never silently change it.
  const options = COMMON_TIME_ZONES.includes(zone as (typeof COMMON_TIME_ZONES)[number])
    ? [...COMMON_TIME_ZONES]
    : [zone, ...COMMON_TIME_ZONES].filter(Boolean);

  const id = `tz-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        ref={ref}
        id={id}
        className="inp"
        name={name}
        value={zone}
        onChange={e => {
          setZone(e.target.value);
          setSource("chosen");
        }}
      >
        {!zone && <option value="">Detecting from the location…</option>}
        {options.map(tz => (
          <option key={tz} value={tz}>
            {tz.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <span className="hint" aria-live="polite">
        {source === "detected" && matched
          ? `Detected from “${matched}”. Event times are entered in this zone.`
          : source === "chosen"
            ? "Event times are entered in this zone."
            : "Add a city or address and this fills itself in."}
      </span>
    </div>
  );
}
