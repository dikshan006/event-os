/**
 * The botanical corner spray.
 *
 * Drawn rather than photographed, for two reasons. A painted rose is a raster
 * asset, and a raster asset has one fixed colour — it would be a foreign object
 * in a system where every other surface is mixed from the active palette. And
 * at the size this is used, a photograph of flowers would have to be either
 * large enough to matter (heavy) or small enough to be free (mush).
 *
 * The geometry is generated, not eyeballed. Each bloom is a set of overlapping
 * cupped petals placed on a golden-angle spiral, drawn outermost-first and
 * lightening toward the centre, which is roughly how a garden rose assembles.
 * An earlier version used concentric lobed rings — mathematically tidier, and
 * it looked like a pinwheel.
 *
 * Every fill is a theme variable. Nothing here is rose-coloured by nature: a
 * template that opts into the ornament gets it mixed from its own accent, so
 * this same spray is dusty rose on Midnight Bloom and would be sage or wine
 * elsewhere without a line changing.
 *
 * One element per corner, each pinned by CSS to the corner it belongs to.
 * Drawing several corners inside a single box seemed tidier and put both
 * sprays in the same quarter of the page, where they read as one shapeless
 * mass rather than as a frame.
 *
 * Decorative, so `aria-hidden` and no title — a guest using a screen reader
 * gains nothing from being told there are flowers in the corner.
 */
const SPRAY = (
  <>
      <path d="M-34 -20C74 34 178 26 340 4" fill="none" stroke="var(--bot-stem)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M-20 -34C34 74 26 178 4 340" fill="none" stroke="var(--bot-stem)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6 6C104 74 150 150 172 262" fill="none" stroke="var(--bot-stem)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M-10 60C70 120 130 190 150 300" fill="none" stroke="var(--bot-stem)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M50.5 10.4C77.2 10.9 87.4 36.1 85.2 57C57.6 54.3 40.9 33.3 50.5 10.4Z" fill="var(--bot-leaf)" />
      <path d="M104.6 18.8C102.8 -4.1 123.6 -15 141.6 -14.9C141.5 8.9 125 25 104.6 18.8Z" fill="var(--bot-leaf)" />
      <path d="M162 20.8C189.2 14.6 205.5 37.5 208.2 59.2C179.7 63.3 157.7 46.3 162 20.8Z" fill="var(--bot-leaf)" />
      <path d="M224.3 17.5C219.2 -2.2 235.5 -14.8 251.3 -17.4C254.9 3.4 243.1 19.9 224.3 17.5Z" fill="var(--bot-leaf)" />
      <path d="M284.1 11.2C299.4 5.7 309.9 17.7 312.4 30.1C296.3 34.5 282.9 26.3 284.1 11.2Z" fill="var(--bot-leaf)" />
      <path d="M10.4 50.5C35.1 40.3 54.5 59.3 60.8 79.4C34.5 87.9 10.8 75.4 10.4 50.5Z" fill="var(--bot-leaf)" />
      <path d="M18.8 104.6C25.3 126.5 7.4 141.6 -10.3 145.4C-15.2 122.1 -2.5 102.8 18.8 104.6Z" fill="var(--bot-leaf)" />
      <path d="M20.8 162C48.3 157.5 63.2 181.4 64.4 203.3C35.7 205.6 14.9 187.2 20.8 162Z" fill="var(--bot-leaf)" />
      <path d="M17.5 224.3C19.9 244.5 2.1 254.8 -13.9 255.3C-14.8 234.2 -0.8 219.5 17.5 224.3Z" fill="var(--bot-leaf)" />
      <path d="M11.2 284.1C27.5 282.9 34.3 297.3 33.4 310C16.7 309.8 6 298.3 11.2 284.1Z" fill="var(--bot-leaf)" />
      <path d="M85 74.7C102.4 87.3 97.3 108.3 85.9 120.7C69.1 106.2 67.9 85 85 74.7Z" fill="var(--bot-leaf)" />
      <path d="M123.7 127.6C141.3 112.8 162.2 123.3 172.7 138C153.3 151.8 130.5 147.8 123.7 127.6Z" fill="var(--bot-leaf)" />
      <path d="M149.5 181.4C159.9 197.2 149.2 212.6 136 219.2C126.6 202.1 132.2 184.5 149.5 181.4Z" fill="var(--bot-leaf)" />
      <path d="M164.7 229.5C177.3 223.7 187.7 233.3 191.2 243.6C177.6 248.5 165.1 242.4 164.7 229.5Z" fill="var(--bot-leaf)" />
      <path d="M75.1 138.7C87.1 124.2 105 129.9 115.1 140.6C101.6 154.5 83.1 154.4 75.1 138.7Z" fill="var(--bot-leaf)" />
      <path d="M116.5 200.5C129.4 216.2 119.8 234.5 106.5 243.4C94.6 226.1 98.5 206.2 116.5 200.5Z" fill="var(--bot-leaf)" />
      <path d="M141.1 262.1C154.6 255.3 165.9 265.2 169.8 276.3C155.4 282.2 141.9 276.1 141.1 262.1Z" fill="var(--bot-leaf)" />
      <path d="M50.5 10.4Q66.3 31.3 83.3 54.1" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M104.6 18.8Q121.1 3.5 139.3 -13" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M162 20.8Q182.9 37.9 205.6 56.7" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M224.3 17.5Q236.4 1.7 249.6 -15.4" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M284.1 11.2Q296.9 19.7 310.8 28.9" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M10.4 50.5Q33.2 63.4 57.9 77.5" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M18.8 104.6Q5.8 123 -8.4 143" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M20.8 162Q40.5 180.4 62 200.6" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M17.5 224.3Q3.4 238.3 -11.9 253.5" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M11.2 284.1Q21.3 295.7 32.2 308.3" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M85 74.7Q85.6 95.4 86 118" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M123.7 127.6Q145.8 132.1 169.8 137.2" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M149.5 181.4Q143.5 198.5 136.9 217" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M164.7 229.5Q176.6 235.7 189.6 242.7" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M75.1 138.7Q93.1 139.4 112.8 140.4" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M116.5 200.5Q112.2 219.9 107.3 240.9" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M141.1 262.1Q154.1 268.4 168.2 275.4" fill="none" stroke="var(--bot-rib)" strokeWidth=".9" strokeLinecap="round" />
      <path d="M39.6 63.8C41.7 99.2 11.4 98.9 1.6 88.3C-6.6 48 21.1 37.1 39.6 63.8Z" fill="var(--bot-1)" />
      <path d="M86.2 66.3C107.8 39.9 129.4 59.9 129.4 73.9C109.1 107.6 82.1 97.2 86.2 66.3Z" fill="var(--bot-1)" />
      <path d="M55 34.5C22.6 39.1 20.2 10.7 29.3 0.6C65.4 -10 77.9 15.2 55 34.5Z" fill="var(--bot-1)" />
      <path d="M56.5 76.8C82.3 94.6 65.5 116.6 52.4 117.8C20.2 102 27.8 75.8 56.5 76.8Z" fill="var(--bot-1)" />
      <path d="M82.6 46.3C76 17 102.3 12.2 112.4 19.9C124.8 51.7 102.2 65.5 82.6 46.3Z" fill="var(--bot-2)" />
      <path d="M44.9 50.9C30.6 75.8 8.6 62.1 6.4 50C18.3 19.8 43.3 24.7 44.9 50.9Z" fill="var(--bot-2)" />
      <path d="M74.1 71.7C100.1 63.5 106.9 87.5 100.7 97.5C72.9 111 58.3 91.2 74.1 71.7Z" fill="var(--bot-2)" />
      <path d="M67 38.8C43.5 27.7 54.2 6.2 65.1 3.1C93.1 11.5 90.6 35.1 67 38.8Z" fill="var(--bot-3)" />
      <path d="M51.1 66C60.4 88.9 38.9 97.2 29.1 92.3C15 68.5 32.2 53.5 51.1 66Z" fill="var(--bot-3)" />
      <path d="M79.1 57.3C87.4 35.3 108 43.3 111.7 53.1C106.3 78.6 84.4 78.1 79.1 57.3Z" fill="var(--bot-3)" />
      <path d="M54.5 45.7C34.7 55.7 25.2 36.8 29 27.5C48.9 13.2 64.1 27.7 54.5 45.7Z" fill="var(--bot-4)" />
      <path d="M64 68.8C84.2 74.6 78.7 94 70.1 98.1C47.2 95.3 46 75.3 64 68.8Z" fill="var(--bot-4)" />
      <path d="M71.8 47.4C61.6 30.6 77.9 20.4 86.6 23C100.5 39.5 88.6 54.3 71.8 47.4Z" fill="var(--bot-4)" />
      <path d="M53.6 57C49.9 75 32 71.8 27.6 64.4C28.4 44.3 46.3 41.6 53.6 57Z" fill="var(--bot-5)" />
      <path d="M71.4 61.6C85.4 51.5 95.8 65.2 94.2 73.1C81 86.4 66.8 76.8 71.4 61.6Z" fill="var(--bot-5)" />
      <path d="M62.5 48C46.6 46.1 48 30 54.2 25.5C71.5 24.7 75.2 40.4 62.5 48Z" fill="var(--bot-5)" />
      <path d="M60.3 61.9C69.9 73.2 58.8 83.5 51.7 82.7C39.5 72.4 46.9 59.2 60.3 61.9Z" fill="var(--bot-6)" />
      <path d="M69.6 54.5C70.2 40.8 84.3 40.7 88.6 45.7C90.4 60.2 77.1 64.6 69.6 54.5Z" fill="var(--bot-6)" />
      <path d="M59.9 53.9C51 62.7 41.3 54 41.4 47.9C49.1 37 61 42.4 59.9 53.9Z" fill="var(--bot-6)" />
      <path d="M65.2 59.3C76.6 58.8 77.8 70.8 73.9 74.8C62.1 77.3 57.4 66.3 65.2 59.3Z" fill="var(--bot-7)" />
      <path d="M64.9 53.8C57.1 47.2 63.5 38.4 68.7 38.1C78 43.6 74.4 53.9 64.9 53.8Z" fill="var(--bot-7)" />
      <path d="M62.9 56.5C64 65.6 54.4 67.5 50.8 64.6C48 55.5 56.7 50.8 62.9 56.5Z" fill="var(--bot-7)" />
      <path d="M64 56C68.7 49.5 76.2 54 76.9 58.1C73.2 65.6 64.7 63.4 64 56Z" fill="var(--bot-7)" />
      <path d="M174.8 52.6C155.6 63.8 147.2 46.9 150.3 38.4C170.4 22.4 184.4 34.7 174.8 52.6Z" fill="var(--bot-1)" />
      <path d="M186.6 79.3C207.4 83.8 202.4 101.5 194.6 105.5C170.1 103.8 168.2 85.8 186.6 79.3Z" fill="var(--bot-1)" />
      <path d="M195.4 52.9C183.7 36.2 198.8 26.7 207 29C223.2 46.1 212.7 60.2 195.4 52.9Z" fill="var(--bot-1)" />
      <path d="M172.3 65.7C169.7 85.1 152.7 82 148.3 75.1C148 52.7 164.7 49.4 172.3 65.7Z" fill="var(--bot-1)" />
      <path d="M196.7 71.6C211.1 59.6 221.2 72.9 219.9 80.7C205.6 96.6 191.6 88 196.7 71.6Z" fill="var(--bot-2)" />
      <path d="M183.4 51.9C165.5 51 166.9 34.9 173 30.2C193.2 28.3 197.6 43.6 183.4 51.9Z" fill="var(--bot-2)" />
      <path d="M180.1 74C192.1 86.3 180.6 96.8 173.3 96.2C157.9 84.6 164.8 70.8 180.1 74Z" fill="var(--bot-2)" />
      <path d="M196.4 60.8C196 44.5 210.9 44.4 215.8 49.6C219 67.6 205.2 72.9 196.4 60.8Z" fill="var(--bot-3)" />
      <path d="M176.8 59.6C166.7 71.3 155.9 61.7 155.9 54.9C165.1 40.3 178.4 45.5 176.8 59.6Z" fill="var(--bot-3)" />
      <path d="M189.6 72.8C204.1 71.2 205.6 84.9 201.1 89.7C185.4 94 179.5 81.6 189.6 72.8Z" fill="var(--bot-3)" />
      <path d="M189 55.8C177.9 47.6 185.7 37 191.9 36.4C205.6 43.5 201.8 56 189 55.8Z" fill="var(--bot-4)" />
      <path d="M178.9 67.7C181.4 80.5 169 83 164.3 79.3C159.4 65.8 170.1 59.4 178.9 67.7Z" fill="var(--bot-4)" />
      <path d="M193 65.9C199.5 55.5 209.8 61.6 210.8 67.2C205.6 79.7 193.9 77.2 193 65.9Z" fill="var(--bot-4)" />
      <path d="M182.5 58.5C171.4 61.5 168.1 50.7 171 46.1C182.4 40.9 189 50.1 182.5 58.5Z" fill="var(--bot-5)" />
      <path d="M185 69.7C194.5 74.7 189.9 84.3 185 85.7C173.9 82.1 175.2 71.5 185 69.7Z" fill="var(--bot-5)" />
      <path d="M190.1 60.9C186.6 51.5 196 47.7 200.2 49.9C205.5 59.3 197.9 65.8 190.1 60.9Z" fill="var(--bot-5)" />
      <path d="M181.7 63.6C178.1 72.2 169.2 68.9 167.6 64.7C169.9 55 179.4 55.4 181.7 63.6Z" fill="var(--bot-6)" />
      <path d="M188.4 66.7C196.2 63.1 200.3 70.9 198.7 74.8C191.2 79.9 184.9 73.7 188.4 66.7Z" fill="var(--bot-6)" />
      <path d="M186 61.1C178.6 58.7 180.6 50.8 184.1 49.1C192.4 50.4 192.8 58.5 186 61.1Z" fill="var(--bot-6)" />
      <path d="M184.5 65.6C188 71.8 181.7 75.9 178.3 74.9C173.6 69 178.4 63.2 184.5 65.6Z" fill="var(--bot-7)" />
      <path d="M187.4 63.9C188.9 57.6 195.7 58.8 197.3 61.5C196.9 68.3 190.1 69.2 187.4 63.9Z" fill="var(--bot-7)" />
      <path d="M185.4 63.6C180.7 66.7 176.9 61.9 177.5 59.1C181.8 55 186.8 58.5 185.4 63.6Z" fill="var(--bot-7)" />
      <path d="M186 64C191 64.8 190.6 70.2 188.5 71.8C183.3 71.8 182.1 66.5 186 64Z" fill="var(--bot-7)" />
      <path d="M38.4 192.6C27.8 215 9.3 204.7 6.8 194.9C15.3 167.4 36 170 38.4 192.6Z" fill="var(--bot-1)" />
      <path d="M66.2 209.8C88.3 200.8 94.9 220.3 90.2 228.9C66.4 242.8 53.3 227.4 66.2 209.8Z" fill="var(--bot-1)" />
      <path d="M57.7 179.8C36.3 171.7 44.3 153.4 53.3 150.3C79 155.9 78.2 175.6 57.7 179.8Z" fill="var(--bot-1)" />
      <path d="M44.4 206.3C54.3 225.9 36.6 233.7 28.1 230.1C13.7 209.6 27.1 196 44.4 206.3Z" fill="var(--bot-1)" />
      <path d="M70.7 196.3C76.4 176.1 94.2 181.9 97.9 190.1C94.8 213.8 76.3 214.6 70.7 196.3Z" fill="var(--bot-2)" />
      <path d="M46 186.5C28.8 196.9 19.9 181.2 22.6 173C40.1 158.4 53.8 169.8 46 186.5Z" fill="var(--bot-2)" />
      <path d="M56.9 209C75.7 212.7 71.8 229.8 64.6 233.8C43 232.8 40.7 215.7 56.9 209Z" fill="var(--bot-2)" />
      <path d="M63.6 186.4C52.9 171.7 66.7 162.1 74.4 163.9C88.8 178.5 79.3 192.1 63.6 186.4Z" fill="var(--bot-3)" />
      <path d="M44.7 197.8C42.7 215 26.7 212.9 22.4 206.6C21.7 187.2 37.3 183.8 44.7 197.8Z" fill="var(--bot-3)" />
      <path d="M64.8 201.8C77.3 191.1 87.3 202.9 86.3 210.2C74.4 224.1 61.1 216.4 64.8 201.8Z" fill="var(--bot-3)" />
      <path d="M53.6 186.5C38.1 186 38.6 171.2 44 166.7C61.1 164.7 65.5 178.7 53.6 186.5Z" fill="var(--bot-4)" />
      <path d="M51.7 203.9C62.1 214.2 52.3 224.3 45.6 223.9C32.5 214.5 38.4 201.8 51.7 203.9Z" fill="var(--bot-4)" />
      <path d="M63.7 193.3C63.1 179.6 76.5 178.8 80.9 183.3C84 198.1 71.7 203.2 63.7 193.3Z" fill="var(--bot-4)" />
      <path d="M49.3 193.1C40.9 203 31 195 30.8 189C38.1 176.9 50 181.2 49.3 193.1Z" fill="var(--bot-5)" />
      <path d="M58.7 201.9C70.6 200.4 72.5 212.3 68.8 216.7C56.2 220.4 50.7 209.7 58.7 201.9Z" fill="var(--bot-5)" />
      <path d="M57.8 190.6C48.7 184.1 54.9 174.6 60.2 174C71.1 179.3 68.1 190.2 57.8 190.6Z" fill="var(--bot-5)" />
      <path d="M51.7 198.4C53.9 208.6 43.6 211.2 39.5 208.3C35.5 197.9 44.4 192.2 51.7 198.4Z" fill="var(--bot-6)" />
      <path d="M60 196.9C64.9 188.7 73.6 193.4 74.6 197.9C70.8 207.5 61.2 205.7 60 196.9Z" fill="var(--bot-6)" />
      <path d="M54.2 193.3C45.7 195.8 42.7 187.2 44.9 183.4C53.2 179.4 58.8 186.6 54.2 193.3Z" fill="var(--bot-6)" />
      <path d="M55.6 198.4C62.8 202 59.5 209.7 55.8 210.9C47.7 208.5 48.5 200.1 55.6 198.4Z" fill="var(--bot-7)" />
      <path d="M57.3 195C54.7 188.3 61.6 185 64.9 186.6C68.7 193.1 63.1 198.2 57.3 195Z" fill="var(--bot-7)" />
      <path d="M55.2 196C52.8 201.9 46.2 199.8 45 196.8C46.4 190.3 53.3 190.3 55.2 196Z" fill="var(--bot-7)" />
      <path d="M56 196C61.1 193.6 64.2 198.9 63.2 201.6C58.4 205 53.9 200.8 56 196Z" fill="var(--bot-7)" />
      <path d="M150.2 167.8C136.5 164 140.6 152.5 145.8 150.2C162.2 152.3 162.7 164.2 150.2 167.8Z" fill="var(--bot-1)" />
      <path d="M143.2 185.1C150.4 196.6 140.1 202.2 134.8 200.5C124.6 188.4 132.1 179.5 143.2 185.1Z" fill="var(--bot-1)" />
      <path d="M159.3 177.4C161.7 164.5 172.8 167.3 175.5 172C174.8 187.1 163.7 188.5 159.3 177.4Z" fill="var(--bot-1)" />
      <path d="M143.1 172.5C133 179.9 126.9 170.7 128.1 165.6C138.3 155.5 147.2 161.7 143.1 172.5Z" fill="var(--bot-1)" />
      <path d="M151.3 186.3C163.2 187.6 161.6 198.2 157.4 201C143.8 201.5 141.5 191.2 151.3 186.3Z" fill="var(--bot-2)" />
      <path d="M154.4 171.4C146.8 162.8 154.9 156.2 159.7 157C169.6 165.4 164.5 174.2 154.4 171.4Z" fill="var(--bot-2)" />
      <path d="M142.8 179.8C142.5 190.7 132.5 190.2 129.5 186.5C128 174.3 137.4 171.3 142.8 179.8Z" fill="var(--bot-2)" />
      <path d="M156.1 181.3C163.4 173.9 170.1 180.7 169.9 185.3C163.1 194.8 154.5 190.8 156.1 181.3Z" fill="var(--bot-3)" />
      <path d="M147.9 171.8C138 172.4 137.6 163.2 140.8 160.1C151.6 157.8 155.1 166.3 147.9 171.8Z" fill="var(--bot-3)" />
      <path d="M147.6 183.5C154.8 189.5 149.1 196.3 144.9 196.4C136 191.1 139 182.9 147.6 183.5Z" fill="var(--bot-3)" />
      <path d="M155.1 175.7C153.9 167 162.3 165.8 165.3 168.4C168.1 177.8 160.7 181.7 155.1 175.7Z" fill="var(--bot-4)" />
      <path d="M145.1 176.4C140.4 183.2 133.7 178.7 133.3 174.9C137.3 166.6 145 168.7 145.1 176.4Z" fill="var(--bot-4)" />
      <path d="M152.2 182.1C159.9 180.4 161.7 187.9 159.6 190.8C151.5 194 147.5 187.5 152.2 182.1Z" fill="var(--bot-4)" />
      <path d="M151 173.9C144.6 170.2 148.2 163.8 151.5 163.1C159 166 157.7 173.2 151 173.9Z" fill="var(--bot-5)" />
      <path d="M146.9 180.1C148.9 186.7 142.4 188.9 139.6 187.2C136.3 180.5 141.8 176.4 146.9 180.1Z" fill="var(--bot-5)" />
      <path d="M153.2 178.5C156 172.7 161.9 175.3 162.8 178.2C160.9 184.9 154.5 184.3 153.2 178.5Z" fill="var(--bot-5)" />
      <path d="M148.2 175.8C142.7 178 140.3 172.5 141.5 169.9C147 166.6 151 171.1 148.2 175.8Z" fill="var(--bot-6)" />
      <path d="M149.9 180.3C155 182.3 153.2 187.7 150.7 188.7C145 187.5 145 181.8 149.9 180.3Z" fill="var(--bot-6)" />
      <path d="M151.3 176.7C149.1 172.2 153.7 169.6 156 170.5C159.1 174.8 155.5 178.6 151.3 176.7Z" fill="var(--bot-6)" />
      <path d="M148.6 178C147.3 182.4 142.6 181.3 141.6 179.3C142.2 174.5 147 174.2 148.6 178Z" fill="var(--bot-7)" />
      <path d="M150.7 178.6C154.2 176.5 156.7 180.1 156.2 182.1C152.9 184.9 149.5 182.2 150.7 178.6Z" fill="var(--bot-7)" />
      <path d="M149.9 177.5C146.4 176.8 146.9 172.9 148.5 171.9C152.3 172 152.9 175.9 149.9 177.5Z" fill="var(--bot-7)" />
      <path d="M150 178C151.9 180.6 149.2 182.9 147.5 182.6C145.2 180.2 147.1 177.3 150 178Z" fill="var(--bot-7)" />
      <path d="M118.6 115C114.1 104.3 123.4 101.1 127.6 103.3C134.5 114.8 127.2 121.1 118.6 115Z" fill="var(--bot-1)" />
      <path d="M104.1 119.3C100.4 129.7 91.6 125.9 90 121.7C92.6 109.1 102 109.3 104.1 119.3Z" fill="var(--bot-1)" />
      <path d="M117.1 125.6C126.5 120.7 130.4 129.1 128.7 133.2C118.8 140.4 112.2 134 117.1 125.6Z" fill="var(--bot-1)" />
      <path d="M112 112.8C102.2 110.2 104.9 101.6 108.8 99.8C120.4 101.2 120.9 110 112 112.8Z" fill="var(--bot-1)" />
      <path d="M107.4 125C112.6 133.2 105 137.6 101.1 136.3C93.9 127.9 99.3 121.3 107.4 125Z" fill="var(--bot-2)" />
      <path d="M118.4 119.5C120.1 110.3 128.3 112.1 130.3 115.6C129.9 126.1 121.7 127.3 118.4 119.5Z" fill="var(--bot-2)" />
      <path d="M107.2 116.3C100.1 121.6 95.4 115 96.3 111.3C103.3 104.1 109.9 108.6 107.2 116.3Z" fill="var(--bot-2)" />
      <path d="M113 125.6C121.4 126.4 120.4 134.2 117.4 136.3C107.9 136.8 106.1 129.3 113 125.6Z" fill="var(--bot-3)" />
      <path d="M114.9 115.5C109.5 109.5 115.2 104.6 118.7 105.1C125.6 110.8 122 117.3 114.9 115.5Z" fill="var(--bot-3)" />
      <path d="M107.2 121.3C107.1 128.9 99.9 128.7 97.7 126.1C96.6 117.7 103.3 115.5 107.2 121.3Z" fill="var(--bot-3)" />
      <path d="M116 122.1C121 116.9 126 121.7 125.8 124.9C121.3 131.5 115.1 128.7 116 122.1Z" fill="var(--bot-4)" />
      <path d="M110.6 116.1C103.8 116.5 103.4 110 105.5 107.8C112.9 106.1 115.4 112.1 110.6 116.1Z" fill="var(--bot-4)" />
      <path d="M110.5 123.5C115.5 127.5 111.6 132.4 108.7 132.6C102.6 129 104.7 123.2 110.5 123.5Z" fill="var(--bot-4)" />
      <path d="M115.1 118.6C114.2 112.6 120.1 111.7 122.2 113.5C124.2 119.7 119 122.5 115.1 118.6Z" fill="var(--bot-5)" />
      <path d="M109.1 119.1C105.9 123.7 101.3 120.7 100.9 118C103.5 112.5 108.9 113.9 109.1 119.1Z" fill="var(--bot-5)" />
      <path d="M113.3 122.3C118.4 121.2 119.7 126.2 118.3 128.3C113.1 130.4 110.3 126 113.3 122.3Z" fill="var(--bot-5)" />
      <path d="M112.5 117.8C108.3 115.4 110.6 111 112.9 110.5C117.7 112.3 116.9 117.2 112.5 117.8Z" fill="var(--bot-6)" />
      <path d="M110.4 121.1C111.8 125.3 107.5 126.9 105.6 125.8C103.4 121.6 107 118.8 110.4 121.1Z" fill="var(--bot-6)" />
      <path d="M113.5 120.2C115.2 116.5 119.2 118.1 119.8 120C118.6 124.2 114.4 123.9 113.5 120.2Z" fill="var(--bot-6)" />
      <path d="M111.3 119.1C107.8 120.5 106.2 117 106.9 115.3C110.3 113.3 112.9 116.1 111.3 119.1Z" fill="var(--bot-7)" />
      <path d="M112 120.8C115.1 121.9 114.1 125.3 112.5 126C109.1 125.3 109.1 121.8 112 120.8Z" fill="var(--bot-7)" />
      <path d="M112.3 119.7C110.9 117.1 113.7 115.4 115.1 115.9C116.9 118.4 114.8 120.8 112.3 119.7Z" fill="var(--bot-7)" />
      <path d="M112 120C111.3 122.5 108.5 121.9 107.8 120.8C108.1 118.1 111 117.8 112 120Z" fill="var(--bot-7)" />
  </>
);

/** Reflected rather than rotated: a rotated spray reads as the same object
 *  turned around, and the repetition becomes obvious. */
const MIRROR: Record<Corner, string | undefined> = {
  tl: undefined,
  tr: "translate(420,0) scale(-1,1)",
  bl: "translate(0,420) scale(1,-1)",
  br: "translate(420,420) scale(-1,-1)",
};

export type Corner = "tl" | "tr" | "bl" | "br";

export function Botanical({
  variant,
  corners = ["tl", "br"],
}: {
  /** Keeps the blur filter's id unique when more than one spray is on a page. */
  variant: string;
  corners?: Corner[];
}) {
  return (
    <>
      {corners.map(c => {
        const fid = `bot-${variant}-${c}`;
        return (
          <svg
            key={c}
            className={`bot bot-${c}`}
            viewBox="0 0 420 420"
            aria-hidden="true"
            focusable="false"
          >
            {/* A little over half a pixel: enough to take the mechanical edge
                off a vector, never enough to read as a blur. */}
            <filter id={fid} x="-12%" y="-12%" width="124%" height="124%">
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
            <g filter={`url(#${fid})`} transform={MIRROR[c]}>
              {SPRAY}
            </g>
          </svg>
        );
      })}
    </>
  );
}
