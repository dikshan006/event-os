/**
 * The botanical corner spray.
 *
 * Drawn rather than photographed, for two reasons. A painted rose is a raster
 * asset, and a raster asset has one fixed colour — it would be a foreign object
 * in a system where every other surface is mixed from the active palette. And
 * at the size this is used, a photograph of flowers would have to be either
 * large enough to matter (heavy) or small enough to be free (mush).
 *
 * The geometry is generated, not eyeballed:
 *
 *   Each bloom is thirty overlapping cupped petals on a golden-angle spiral,
 *   drawn outermost-first and lightening toward the centre — roughly how a
 *   garden rose assembles. Every petal is jittered in size, width, curl and
 *   angle from a seed derived from the flower's own position, because a bloom
 *   built from one shape rotated thirty times reads instantly as stamped. The
 *   seed is fixed, so the committed file never churns between runs.
 *
 *   Each petal carries a rim one step darker than its fill. Flat fills alone
 *   gave no separation where petals overlapped, and the whole flower collapsed
 *   into a rosette.
 *
 *   Leaves cycle three greens and carry a midrib and four side veins. One flat
 *   green reads as a silhouette; the veins are most of what says "leaf".
 *
 * Colour comes from exactly two theme variables — `--bot-bloom` and
 * `--bot-foliage` — which the template mixes into nine bloom steps, nine rims
 * and three foliage tones. Nothing here is rose-coloured by nature.
 *
 * The spray deliberately bleeds off both edges of its box, the way a printed
 * corner does. Contained inside it, it read as a bouquet placed near a corner
 * rather than as a frame.
 *
 * There is no blur filter. An earlier version softened the whole group by half
 * a pixel, and the filter region — which is a finite box — left a faintly
 * lighter rectangle around each spray on a near-black page. The per-petal
 * jitter now does what the blur was there for, and nothing is clipped.
 *
 * ── Why the geometry lives in <defs> ──────────────────────────────────────
 * There are four sprays on a page: two in the masthead, two in the footer.
 * Inlining the paths into each was 18 KB of path data four times over, in the
 * HTML, on every request. It is declared once here and referenced by <use>,
 * which is what <defs> is for.
 */

/** Renders the geometry once per document. Everything else points at it. */
export function BotanicalDefs() {
  return (
    <svg className="bot-defs" aria-hidden="true" focusable="false">
      <defs>
        <g id="bot-spray">
        <path d="M-40 -26C90 42 210 34 400 -4" fill="none" stroke="var(--bot-stem)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M-26 -40C42 90 34 210 -4 400" fill="none" stroke="var(--bot-stem)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M4 4C120 92 176 178 206 300" fill="none" stroke="var(--bot-stem)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M-14 74C84 140 158 214 182 352" fill="none" stroke="var(--bot-stem)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M74 -14C140 84 214 158 352 182" fill="none" stroke="var(--bot-stem)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M45.2 8.3C77.6 7.2 91.2 40.6 87.7 69C52.6 63.1 31.1 34.7 45.2 8.3Z" fill="var(--bot-l3)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M108.3 21.1C105.6 -7.3 134 -20.3 159 -18C155.5 12.9 131.9 32.7 108.3 21.1Z" fill="var(--bot-l1)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M174.4 24.9C207.4 13.8 230.9 43.7 235.3 73.9C197.6 78.6 167.5 56.2 174.4 24.9Z" fill="var(--bot-l3)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M245.7 20.9C237.5 -3.8 259.9 -21.1 282.5 -24.1C285.9 4 269.1 26.4 245.7 20.9Z" fill="var(--bot-l2)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M324.1 10.1C342.5 0 358.9 15.3 364.1 32.9C342.4 39.5 322.7 29.3 324.1 10.1Z" fill="var(--bot-l3)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M8.3 45.2C37.1 30.1 63.8 54.3 73 81.4C38.8 91.3 7 75.1 8.3 45.2Z" fill="var(--bot-l1)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M21.1 108.3C33.5 134 11.4 156.1 -12.8 162.6C-20.3 132.4 -5.1 105.6 21.1 108.3Z" fill="var(--bot-l2)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M24.9 174.4C58.9 167.1 78.8 199.5 79.7 230.1C41.8 230.4 14.4 204.7 24.9 174.4Z" fill="var(--bot-l1)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M20.9 245.7C26.6 271.1 2.6 286.1 -20.2 286.8C-20.8 258.5 -1.8 238 20.9 245.7Z" fill="var(--bot-l3)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M10.1 324.1C31 322.8 39.4 343.6 36.7 361.6C14.3 358.5 0.7 341 10.1 324.1Z" fill="var(--bot-l1)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M93.1 83.7C115.9 96.2 111.2 124.1 96.7 141.7C75.1 123.3 72.2 95.5 93.1 83.7Z" fill="var(--bot-l3)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M141.1 145C161 124.6 189.3 137.8 203.7 158.3C177.9 175.7 147.5 170.5 141.1 145Z" fill="var(--bot-l2)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M176.7 211.5C191.6 228.1 179.9 249.5 163.2 259.7C150.9 238.6 156.5 215.2 176.7 211.5Z" fill="var(--bot-l1)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M196.2 264.4C211.1 255.7 225.1 268 229.8 282.3C212.1 288.3 195.5 280.4 196.2 264.4Z" fill="var(--bot-l3)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M94.9 165.5C108.5 146.4 132.8 153.8 146.8 168.8C128.1 186.1 103.1 185.6 94.9 165.5Z" fill="var(--bot-l2)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M144.5 237.3C162.3 254.7 150.8 279.5 133.1 292.2C117.8 269.8 122.3 243.2 144.5 237.3Z" fill="var(--bot-l1)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M173.3 312.5C189.5 303.7 203.7 317.1 208 332.6C189 338.3 171.9 329.4 173.3 312.5Z" fill="var(--bot-l1)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M165.5 94.9C187.2 103.9 185.5 129.2 174 146.2C152.9 131.9 147.8 107.3 165.5 94.9Z" fill="var(--bot-l3)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M237.3 144.5C243.8 120.4 271.1 118.3 290.8 127.7C278.6 151.9 253.2 161 237.3 144.5Z" fill="var(--bot-l2)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M312.5 173.3C330.8 171.9 338.3 190 335.9 205.8C316.2 203.3 304.2 188.2 312.5 173.3Z" fill="var(--bot-l2)" stroke="var(--bot-vein)" strokeWidth=".7" strokeOpacity=".5" />
        <path d="M45.2 8.3Q64.6 36.4 85.7 65.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M57.4 26.9Q53.2 38.3 49 49.6" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M63.9 36.8Q75.5 38.3 87 39.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M69.6 45.5Q65.2 56.9 60.8 68.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M75.3 54.1Q86.7 55.7 98.1 57.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M108.3 21.1Q131.7 3.3 156.3 -16.2" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M123.8 9.8Q133.9 13.1 144 16.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M132.1 3.8Q132.8 -6.4 133.5 -16.6" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M139.3 -1.4Q149.5 2 159.7 5.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M146.6 -6.7Q147.4 -16.8 148.2 -26.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M174.4 24.9Q202.3 47.6 232.3 71.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M192.2 40.1Q191.2 53 190.1 65.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M201.7 48.3Q214 46.2 226.3 44.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M210 55.4Q208.8 68.4 207.6 81.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M218.3 62.5Q230.4 60.6 242.6 58.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M245.7 20.9Q262.8 0.3 280.6 -21.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M257.2 7.7Q266.8 8.6 276.4 9.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M263.3 0.7Q261.7 -8.5 260.2 -17.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M268.6 -5.4Q278.3 -4.4 288.1 -3.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M273.9 -11.5Q272.5 -20.6 271.1 -29.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M324.1 10.1Q342.4 20.7 362.2 31.6" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M335.9 17.3Q336.4 25 336.9 32.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M342.2 21.1Q349.2 18.6 356.3 16.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M347.7 24.4Q348.1 32.3 348.5 40.2" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M353.2 27.8Q360.1 25.4 367.1 23" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M8.3 45.2Q37.9 62.1 69.8 79.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M27.4 56.6Q28.5 68.7 29.7 80.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M37.5 62.7Q48.6 59 59.6 55.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M46.4 68.1Q47.5 80.3 48.5 92.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M55.3 73.4Q66.2 69.9 77.2 66.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M21.1 108.3Q5.4 133.2 -11 160" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M10.5 124.2Q-0.1 124.7 -10.7 125.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M4.8 132.8Q7.7 142.6 10.6 152.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M-0.2 140.2Q-10.9 140.5 -21.7 140.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M-5.1 147.7Q-2.4 157.4 0.4 167.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M24.9 174.4Q50 200.2 77.2 227.2" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M40.8 191.6Q38.3 204.3 35.8 217" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M49.3 200.7Q61.8 200.1 74.2 199.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M56.8 208.8Q54.1 221.6 51.4 234.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M64.2 216.8Q76.5 216.3 88.8 215.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M20.9 245.7Q1.9 264.5 -18 284.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M8.2 257.7Q-1.3 255.8 -10.8 254" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M1.4 264Q2 273.3 2.6 282.6" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M-4.5 269.6Q-14.1 267.6 -23.7 265.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M-10.4 275.2Q-9.9 284.4 -9.4 293.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M10.1 324.1Q22.2 341.4 35.5 359.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M17.7 335.6Q14.9 342.8 12.1 350.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M21.8 341.7Q29.3 342.4 36.7 343.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M25.4 347.1Q22.5 354.4 19.5 361.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M28.9 352.4Q36.3 353.2 43.6 354" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M93.1 83.7Q94.6 110.4 96.6 138.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M93.7 101.1Q86 107 78.3 112.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M93.9 110.4Q101.3 116.1 108.7 121.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M94.2 118.5Q86.4 124.4 78.5 130.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M94.5 126.6Q101.6 132.3 108.8 138" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M141.1 145Q169.9 151.3 200.7 157.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M159.7 149.6Q163.7 159.4 167.7 169.2" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M169.7 152Q177.9 145.9 186.1 139.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M178.4 154.1Q182.3 164.1 186.3 174.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M187.1 156.2Q195.3 150.3 203.5 144.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M176.7 211.5Q170.3 233.6 164 257.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M172.2 225.8Q164.4 228.4 156.5 231" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M169.8 233.4Q174.2 240.2 178.5 246.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M167.7 240.1Q159.7 242.7 151.7 245.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M165.6 246.8Q169.8 253.5 174 260.2" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M196.2 264.4Q211.6 272.8 228.2 281.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M206.1 270.1Q206.7 276.5 207.3 282.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M211.4 273.1Q217.1 270.9 222.9 268.6" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M216 275.7Q216.6 282.2 217.1 288.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M220.6 278.4Q226.3 276.2 232 274.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M94.9 165.5Q118.7 167.2 144.2 168.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M110.4 167Q114.8 174.5 119.2 182" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M118.7 167.7Q124.6 161.8 130.5 155.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M125.9 168.4Q130.3 176.1 134.7 183.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M133.2 169.1Q139.1 163.3 145 157.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M144.5 237.3Q139.1 262.6 133.8 289.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M140.6 253.7Q132 257.3 123.5 260.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M138.5 262.4Q143.8 269.6 149.1 276.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M136.6 270Q127.9 273.6 119.2 277.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M134.8 277.7Q140 284.8 145.1 291.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M173.3 312.5Q189.2 321.8 206.3 331.5" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M183.5 318.8Q183.9 325.6 184.2 332.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M189 322.2Q195.2 320 201.4 317.8" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M193.7 325.1Q194 332 194.3 338.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M198.5 328.1Q204.6 326 210.7 323.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M165.5 94.9Q169.3 118.5 173.7 143.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M167.6 110.3Q161.2 116.3 154.9 122.2" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M168.7 118.6Q175.8 123 183 127.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M169.7 125.8Q163.1 131.8 156.6 137.7" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M170.6 133Q177.6 137.4 184.6 141.9" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M237.3 144.5Q262 136.9 288.1 128.4" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M253.5 139.9Q260.8 145.6 268.1 151.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M262.1 137.5Q265.8 129.3 269.5 121.2" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M269.7 135.3Q277 141.2 284.3 147.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M277.2 133.2Q281 125.2 284.7 117.3" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M312.5 173.3Q323.2 188.3 334.8 204.1" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M319.2 183.3Q316.7 189.6 314.3 196" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M322.8 188.6Q329.3 189.1 335.9 189.6" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M325.9 193.2Q323.4 199.6 320.8 206" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M329.1 197.8Q335.5 198.4 342 199" fill="none" stroke="var(--bot-vein)" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M79.9 71.8C124.4 48.1 142.3 88.2 131.4 111.2C87.7 142.8 55.1 110.4 79.9 71.8Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M51.9 -2.3C-1.3 -13.8 12.6 -56.7 32.2 -67.1C95.8 -62.1 99.4 -15.4 51.9 -2.3Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M31.4 69.1C61.6 103.4 29.6 128.2 12 127.2C-29.9 91.7 -7.9 55.6 31.4 69.1Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M87.6 34.4C91.7 -13 134.5 -7.3 147.3 9.6C150.6 63.5 106.4 73.4 87.6 34.4Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M20.7 11.7C-24.4 44.7 -45.5 6.2 -33.9 -21.7C8.3 -60.8 44.3 -33.1 20.7 11.7Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M56.8 76.2C113.3 80 104.2 122.8 81.6 135.8C18.6 139.1 9.1 95.1 56.8 76.2Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M68.2 9.3C29.1 -22.5 57.5 -48.4 79.8 -46.5C128 -16 112.5 20.3 68.2 9.3Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M20 47.4C20.4 88.5 -14 85.6 -26 69.2C-32.1 25.3 2.2 14.7 20 47.4Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M84.5 54.3C110.4 21.8 142.2 47.4 145.6 63.4C121.3 106.8 80.9 92 84.5 54.3Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M40.1 17.1C-4.9 29.4 -10.8 -8.1 2.2 -24.7C50.7 -44.9 71.5 -11.4 40.1 17.1Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M44.3 63.7C84.1 87.4 61.2 119.7 36.2 121.2C-7.6 102.2 2.3 62.1 44.3 63.7Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M72.9 24.7C57.1 -12.1 89.7 -23.3 105.9 -14.7C129.1 23.7 101.6 47 72.9 24.7Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M29.2 33.8C12.4 64 -15 47.5 -18 29.9C-4.9 -4.2 28 2.4 29.2 33.8Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M63.4 60.1C92.8 51.6 98.9 78.3 89.8 90.8C60 104.1 44.1 80.1 63.4 60.1Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M53.1 17.9C21.3 7.5 31.4 -24.5 47.3 -31.6C82.1 -25.9 82.5 9.5 53.1 17.9Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M34.8 50.2C42.9 77.7 16.8 84.7 5.5 78C-8.1 48.8 15.3 32.7 34.8 50.2Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M71.4 42.4C80.9 15.9 102.5 25.9 106.4 39.8C100 69 75.2 67.7 71.4 42.4Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M42.7 28.9C13.5 43.2 1.2 15.8 8.5 0.5C36.7 -18.7 58.6 4 42.7 28.9Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M52.8 54.5C82.3 60.7 76.2 89.5 63.6 97.1C30.8 95.5 27.1 64.6 52.8 54.5Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M62.4 28.4C49.6 8.8 68.8 -3.5 79.6 -0.9C96.9 18.3 82 37.1 62.4 28.4Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M40 42.3C37.8 63.8 14.9 62.5 8.1 55.4C6.2 31.1 29.9 25.2 40 42.3Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M60.5 45.8C76.8 31.6 90.3 47.5 89.3 57.5C73.9 75.9 55 64.7 60.5 45.8Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M49.6 31.9C27.9 32.2 27 9.8 36.2 1.5C57.5 -2.1 65.6 20.2 49.6 31.9Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M47.8 49.2C62.2 61.2 50.3 75.4 39.9 75.3C23.6 65.4 30.7 47.2 47.8 49.2Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M59.9 36.8C58 19 76.5 16.3 84.1 23.3C88.7 40.4 70.8 48.9 59.9 36.8Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M45.6 37.6C36.7 48.8 22.9 39.7 21.4 32.7C28.6 19.1 45.4 24.5 45.6 37.6Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M53.8 43.4C70.2 39.8 74.1 56.2 69.2 63.3C52.6 69.8 43.3 54.6 53.8 43.4Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M53.3 37.1C41.9 27.2 51.9 14.7 61.1 14.8C73.3 22.4 67.1 38.3 53.3 37.1Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M50.7 40.5C51.1 50.7 39.2 52.5 35 49.4C32.5 39 44.2 33.8 50.7 40.5Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M52 40C58.5 28.8 70.4 35.2 71.8 42.7C67.2 54.5 53.1 51.8 52 40Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M200.6 88.7C232.3 107 214.7 130.2 196.8 131.4C160.4 115.9 167.5 86.6 200.6 88.7Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M237.4 52.5C231.2 19.6 261.8 15 274.1 24.7C286.3 59.7 257.7 75.2 237.4 52.5Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M179.5 59.4C166.1 87.2 143.4 73.8 140.2 60.9C151.1 27.2 178.2 31.5 179.5 59.4Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M221.4 89.5C249.6 80.9 254.7 105.3 245.3 117.3C217 130.1 202.5 108.5 221.4 89.5Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M212.5 44.3C176.5 28.5 192.5 1.5 209.5 -2.3C252.3 10.3 248.2 42.5 212.5 44.3Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M189.1 79.6C200.2 106.4 176.2 114.5 163.2 106.5C147.9 80.3 168.3 63.3 189.1 79.6Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M228.7 63.3C232.2 31.3 260.8 36 269.2 48.6C270.4 84.2 240.6 90.1 228.7 63.3Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M192.9 54.3C168.9 74.3 154.3 52.8 157.8 38.7C181.4 13.2 203.8 28.1 192.9 54.3Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M207.7 87.3C233.7 94.7 226.4 120.3 213.7 126.3C185.4 122.8 184.1 94.7 207.7 87.3Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M219.4 53.8C204 30.3 226.2 17.1 239.9 21.7C259.4 44.1 242.4 65 219.4 53.8Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M188.7 66.5C183.2 92 160.5 85.9 154.8 75.6C156.7 46.4 181.2 44 188.7 66.5Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M222.1 74.2C240.4 55.7 257.6 73.4 257.8 84.4C240.2 109 217 97.3 222.1 74.2Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M202.1 51.2C179.5 53.7 176.8 31.3 185 22.3C207.6 16.1 217.8 37.7 202.1 51.2Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M198.3 80.5C210.8 94.8 196.7 107.3 187.2 106.3C171.6 93.3 181.6 76 198.3 80.5Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M224.5 62.1C224 39.6 242 41.3 248.5 50.6C252 74.3 234.1 80.1 224.5 62.1Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M195.8 59.6C179.9 77.7 164.3 62.6 164.8 50.7C179.1 28.9 199.9 38 195.8 59.6Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M214.2 77.4C232.2 72.8 236.1 90 230.9 97.5C212.4 105.2 202.5 89.6 214.2 77.4Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M211.1 56.4C196.5 46.7 206 31.8 214.1 30C231.9 38 227.2 56.2 211.1 56.4Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M197.3 70.9C199.5 86.3 183 89.5 176.4 84.6C171.4 69 187.2 60.7 197.3 70.9Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M219.1 68.4C225.8 55.8 239.2 62.4 241.4 68.6C236.3 83.9 220.7 81.4 219.1 68.4Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M201.4 58.6C187.7 65.2 180.4 51.2 183.1 43.8C196.4 34.5 208.2 46.4 201.4 58.6Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M208.1 73.9C219.2 77.2 216.4 89.6 211.7 92.7C199 91.3 198.2 77.8 208.1 73.9Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M213.4 60.8C207 48.9 219.1 41.8 225.7 43.8C234.5 55.2 224.4 66.2 213.4 60.8Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M202.7 66.4C200.1 81.4 185.6 78.7 181.5 70.6C182 56 197.3 53.7 202.7 66.4Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M211.9 69.3C222.4 62.3 230.3 73.2 229.2 79.4C219.3 88.7 207.9 80.1 211.9 69.3Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M207.9 62.4C197.3 59.6 199.9 48.5 205.6 45.7C216.5 46.9 217.4 58.9 207.9 62.4Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M206.3 68.4C211.6 75.4 204.4 81.6 199.9 81.2C193.1 74.9 198.5 66.3 206.3 68.4Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M209.8 65.6C210.6 55.8 221.5 55.8 225.2 60.5C226 69.9 214.8 73.1 209.8 65.6Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M207.2 65.4C200 70.7 194.4 63.5 195.6 58.4C201.8 52.1 209.8 57.6 207.2 65.4Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M208 66C215.7 66.4 216 75.1 212.8 78.1C205.1 79.1 202.2 70.2 208 66Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M71.8 253.8C109 246 111.1 275.6 100.1 287.7C58.9 301.9 44.5 274.8 71.8 253.8Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M68.8 198.4C32.9 172.6 56.4 148.8 73.6 148.2C119.7 173.5 108.1 205.8 68.8 198.4Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M31.7 232C35.2 260.8 8.9 262.8 -1.5 252.5C-9.6 222.6 15.6 211.1 31.7 232Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M78.4 232.8C100.7 208 123.2 229.5 122.9 245.4C102.9 275.8 73 262.5 78.4 232.8Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M46.2 201.8C17 210.4 10.4 183.5 19.4 170.8C48.9 157.4 65.2 181.5 46.2 201.8Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M49.1 241.4C79.7 264.6 58 288.1 37.9 287C3.1 267 14.7 235.8 49.1 241.4Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M82.6 209C73.8 177.3 100.6 172.8 112.8 182.7C126.8 216 103 231 82.6 209Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M37.9 214.9C23 238 3.4 223.6 2.2 209.8C14.5 183.3 39.1 190.1 37.9 214.9Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M73.7 237.7C102.5 219.2 114.8 244.1 107.6 260.3C80 283.4 58.1 264.6 73.7 237.7Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M59.4 204C32.8 195.2 41.9 171.3 55.6 166.4C84.7 171.7 84.3 198.5 59.4 204Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M38.8 234.4C47 259 23.8 266.1 13.4 260.5C0.1 234.6 20.6 219.3 38.8 234.4Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M78.8 219.8C82.8 194.1 108.3 198 115.5 208.4C115.5 236.7 88.7 241.3 78.8 219.8Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M45.5 213.1C23.2 232.4 7.2 211.5 10.1 196.9C30.8 173.2 54.3 187.7 45.5 213.1Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M61.1 237.6C83.1 239 81.5 260.4 72.8 267.3C49.2 269.3 43.5 247.4 61.1 237.6Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M70.2 209.5C57.5 189.1 76.5 178.4 87.4 182C104.5 202.2 89.6 219.5 70.2 209.5Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M46.5 225.4C47.8 250.8 25.4 250.5 16.6 239.2C12 214.1 34 205.9 46.5 225.4Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M70.5 231.1C88.5 215.4 100.4 231.8 97.9 243.1C80.8 262.6 62.9 251.4 70.5 231.1Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M54.5 209.2C35.5 209.5 35.7 191.9 43.5 185.5C63.1 182.3 69.1 199.9 54.5 209.2Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M52.4 234.1C65.6 244.6 55.5 256.2 46.5 256.1C31.5 247.2 37.3 232.1 52.4 234.1Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M67.7 218.6C66.2 201.8 82.1 200.7 88.4 207.5C92.4 224.2 77 230.8 67.7 218.6Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M49.3 216.6C37.7 227.6 26.9 216.1 27.7 207.8C38 194.6 52.6 202.5 49.3 216.6Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M61.4 230.5C76.9 228.3 78.2 242.5 72.6 248.3C56.7 252.8 50.3 239.4 61.4 230.5Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M59.6 215.5C48.5 208.9 55 196.3 61.3 194.4C74.2 199.3 71.4 214.2 59.6 215.5Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M52.9 224.9C56.7 239.2 42.7 242.7 35.9 237.3C30.3 223.9 42.9 215.7 52.9 224.9Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M63.4 223.7C70.3 213.4 81.7 220.2 82.7 227.3C77.6 238.4 64 235 63.4 223.7Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M55.4 219.1C44.8 224.4 39.9 214.2 42.3 208.6C52.6 201.4 61 209.8 55.4 219.1Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M57.9 224.8C69.2 228.8 65.5 241.1 58.9 243.8C47.4 241.7 47.3 228.1 57.9 224.8Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M59.4 220.5C55.8 213.3 63.8 208 68.5 209.3C73.2 215.6 66.4 223.3 59.4 220.5Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M57.1 221.9C53.6 229.1 45.3 225.8 43.9 221.4C46.2 213.7 55.6 214.6 57.1 221.9Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M58 222C66.6 217.9 71 226.7 68.8 231.6C60.9 236.9 53.7 229.6 58 222Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M168.6 204.8C175.6 230.9 154.4 233.7 145.6 227C133.6 197.9 152.4 186.4 168.6 204.8Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M202.2 202.5C215.7 182.5 230.8 195.3 231.8 205C219 230.5 199.5 224.3 202.2 202.5Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M176.9 185.1C156.3 195.8 149.4 178.1 154.1 168.5C175.3 153.7 189.1 167.9 176.9 185.1Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M180.9 210.4C197.8 220.7 188 232.7 177.4 232.7C158.8 224.2 163 208.7 180.9 210.4Z" fill="var(--bot-b1)" stroke="var(--bot-e1)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M196.7 188C189.2 171.9 202.6 167.6 209.3 171.1C220.2 188.3 209.2 197.9 196.7 188Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M172 192.3C162.6 211 148.6 201.8 146.8 193.5C154.8 170.4 171.9 173.4 172 192.3Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M193.9 206C211.8 198 218.6 214.8 214.7 223.2C196.4 234.9 183.7 220.7 193.9 206Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M184.4 181.9C166 179.3 168.7 161.7 176.3 156.7C196.4 156.4 199.8 174.9 184.4 181.9Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M179 205.4C188.3 216.7 177.6 224.8 171.8 224.4C158.9 212.9 166.5 201 179 205.4Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M198.3 193.4C198.9 177.5 213.6 178.6 218.2 183.8C220.2 202 205.3 206.2 198.3 193.4Z" fill="var(--bot-b3)" stroke="var(--bot-e3)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M178.2 190.2C166.7 200 158.7 189.2 160.5 181.6C171 169.9 182.9 177.4 178.2 190.2Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M188.1 204.9C203.1 204.9 202.3 217.9 195.8 222.6C180.4 224.7 176.3 211.7 188.1 204.9Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M190.1 188.3C181.1 179.9 189.3 171 195 170.8C206.4 178.4 201.1 190.1 190.1 188.3Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M175.4 197.6C174.3 210.8 162.8 209.1 159.2 203.4C158.4 189.3 170.3 186.7 175.4 197.6Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M192.6 199.9C203.1 188.8 211.6 198.4 210.3 206.5C201.1 219.2 189.1 213.3 192.6 199.9Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M184.2 186.6C171.6 185.4 172.4 172.2 177.5 168.1C190.9 167.2 194.3 180.8 184.2 186.6Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M182.3 202.6C192.1 211.7 183.5 220.1 176.7 219.5C165.1 211.5 170.5 200 182.3 202.6Z" fill="var(--bot-b5)" stroke="var(--bot-e5)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M192.5 192.3C189.7 181.3 200.7 178.4 205.8 181.9C210.4 192.7 200.2 199.2 192.5 192.3Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M178.9 194.7C174.8 204.2 166.7 200 165.5 194.9C168.5 184.3 178 185.4 178.9 194.7Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M187.8 200.9C197.8 199.9 198.7 209.6 194.5 213.6C184.8 216 180.6 206.6 187.8 200.9Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M187.8 190.4C178.6 184.7 184.2 176 189.9 175.3C200.1 179.7 197.5 190.3 187.8 190.4Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M182.4 199.3C186.4 207.7 177.6 212.5 173 210.9C167.3 202.9 174.8 195.3 182.4 199.3Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M190.4 197.3C195.3 189.5 203.3 194.3 204.2 199.1C200.4 208 190.7 205.8 190.4 197.3Z" fill="var(--bot-b7)" stroke="var(--bot-e7)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M183.3 192.9C176.9 196.1 173.8 189.9 175.5 186.1C181.3 182.1 186.6 187.3 183.3 192.9Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M185.6 198.8C192.3 202.2 189.1 210.3 185 211.7C177.9 209.6 178.8 200.4 185.6 198.8Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M188 194C184 187.4 190.3 183.8 194.1 185.2C199.3 191.6 194.2 197.3 188 194Z" fill="var(--bot-b8)" stroke="var(--bot-e8)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M184.4 196C182.4 201.6 175.6 199.9 174 197C174.9 191.1 182.4 190.9 184.4 196Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M186.9 197C192.1 194.6 195.1 200.1 194 203.1C189.3 206.4 184.5 201.7 186.9 197Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M185.8 195.3C180 195 180.2 189.1 182.8 187C188.6 186.4 190.4 192.5 185.8 195.3Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M186 196C188.5 199.2 185.1 202.7 182.6 202.5C179.7 199.9 182.3 195.4 186 196Z" fill="var(--bot-b9)" stroke="var(--bot-e9)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M132 118C149.9 113.2 152.1 128 143.8 136C127.5 142.4 119.4 129.2 132 118Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M132 118C143.3 127.1 134.9 135.2 126.1 133.7C114.5 126.3 119.2 115.2 132 118Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M132 118C131.5 128.2 123.4 126.8 120.6 121.1C120 111.5 128.3 109.5 132 118Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M258 148C265.8 161.2 254.5 166.1 246.3 161.4C237.6 149.8 246.3 140.5 258 148Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M258 148C253.2 158.9 245 154.1 244.2 146.8C247.5 136 257.4 137.2 258 148Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M258 148C249.8 149.8 249.1 143.1 253 139.6C260.5 137 263.9 143.2 258 148Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M104 300C113.4 286.6 123.2 295.3 122.2 305.4C114.8 319 101.9 314.7 104 300Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M104 300C116.8 299.8 115.8 310 108.9 314C97 315.6 93.8 305.4 104 300Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M104 300C109.4 307.2 103.2 310.8 98.1 308.6C92.2 302.4 96.7 296.4 104 300Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M300 44C313.4 48.7 308.4 59 299.7 60.5C286.6 57.5 287.2 45.6 300 44Z" fill="var(--bot-b2)" stroke="var(--bot-e2)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M300 44C303.2 54.6 294.4 56.1 289.5 51.4C285.4 41.7 293.1 36.7 300 44Z" fill="var(--bot-b4)" stroke="var(--bot-e4)" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M300 44C295.3 50.2 290.8 45.8 291.4 41C295.2 34.7 301.3 37 300 44Z" fill="var(--bot-b6)" stroke="var(--bot-e6)" strokeWidth=".9" strokeLinejoin="round" />
        </g>
      </defs>
    </svg>
  );
}

/** Reflected rather than rotated: a rotated spray reads as the same object
 *  turned around, and the repetition becomes obvious. */
const MIRROR: Record<Corner, string | undefined> = {
  tl: undefined,
  tr: "translate(460,0) scale(-1,1)",
  bl: "translate(0,460) scale(1,-1)",
  br: "translate(460,460) scale(-1,-1)",
};

export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * One element per corner, each pinned by CSS to the corner it belongs to.
 * Drawing several corners inside a single box seemed tidier and put both
 * sprays in the same quarter of the page, where they read as one shapeless
 * mass rather than as a frame.
 *
 * Decorative, so `aria-hidden` and no title — a guest using a screen reader
 * gains nothing from being told there are flowers in the corner.
 */
export function Botanical({ corners = ["tl", "br"] }: { corners?: Corner[] }) {
  return (
    <>
      {corners.map(c => (
        <svg key={c} className={`bot bot-${c}`} viewBox="0 0 460 460"
             aria-hidden="true" focusable="false">
          <use href="#bot-spray" transform={MIRROR[c]} />
        </svg>
      ))}
    </>
  );
}
