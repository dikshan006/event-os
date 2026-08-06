import { describe, it, expect } from "vitest";
import {
  brandFont,
  brandingFor,
  emailBrandingFor,
  BRAND_FONTS,
  BRAND_FONT_KEYS,
} from "../src/lib/branding";
import { renderHtml, renderText, type Message } from "../src/lib/email-render";

/**
 * The branding column is a String, which means every guarantee an enum would
 * have given us has to be a test instead. That is the trade documented on the
 * model, and this file is the other half of it.
 */

const STUDIO = {
  name: "Ellison & Co",
  brandColor: "#9D5C64",
  brandFont: "EDITORIAL",
  logoUrl: "https://cdn.example.com/studios/s1/brand/abc/logo.png",
  logoWidth: 640,
  logoHeight: 160,
};

describe("brandFont", () => {
  it("resolves a known key", () => {
    expect(brandFont("SCRIPT").key).toBe("SCRIPT");
    expect(brandFont("SCRIPT").label).toBe(BRAND_FONTS.SCRIPT.label);
  });

  /**
   * The case the String column exists to survive: a row written by a build that
   * offered a face this one does not. It must render, not throw.
   */
  it("falls back to CLASSIC for an unknown, empty or missing value", () => {
    expect(brandFont("FRAKTUR").key).toBe("CLASSIC");
    expect(brandFont("").key).toBe("CLASSIC");
    expect(brandFont(null).key).toBe("CLASSIC");
    expect(brandFont(undefined).key).toBe("CLASSIC");
  });

  it("never resolves to a key the picker does not offer", () => {
    for (const v of ["CLASSIC", "nonsense", "", "__proto__", "toString"]) {
      expect(BRAND_FONT_KEYS).toContain(brandFont(v).key);
    }
  });

  it("gives every offered face both a web and an email stack", () => {
    for (const key of BRAND_FONT_KEYS) {
      expect(BRAND_FONTS[key].stack).toBeTruthy();
      expect(BRAND_FONTS[key].emailStack).toBeTruthy();
      // No webfont may leak into the email stack — nothing there is resident.
      expect(BRAND_FONTS[key].emailStack).not.toContain("var(--");
    }
  });
});

describe("brandingFor", () => {
  it("returns the logo when the row is complete", () => {
    expect(brandingFor(STUDIO).logo).toEqual({
      src: STUDIO.logoUrl,
      width: 640,
      height: 160,
    });
  });

  /**
   * Dimensions are what let the <img> reserve space. A logo without them would
   * render and shift the page, so a half-written row is treated as no logo.
   */
  it("treats a logo with no dimensions as absent", () => {
    expect(brandingFor({ ...STUDIO, logoWidth: null }).logo).toBeNull();
    expect(brandingFor({ ...STUDIO, logoHeight: null }).logo).toBeNull();
    expect(brandingFor({ ...STUDIO, logoUrl: null }).logo).toBeNull();
  });
});

describe("emailBrandingFor", () => {
  it("uses the resident-font stack, never the webfont variable", () => {
    const b = emailBrandingFor(STUDIO);
    expect(b.face).toBe(BRAND_FONTS.EDITORIAL.emailStack);
    expect(b.face).not.toContain("var(--");
  });

  /** A mail client has no origin to resolve a relative path against. */
  it("drops a logo that is not an absolute http(s) URL", () => {
    expect(emailBrandingFor({ ...STUDIO, logoUrl: "/uploads/logo.png" }).logo).toBeNull();
    expect(emailBrandingFor({ ...STUDIO, logoUrl: "javascript:alert(1)" }).logo).toBeNull();
  });
});

/* ------------------------------------------------------------ letterhead -- */

const base: Message = {
  preheader: "Your invitation is ready.",
  brand: "Ellison & Co",
  color: "#9D5C64",
  blocks: [{ t: "p", text: "Hello." }],
};

describe("email letterhead", () => {
  it("sets the studio name in the chosen face when there is no logo", () => {
    const html = renderHtml({ ...base, face: BRAND_FONTS.SCRIPT.emailStack });
    expect(html).toContain(BRAND_FONTS.SCRIPT.emailStack.replace(/'/g, "&#39;"));
    expect(html).toContain("Ellison &amp; Co");
    expect(html).not.toContain("<img src=\"https://cdn.example.com");
  });

  it("emits the logo with real dimensions, capped for Outlook", () => {
    const html = renderHtml({
      ...base,
      logo: { src: STUDIO.logoUrl, width: 640, height: 160 },
    });
    // Capped to 180 wide, and the height scaled with it rather than left at 160.
    expect(html).toContain('width="180"');
    expect(html).toContain('height="45"');
    expect(html).toContain(STUDIO.logoUrl);
  });

  it("uses the studio name as the logo's alt text, escaped", () => {
    const html = renderHtml({
      ...base,
      brand: 'Ellison & "Co"',
      logo: { src: STUDIO.logoUrl, width: 400, height: 100 },
    });
    expect(html).toContain('alt="Ellison &amp; &quot;Co&quot;"');
  });

  /**
   * The src reaches the renderer from a database column. It is written by our
   * own upload path today, which is exactly the sort of assumption that stops
   * being true quietly.
   */
  it("refuses a logo src that is not http(s) and falls back to the name", () => {
    const html = renderHtml({
      ...base,
      logo: { src: "javascript:alert(1)", width: 400, height: 100 },
    });
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Ellison &amp; Co");
  });

  it("does not upscale a logo smaller than the cap", () => {
    const html = renderHtml({ ...base, logo: { src: STUDIO.logoUrl, width: 120, height: 60 } });
    expect(html).toContain('width="120"');
    expect(html).toContain('height="60"');
  });

  /** Images are blocked by default in most clients; the text part carries the name. */
  it("keeps the studio's name in the plain-text alternative regardless", () => {
    const text = renderText({ ...base, logo: { src: STUDIO.logoUrl, width: 640, height: 160 } });
    expect(text).toContain("Ellison & Co");
  });
});
