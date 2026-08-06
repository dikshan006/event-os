"use client";

import { useState } from "react";
import { BRAND_FONTS, BRAND_FONT_KEYS, type BrandFontKey } from "@/lib/branding";

/**
 * The studio's identity, with the preview wired to the controls.
 *
 * A client component for one reason: choosing a typeface from a list of names
 * is choosing blind. "Editorial" and "Refined" are both serifs and the
 * difference between them is the entire decision, so the preview has to move as
 * the radio moves. Everything else here is an ordinary uncontrolled form
 * posting to a server action, and it still submits correctly with JavaScript
 * disabled — only the live preview is lost.
 *
 * The preview deliberately shows the logo when there is one. A planner who has
 * uploaded a wordmark is not choosing a face for their name in the sidebar
 * (they will never see it there); they are choosing the face for the credit
 * line under a wedding site, which is what the second row shows.
 */
export function StudioBrandForm({
  action,
  studio,
  logo,
}: {
  action: (formData: FormData) => Promise<void>;
  studio: {
    name: string;
    brandColor: string;
    brandFont: string;
    website: string;
    instagram: string;
    contactEmail: string;
    contactPhone: string;
  };
  logo: { src: string; width: number; height: number } | null;
}) {
  const [name, setName] = useState(studio.name);
  const [color, setColor] = useState(studio.brandColor);
  const [font, setFont] = useState<BrandFontKey>(
    (BRAND_FONT_KEYS as string[]).includes(studio.brandFont)
      ? (studio.brandFont as BrandFontKey)
      : "CLASSIC",
  );

  const chosen = BRAND_FONTS[font];
  const tracked = chosen.treatment === "tracked";

  return (
    <div className="split">
      <form action={action} className="card pad frm">
        <div className="field">
          <label htmlFor="sb-name">Studio name</label>
          <input
            id="sb-name"
            className="inp"
            name="name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={120}
          />
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Brand typeface</legend>
          <span className="hint" style={{ display: "block", marginBottom: 10 }}>
            How your studio’s name is set — in the sidebar, in the credit under
            every wedding website, and on your emails. It never changes a
            couple’s template.
          </span>
          <div className="font-grid">
            {BRAND_FONT_KEYS.map(key => {
              const f = BRAND_FONTS[key];
              return (
                <label key={key} className="font-choice" data-on={key === font ? "true" : undefined}>
                  <input
                    type="radio"
                    name="brandFont"
                    value={key}
                    checked={key === font}
                    onChange={() => setFont(key)}
                  />
                  <span className="font-choice-body">
                    <span
                      className="font-choice-sample"
                      style={{
                        fontFamily: f.stack,
                        color,
                        letterSpacing: f.treatment === "tracked" ? ".08em" : undefined,
                        textTransform: f.treatment === "tracked" ? "uppercase" : "none",
                      }}
                    >
                      {name.trim() || "Your studio"}
                    </span>
                    <span className="font-choice-name">{f.label}</span>
                    <span className="meta">{f.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="frm two">
          <div className="field">
            <label htmlFor="sb-color">Brand color</label>
            <input
              id="sb-color"
              className="inp"
              name="brandColor"
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{ height: 42, padding: 4 }}
            />
          </div>
          <div className="field">
            <label htmlFor="sb-website">Website</label>
            <input id="sb-website" className="inp" name="website" defaultValue={studio.website} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="sb-instagram">Instagram</label>
            <input id="sb-instagram" className="inp" name="instagram" defaultValue={studio.instagram} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="sb-email">Contact email</label>
            <input id="sb-email" className="inp" name="contactEmail" type="email" defaultValue={studio.contactEmail} />
          </div>
          <div className="field">
            <label htmlFor="sb-phone">Phone</label>
            <input id="sb-phone" className="inp" name="contactPhone" defaultValue={studio.contactPhone} maxLength={40} />
          </div>
        </div>

        <div>
          <button className="btn btn-primary" type="submit">Save changes</button>
        </div>
      </form>

      <div className="card pad" style={{ background: "var(--cream)", border: "none" }}>
        <div className="eyebrow" style={{ color: "var(--soft)" }}>White label</div>
        <h2 className="section-t" style={{ marginTop: 6 }}>What guests see</h2>
        <p className="meta" style={{ marginBottom: 18 }}>
          Every wedding website carries your studio’s brand — never ours.
        </p>

        <div className="card pad" style={{ textAlign: "center" }}>
          <div className="script" style={{ fontSize: 26, color }}>Sarah &amp; James</div>
          <div className="brand-credit" style={{ marginTop: 14 }}>
            {logo ? (
              /*
                Not next/image: the source is a bucket on whatever storage the
                deployment configured, and the loader would need every one of
                those hosts allow-listed. The file is a few kilobytes and has
                explicit dimensions, so there is nothing the optimizer would win.
              */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.src}
                alt={`${name.trim() || "Studio"} logo`}
                width={logo.width}
                height={logo.height}
                className="brand-logo"
              />
            ) : (
              <>
                <span className="brand-credit-by">Designed by</span>
                <span
                  className="brand-credit-name"
                  style={{
                    fontFamily: chosen.stack,
                    letterSpacing: tracked ? ".16em" : undefined,
                    textTransform: tracked ? "uppercase" : "none",
                    fontSize: tracked ? 11 : 20,
                  }}
                >
                  {name.trim() || "Your studio"}
                </span>
              </>
            )}
          </div>
        </div>

        <p className="hint" style={{ marginTop: 14 }}>
          {logo
            ? "Your logo replaces the name wherever it fits. The typeface still sets your name in emails and anywhere the logo is too wide to sit well."
            : "Upload a logo below and it will take the place of your name here."}
        </p>
      </div>
    </div>
  );
}
