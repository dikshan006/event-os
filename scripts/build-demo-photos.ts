/**
 * Turn the demo photographs into the same artefacts a real upload produces.
 *
 *   npx tsx scripts/build-demo-photos.ts <sourceDir>
 *
 * `sourceDir` holds one folder per template, named for the template key, each
 * containing a `hero.*` and a `story.*`:
 *
 *   demo-src/
 *     _default/hero.jpg        story.jpg
 *     MIDNIGHT_BLOOM/hero.jpg  story.jpg
 *
 * A template with no folder of its own falls back to `_default`. That is what
 * makes it possible to give one template its own photography without having to
 * source a set for every other template in the same sitting.
 *
 * Deliberately runs `processImage` — the real pipeline — rather than
 * hand-writing a few `<img>` tags. The previews therefore exercise the
 * AVIF/WebP ladder, the blur placeholder and, most importantly, the tone
 * measurement: the border colour, exposure and saturation a planner sees in a
 * preview are computed from these photographs exactly as they would be from
 * their client's. A preview built any other way would be a drawing of the
 * product rather than the product.
 *
 * Identical source files are processed once and shared. Four templates
 * currently point at the same pair, and generating four byte-identical copies
 * of the rendition ladder would add ~2.7 MB of duplicates to the repository.
 *
 * Output is committed: `public/demo/*` plus a generated module. Nothing runs at
 * request time, and the preview works with no database and no storage bucket.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { processImage, srcSet, fallbackSrc } from "../src/lib/images";
import { toneStyle } from "../src/lib/photo-tone";

const TEMPLATES = ["BLUSH_ROMANCE", "MODERN_SAGE", "CLASSIC_ELEGANCE", "MIDNIGHT_BLOOM", "PACIFIC_LINEN"] as const;

const SLOTS = [
  {
    slot: "HERO" as const,
    // Described, not decorative: the hero carries the emotional weight of the
    // page and a screen-reader user should get it.
    alt: "The couple photographed together on the evening of their engagement.",
  },
  {
    slot: "STORY" as const,
    alt: "The couple lying together outdoors, from the series accompanying their story.",
  },
];

const MODULE = path.join(process.cwd(), "src", "lib", "demo-photos.generated.ts");

async function findFile(dir: string, stem: string) {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  const hit = entries.find(f => path.parse(f).name.toLowerCase() === stem);
  return hit ? path.join(dir, hit) : null;
}

async function main() {
  const [srcDir] = process.argv.slice(2);
  if (!srcDir) {
    console.error("usage: tsx scripts/build-demo-photos.ts <sourceDir>");
    process.exit(1);
  }

  /** sha1 of the source bytes → the generated constant's name. */
  const byDigest = new Map<string, string>();
  const consts: string[] = [];
  const assignments: Record<string, Record<string, string>> = {};

  for (const template of TEMPLATES) {
    assignments[template] = {};
    for (const { slot, alt } of SLOTS) {
      const stem = slot.toLowerCase();
      const own = await findFile(path.join(srcDir, template), stem);
      const file = own ?? (await findFile(path.join(srcDir, "_default"), stem));
      if (!file) {
        console.error(`  ${template}: no ${stem}, and no _default — skipped`);
        continue;
      }

      const input = await fs.readFile(file);
      const digest = crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
      let name = byDigest.get(digest);

      if (!name) {
        name = `${slot}_${digest.toUpperCase()}`;
        const basePath = `demo/${stem}-${digest}`;

        const processed = await processImage(input, slot, basePath, async (key, body) => {
          const dest = path.join(process.cwd(), "public", key);
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.writeFile(dest, body);
          return { key, bytes: body.byteLength };
        });

        // Served straight from /public, so the "storage URL" is just the path.
        const url = (key: string) => `/${key}`;
        const view = {
          id: `demo-${stem}-${digest}`,
          alt,
          caption: null,
          width: processed.width,
          height: processed.height,
          blurData: processed.blurData,
          avif: srcSet(processed.variants, "avif", url),
          webp: srcSet(processed.variants, "webp", url),
          src: fallbackSrc(processed.variants, url),
          style: toneStyle(processed.tone),
        };

        consts.push(`export const ${name}: PhotoView = ${JSON.stringify(view, null, 2)};`);
        byDigest.set(digest, name);

        const t = processed.tone;
        console.log(
          `  ${(own ? template : "_default").padEnd(17)} ${stem.padEnd(6)} ` +
            `${processed.width}×${processed.height}  ${processed.variants.length} renditions  ` +
            `lum ${t.lum.toFixed(2)} sat ${t.sat.toFixed(2)}  → brightness ${view.style["--ph-bright"]}`,
        );
      } else {
        console.log(`  ${(own ? template : "_default").padEnd(17)} ${stem.padEnd(6)} reused (${digest})`);
      }

      assignments[template][slot] = name;
    }
  }

  const table = TEMPLATES.map(t => {
    const a = assignments[t];
    return `  ${t}: { hero: ${a.HERO ?? "null"}, story: ${a.STORY ?? "null"} },`;
  }).join("\n");

  const header = `/**
 * GENERATED — do not edit by hand.
 *
 * Produced by \`scripts/build-demo-photos.ts\`, using the same \`processImage\`
 * pipeline a planner's upload goes through. The tone values below were measured
 * from the photographs themselves, which is why the template previews show the
 * real photo treatment rather than an approximation of it.
 *
 * To give a template its own photography, drop a \`hero\` and a \`story\` into a
 * folder named for that template and re-run the script.
 */
import type { PhotoView } from "./photo-view";

`;

  const footer = `

/** Which photographs each template previews with. */
export const DEMO_BY_TEMPLATE: Record<string, { hero: PhotoView | null; story: PhotoView | null }> = {
${table}
};
`;

  await fs.writeFile(MODULE, header + consts.join("\n\n") + footer);
  console.log(`\n  ${byDigest.size} unique photograph(s) → ${path.relative(process.cwd(), MODULE)}\n`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
