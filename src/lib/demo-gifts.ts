/**
 * A realistic twenty-gift registry, shared by the template preview and the seed.
 *
 * Two deliberate choices worth stating.
 *
 * **Links are retailer searches, not deep product URLs.** A hardcoded product
 * page is a 404 waiting to happen — retailers rotate SKUs constantly, and a
 * demo that half-works is worse than one that plainly works. A search URL for
 * "Le Creuset Dutch oven" on Williams Sonoma lands on the product today and
 * will still land on it next year.
 *
 * **Images are generated, not hotlinked.** Pulling product photography from
 * Amazon or Crate & Barrel into a wedding website means embedding someone
 * else's copyrighted asset, from a host that actively blocks hotlinking, on a
 * white studio background that fights this page's cream. Planners paste their
 * own image URL per gift — the field exists on the form — and the demo uses
 * tinted tiles in the site's own palette so the grid reads correctly without
 * pretending to be something it is not.
 */

type DemoGift = {
  title: string;
  retailer: string;
  price: string;
  /** Retailer search that resolves to the product. */
  url: string;
  /** Tile tint, chosen to sit in the wedding palettes rather than shout. */
  tint: string;
  featured?: boolean;
};

const search = (base: string, q: string) => `${base}${encodeURIComponent(q)}`;
const WS = "https://www.williams-sonoma.com/search/results.html?words=";
const CB = "https://www.crateandbarrel.com/search?query=";
const AMZ = "https://www.amazon.com/s?k=";
const TGT = "https://www.target.com/s?searchTerm=";
const PB = "https://www.potterybarn.com/search/results.html?words=";

export const DEMO_GIFTS: DemoGift[] = [
  { title: "Le Creuset Signature Dutch Oven, 5.5 qt", retailer: "Williams Sonoma", price: "$449",
    url: search(WS, "le creuset signature dutch oven"), tint: "#9c5b52", featured: true },
  { title: "KitchenAid Artisan Stand Mixer", retailer: "Williams Sonoma", price: "$449",
    url: search(WS, "kitchenaid artisan stand mixer"), tint: "#8a8f7d", featured: true },
  { title: "Breville Barista Express Espresso Machine", retailer: "Williams Sonoma", price: "$699",
    url: search(WS, "breville barista express"), tint: "#7e756a", featured: true },
  { title: "All-Clad D3 Stainless Cookware Set", retailer: "Williams Sonoma", price: "$799",
    url: search(WS, "all clad d3 stainless cookware set"), tint: "#8b8f96" },
  { title: "Vitamix A3500 Ascent Blender", retailer: "Williams Sonoma", price: "$649",
    url: search(WS, "vitamix a3500 ascent"), tint: "#5f6670" },
  { title: "Nespresso Vertuo Creatista", retailer: "Crate &amp; Barrel", price: "$249",
    url: search(CB, "nespresso vertuo"), tint: "#6f6259" },
  { title: "SMEG Two-Slice Toaster", retailer: "Crate &amp; Barrel", price: "$189",
    url: search(CB, "smeg 2 slice toaster"), tint: "#a8b4b8" },
  { title: "Cuisinart Air Fryer Toaster Oven", retailer: "Target", price: "$229",
    url: search(TGT, "cuisinart air fryer toaster oven"), tint: "#7c7a74" },
  { title: "Ninja CREAMi Ice Cream Maker", retailer: "Target", price: "$199",
    url: search(TGT, "ninja creami"), tint: "#93a0a8" },
  { title: "Crate &amp; Barrel Aspen Dinnerware, service for 8", retailer: "Crate &amp; Barrel", price: "$240",
    url: search(CB, "aspen dinnerware set"), tint: "#b7ac99" },
  { title: "Wüsthof Classic Seven-Piece Knife Block", retailer: "Williams Sonoma", price: "$599",
    url: search(WS, "wusthof classic knife block set"), tint: "#6b6b6b" },
  { title: "Brooklinen Luxe Core Sheet Set", retailer: "Brooklinen", price: "$199",
    url: "https://www.brooklinen.com/products/luxe-core-sheet-set", tint: "#c2b6a4" },
  { title: "Pottery Barn Belgian Flax Linen Duvet", retailer: "Pottery Barn", price: "$279",
    url: search(PB, "belgian flax linen duvet cover"), tint: "#bfae9a" },
  { title: "Dyson V15 Detect Cordless Vacuum", retailer: "Amazon", price: "$749",
    url: search(AMZ, "dyson v15 detect"), tint: "#7d8a8f" },
  { title: "iRobot Roomba j7+", retailer: "Amazon", price: "$599",
    url: search(AMZ, "irobot roomba j7 plus"), tint: "#5c6169" },
  { title: "Dyson Airwrap Multi-Styler", retailer: "Amazon", price: "$599",
    url: search(AMZ, "dyson airwrap multi styler"), tint: "#9b8794" },
  { title: "Sonos Era 300 Speaker", retailer: "Amazon", price: "$449",
    url: search(AMZ, "sonos era 300"), tint: "#6a6a70" },
  { title: "Samsung 55″ The Frame TV", retailer: "Amazon", price: "$1,199",
    url: search(AMZ, "samsung the frame tv 55"), tint: "#7a7268" },
  { title: "Samsonite Freeform Two-Piece Luggage Set", retailer: "Amazon", price: "$329",
    url: search(AMZ, "samsonite freeform luggage set"), tint: "#8b9aa3" },
  { title: "YETI Tundra 45 Cooler", retailer: "Amazon", price: "$325",
    url: search(AMZ, "yeti tundra 45 cooler"), tint: "#8a9285" },
];

/** A flat tinted tile with the product's initial, in the site's own register. */
export function giftTile(tint: string, letter: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">` +
    `<rect width="400" height="500" fill="${tint}"/>` +
    `<text x="200" y="292" text-anchor="middle" font-family="Georgia,serif" ` +
    `font-size="148" fill="rgba(255,255,255,.30)">${letter}</text></svg>`;
  // base64 rather than `;utf8,` plus percent-encoding: the latter is a
  // non-standard media-type parameter and browsers reject the URI outright.
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** Shape ready for `prisma.registryItem.createMany` or for the preview. */
export function demoGiftRows(weddingId: string) {
  return DEMO_GIFTS.map((g, i) => ({
    id: `gift_${i + 1}`,
    weddingId,
    title: g.title.replace(/&amp;/g, "&"),
    retailer: g.retailer.replace(/&amp;/g, "&"),
    price: g.price,
    url: g.url,
    imageUrl: giftTile(g.tint, g.title.trim()[0] ?? "·"),
    featured: Boolean(g.featured),
    sortOrder: i * 10,
    purchasedBy: null as string | null,
    purchasedAt: null as Date | null,
    purchaseNote: null as string | null,
  }));
}
