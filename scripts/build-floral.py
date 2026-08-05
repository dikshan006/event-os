"""
Generate the dark-botanical hero artwork.

  python3 scripts/build-floral.py public/art/dark-floral.png

An original Dutch-still-life arrangement — burgundy, deep red, blush, cream and
muted green on transparent — built procedurally rather than drawn, because the
alternative was licensing a raster and this has to be swappable for one later.

Why it does not look like vector art:

  * Every petal is filled with a gradient in its own bounding box, so the light
    falls across each petal individually. Flat fills are the single thing that
    makes generated florals look like clip art.
  * The whole arrangement is pushed through a turbulence displacement map, which
    breaks every edge into something closer to a loaded brush than a bezier.
  * Blooms are built from 20-40 jittered petals on a golden-angle spiral, drawn
    back to front, so nothing is symmetrical.
  * Values are heavily weighted dark. A Dutch still life is mostly shadow with a
    few lit faces, and matching that distribution matters more than any
    individual shape.

Seeded, so the committed PNG is reproducible and never churns in review.
"""
import math, random, subprocess, sys, os

# The arrangement is laid out in a 2400x1500 space and rasterised smaller — see
# OUT_W below. Shrinking the canvas instead would crop the composition, which
# is authored to these coordinates.
W, H = 2400, 1500

# What actually ships. The band renders at most 1440 CSS px wide, so 2000 is
# still 1.4x on a standard display; 2400 bought nothing visible and cost a
# third more bytes on a decorative background.
OUT_W = 2000
rnd = random.Random(20260806)

# Light from the upper left, as in every still life of the period.
LIGHT_DEG = -128

# Five steps per family, not three. A Dutch still life lives in its shadows;
# three values gives poster art, and the extra two are almost entirely at the
# dark end where the eye reads form.
BURGUNDY = ("#170609", "#2C0B12", "#4A111C", "#6B1926", "#8E2B36")
DEEP_RED = ("#1B0709", "#340D13", "#55151C", "#7C2029", "#A4313A")
BLUSH    = ("#241315", "#452625", "#6B4340", "#93635C", "#BC8A7F")
CREAM    = ("#24201A", "#463F32", "#6E624E", "#9A8B6E", "#C9B894")
GREEN    = ("#0B100B", "#141D13", "#1F2C1B", "#2C3D25", "#3E5432")

FAMILIES = {"burgundy": BURGUNDY, "deepred": DEEP_RED, "blush": BLUSH,
            "cream": CREAM, "green": GREEN}

def f(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s

def petal(cx, cy, R, ang, w, curl, squash):
    a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    def T(px, py):
        px *= squash
        return (cx + px*ca - py*sa, cy + px*sa + py*ca)
    Wd = R*w
    p0 = T(0, 0)
    c1 = T(R*0.16, -Wd*1.10); c2 = T(R*0.82, -Wd*0.80); p1 = T(R, -R*curl)
    c3 = T(R*0.90,  Wd*0.90); c4 = T(R*0.18,  Wd*0.98)
    return (f"M{f(p0[0])} {f(p0[1])}C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p1[0])} {f(p1[1])}"
            f"C{f(c3[0])} {f(c3[1])} {f(c4[0])} {f(c4[1])} {f(p0[0])} {f(p0[1])}Z")

def leaf(x, y, L, Wd, ang):
    a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    T = lambda px, py: (x + px*ca - py*sa, x*0 + y + px*sa + py*ca)
    p = [T(0,0), T(L*0.20,-Wd*1.10), T(L*0.68,-Wd*0.86), T(L,-L*0.05),
         T(L*0.66, Wd*0.90), T(L*0.18, Wd*1.02)]
    return (f"M{f(p[0][0])} {f(p[0][1])}C{f(p[1][0])} {f(p[1][1])} {f(p[2][0])} {f(p[2][1])} {f(p[3][0])} {f(p[3][1])}"
            f"C{f(p[4][0])} {f(p[4][1])} {f(p[5][0])} {f(p[5][1])} {f(p[0][0])} {f(p[0][1])}Z")

def bloom(cx, cy, R, fam, n=None, rot=None):
    """One flower: jittered petals on a golden-angle spiral, outermost first."""
    n = n or rnd.randint(22, 38)
    rot = rot if rot is not None else rnd.uniform(0, 360)
    out = []
    for i in range(n-1, -1, -1):
        t = i/(n-1)
        j = lambda s: 1 + rnd.uniform(-s, s)
        ang = rot + i*137.508 + rnd.uniform(-11, 11)
        rad = R*(0.20 + 0.80*t)*j(.16)
        off = R*0.36*t*j(.20)
        px = cx + off*math.cos(math.radians(ang))
        py = cy + off*math.sin(math.radians(ang))
        # Two things set a petal's value, and both matter.
        #
        # Depth: outer petals sit in the flower's own shadow, the centre
        # catches light. Direction: a petal facing the light source is lit and
        # one facing away is not, and applying one consistent light across
        # every flower is what stops an arrangement reading as a pattern.
        depth = (1 - t) * 2.1
        facing = math.cos(math.radians(ang - LIGHT_DEG))
        # Distance from where the light falls. Everything at the edges of the
        # arrangement drops into shadow, which is most of what makes the light
        # read as coming from a window rather than from a lamp on the camera.
        dx = (px - W*0.40) / (W*0.62)
        dy = (py - H*0.80) / (H*0.78)
        falloff = min(1.0, (dx*dx + dy*dy) ** 0.5)
        tone = 1.05 + depth + facing*1.15 - falloff*0.85 + rnd.uniform(-0.26, 0.26)
        tone = max(0, min(4, int(round(tone))))
        out.append((petal(px, py, rad*0.62, ang, (0.54+0.14*t)*j(.14),
                          (0.10+0.14*t)*j(.30), (1.0-0.16*t)*j(.08)), fam, tone))
    return out

def sprig(x, y, ang, L, count, spread=34):
    out = []
    for i in range(count):
        t = (i+1)/count
        side = 1 if i % 2 == 0 else -1
        d = L*t
        px = x + d*math.cos(math.radians(ang))
        py = y + d*math.sin(math.radians(ang))
        ll = L*0.34*(1.15-0.5*t)
        out.append((leaf(px, py, ll, ll*0.36, ang + side*spread + rnd.uniform(-8, 8)),
                    "green", rnd.choice([0, 0, 1, 1, 2])))
    return out


# ── the arrangement ────────────────────────────────────────────────────────
# Weighted to the lower half and the two lower corners, the way a still life
# sits on a table: mass at the bottom, a few blooms reaching up into the dark.
FOLIAGE = [
    (120, 1180,  -38, 760, 7), (360, 1320,  -62, 820, 8), (700, 1400,  -78, 880, 8),
    (1080, 1440, -96, 900, 8), (1500, 1420,-104, 860, 8), (1900, 1360,-118, 800, 7),
    (2260, 1240,-140, 720, 7), (150, 900,   -14, 600, 6), (2300, 880, -166, 620, 6),
    (620, 1180,  -50, 560, 6), (1320, 1240, -90, 620, 6), (1780, 1180,-128, 560, 6),
    (940, 1300,  -70, 700, 7), (2050, 1440,-112, 640, 6), (420, 1440, -70, 620, 6),
    (300, 1120,  -60, 700, 6), (1150, 1180, -84, 760, 7), (2000, 1140,-104, 720, 6),
    (760, 1160,  -72, 660, 6), (1620, 1160, -96, 680, 6),
]

BLOOMS = [
    # x,    y,    radius, family
    (330,  1230, 300, "burgundy"),
    (760,  1330, 340, "deepred"),
    (1180, 1250, 380, "burgundy"),
    (1620, 1330, 320, "deepred"),
    (2050, 1220, 300, "burgundy"),
    (560,  1100, 210, "blush"),
    (1420, 1080, 230, "cream"),
    (1900, 1040, 200, "blush"),
    (980,  1010, 190, "cream"),
    (200,  980,  180, "deepred"),
    (2280, 1010, 190, "deepred"),
    (1250, 830,  175, "blush"),
    (700,  850,  160, "burgundy"),
    (1720, 820,  165, "cream"),
    (430,  790,  135, "blush"),
    (2120, 790,  140, "burgundy"),
    (1000, 690,  125, "cream"),
    (1500, 660,  120, "deepred"),
    (250,  660,  110, "burgundy"),
    (2290, 650,  112, "blush"),
    (860,  560,   96, "blush"),
    (1880, 540,   98, "cream"),
    (1180, 470,   88, "burgundy"),
]

def build():
    shapes = []
    for x, y, ang, L, n in FOLIAGE:
        shapes += sprig(x, y, ang, L, n)
    # Back to front, so the big lower blooms overlap the ones reaching up.
    for x, y, R, fam in sorted(BLOOMS, key=lambda b: b[1]):
        shapes += bloom(x, y, R, fam)

    grads = []
    for name, cols in FAMILIES.items():
        for i, _ in enumerate(cols):
            dark = cols[max(0, i-(1 if name == 'green' else 2))]
            light = cols[i]
            # objectBoundingBox: every petal gets the ramp mapped to its own
            # box, which is what puts the light on each petal separately.
            # Two stops, not three. A dark-light-dark ramp puts a bright band
            # across the middle of every shape, and on a long rotated leaf —
            # whose bounding box is nothing like its own axis — that band reads
            # as a painted stripe. Straight dark-to-light has no midpoint to
            # betray the box.
            grads.append(
                f'<linearGradient id="g-{name}-{i}" x1="0.12" y1="0" x2="0.88" y2="1">'
                f'<stop offset="0" stop-color="{dark}"/>'
                f'<stop offset="1" stop-color="{light}"/></linearGradient>')

    body = "\n".join(
        f'<path d="{d}" fill="url(#g-{fam}-{tone})"/>' for d, fam, tone in shapes)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
{chr(10).join(grads)}
<filter id="brush" x="-4%" y="-4%" width="108%" height="108%">
  <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="4" seed="7" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="26" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" result="grain"/>
  <feColorMatrix in="grain" type="saturate" values="0" result="gg"/>
  <feComposite in="gg" in2="d" operator="in" result="gin"/>
  <feBlend in="d" in2="gin" mode="multiply" result="tex"/>
  <feGaussianBlur in="tex" stdDeviation="1.1"/>
</filter>
</defs>
<g filter="url(#brush)">
{body}
</g>
</svg>'''
    return svg

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "public/art/dark-floral.png"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    svg = build()
    tmp = "/tmp/floral.svg"
    open(tmp, "w").write(svg)
    print(f"  svg {len(svg)//1024} KB")

    base = out[:-4] if out.endswith(".png") else out
    # The PNG is the master, and the one file to replace if this is ever swapped
    # for licensed artwork. AVIF and WebP are what actually get served: a 1.2 MB
    # hero is not a hero, it is a wait.
    script = (
        'const sharp=require("sharp");const s=%r;const w=%d;const g=()=>sharp(s,{density:96}).resize({width:w});(async()=>{'
        'await g().png({compressionLevel:9}).toFile(%r);'
        'await g().avif({quality:50}).toFile(%r);'
        'await g().webp({quality:66,alphaQuality:88}).toFile(%r);'
        '})();'
    ) % (tmp, OUT_W, base + ".png", base + ".avif", base + ".webp")
    subprocess.run(["node", "-e", script], check=True)

    for ext in ("png", "avif", "webp"):
        path = f"{base}.{ext}"
        if os.path.exists(path):
            print(f"  → {path} ({os.path.getsize(path)//1024} KB)")
