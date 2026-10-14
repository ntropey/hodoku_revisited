"""Builds public/icon.svg and public/favicon.svg: the Hodoku Revisited mark (a ruled 3x3 box with the candidates
1 3 4 5 6 7 9 in their fixed slots, which spell an H; the 5 in the centre is the accent colour).
The digits are IBM Plex Mono 600 outlines (OFL), drawn as paths so the icon does not need the font.
Needs: pip install fonttools brotli; the font from node_modules/@fontsource/ibm-plex-mono."""
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

FONT = 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff'
font = TTFont(FONT)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
UPM = font['head'].unitsPerEm
CAP = font['OS/2'].sCapHeight


def digit_path(ch, cx, cy, size, fill):
    g = glyphs[cmap[ord(ch)]]
    pen = SVGPathPen(glyphs)
    g.draw(pen)
    s = size / UPM
    x = cx - g.width * s / 2
    y = cy + CAP * s / 2  # baseline
    return f'<path transform="translate({x:.2f} {y:.2f}) scale({s:.5f} {-s:.5f})" fill="{fill}" d="{pen.getCommands()}"/>'


def mark(x0, y0, size, ink, accent, digit_color=None, rule_color=None):
    digit_color = digit_color or ink
    rule_color = rule_color or ink
    cell = size / 3
    outer = size * 0.035
    inner = outer / 3
    parts = []
    for i in (1, 2):
        parts.append(f'<path d="M{x0 + i * cell:.2f} {y0}V{y0 + size}M{x0} {y0 + i * cell:.2f}H{x0 + size}" stroke="{rule_color}" stroke-width="{inner:.2f}" fill="none"/>')
    parts.append(f'<rect x="{x0 + outer / 2:.2f}" y="{y0 + outer / 2:.2f}" width="{size - outer:.2f}" height="{size - outer:.2f}" rx="{size * 0.06:.2f}" fill="none" stroke="{rule_color}" stroke-width="{outer:.2f}"/>')
    slots = {'1': (0, 0), '3': (2, 0), '4': (0, 1), '5': (1, 1), '6': (2, 1), '7': (0, 2), '9': (2, 2)}
    for ch, (c, r) in slots.items():
        parts.append(digit_path(ch, x0 + (c + 0.5) * cell, y0 + (r + 0.5) * cell, size * 0.2, accent if ch == '5' else digit_color))
    return '\n'.join(parts)


INK, PAPER, ACCENT = '#1C1B18', '#F5F2EA', '#2B4EA2'
# app icon: the mark on a paper tile (safe for maskable icons: the mark fills 62% of the tile)
icon = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="{PAPER}"/>
{mark(96, 96, 320, INK, ACCENT)}
</svg>
'''
open('public/icon.svg', 'w').write(icon)
# favicon: inverted, rules kept, digits bigger for small sizes
fav = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="10" fill="{INK}"/>
{mark(8, 8, 48, INK, '#9DB4F5', digit_color=PAPER, rule_color=PAPER)}
</svg>
'''
open('public/favicon.svg', 'w').write(fav)
print('ok')
