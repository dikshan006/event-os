/**
 * Turn the demo photographs into the same artefacts a real upload produces.
 *
 *   npx tsx scripts/build-demo-photos.ts <hero.jpg> <story.jpg>
 *
 * Deliberately runs `processImage` — the real pipeline — rather than
 * hand-writing a few `<img>` tags. That means the template previews exercise
 * the AVIF/WebP ladder, the blur placeholder and, most importantly, the tone
 * measurement: the border colour, exposure and saturation a planner sees in a
 * preview are computed from these photographs exactly as they would be from
 * their client's. A preview built any other way would be a drawing of the
 * product rather than the product.
 *
 * Output is committed: `public/demo/*` plus a generated module. Nothing runs at
 * request time, and the preview works with no database and no storage bucket.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { processImage } from "../src/lib/images";
import { toneStyle } from "../src/lib/photo-tone";
import { srcSet, fallbackSrc } from "../src/lib/images";

const OUT_DIR = path.join(process.cwd(), "public", "demo");
const MODULE = path.join(process.cwd(), "src", "lib", "demo-photos.generated.ts");

type Job = {
  file: string;
  id: string;
  slot: "HERO" | "STORY";
  alt: string;
  caption: string | null;
};

async function main() {
  const [heroFile, storyFile] = process.argv.slice(2);
  if (!heroFile || !storyFile) {
    console.error("usage: tsx scripts/build-demo-photos.ts <hero> <story>");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const jobs: Job[] = [
    {
      file: heroFile,
      id: "demo-hero",
      slot: "HERO",
      // Described, not decorative: the hero carries the emotional weight of the
      // page and a screen-reader user should get it.
      alt: "A couple on a lamplit cobbled street at night, one carrying the other, both laughing.",
      caption: null,
    },
    {
      file: storyFile,
      id: "demo-story",
      slot: "STORY",
      alt: "The couple lying together in a meadow of yellow flowers below a mountain ridge.",
      caption: null,
    },
  ];

  const views: string[] = [];

  for (const job of jobs) {
    const input = await fs.readFile(job.file);
    const basePath = `demo/${job.id}`;

    const processed = await processImage(input, job.slot, basePath, async (key, body) => {
      const dest = path.join(process.cwd(), "public", key);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, body);
      return { key, bytes: body.byteLength };
    });

    // Served straight from /public, so the "storage URL" is just the path.
    const url = (key: string) => `/${key}`;

    const view = {
      id: job.id,
      alt: job.alt,
      caption: job.caption,
      width: processed.width,
      height: processed.height,
      blurData: processed.blurData,
      avif: srcSet(processed.variants, "avif", url),
      webp: srcSet(processed.variants, "webp", url),
      src: fallbackSrc(processed.variants, url),
      style: toneStyle(processed.tone),
    };

    views.push(`export const ${job.id.replace("-", "_").toUpperCase()}: PhotoView = ${JSON.stringify(view, null, 2)};`);

    const t = processed.tone;
    console.log(
      `  ${job.id.padEnd(11)} ${processed.width}×${processed.height}  ` +
        `${processed.variants.length} renditions  ` +
        `lum ${t.lum.toFixed(2)} sat ${t.sat.toFixed(2)} spread ${t.spread.toFixed(2)}  ` +
        `→ brightness ${view.style["--ph-bright"]} saturate ${view.style["--ph-saturate"]}`,
    );
  }

  const header = `/**
 * GENERATED — do not edit by hand.
 *
 * Produced by \`scripts/build-demo-photos.ts\` from the demo photographs, using
 * the same \`processImage\` pipeline a planner's upload goes through. The tone
 * values below were measured from the images themselves, which is why the
 * template previews show the real photo treatment rather than an approximation
 * of it.
 *
 * To replace the demo photography, drop in new files and re-run the script.
 */
import type { PhotoView } from "./photo-view";

`;

  await fs.writeFile(MODULE, header + views.join("\n\n") + "\n");
  console.log(`\n  wrote ${path.relative(process.cwd(), MODULE)}\n`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
