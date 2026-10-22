#!/usr/bin/env python3
"""Append original 1999 raw ANK aliases without rebuilding existing outlines.

Requires the user's private HTTD.exe and an unextended original-pixel WOFF.
This authored extraction script contains no original font data. The extracted
font remains a private, user-provided-resource derivative, not a public asset.
No executable is run. Requires fontTools (verified with 4.61.1).
"""

import argparse
import hashlib
from pathlib import Path

from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

EXE_SHA256 = "8eaf841b5af1810687b26b7b07c16de0e2d434546c19c6088d31a228fb38d1f5"
DS_FILE_BASE = 0x357B0
ANK_DS_OFFSET = 0x07EC
ALIAS_BASE = 0xF2000
PIXEL_UNITS = 64


def extend_font(font_path, exe_path, output_path):
    original = Path(exe_path).read_bytes()
    if hashlib.sha256(original).hexdigest() != EXE_SHA256:
        raise ValueError("Not the source-confirmed private 1999 HTTD.exe")
    offset = DS_FILE_BASE + ANK_DS_OFFSET
    ank = original[offset:offset + 256 * 16]
    if len(ank) != 256 * 16:
        raise ValueError("Original 256 x 8 x 16 ANK table is incomplete")

    font = TTFont(font_path, recalcBBoxes=False, recalcTimestamp=False)
    if font.flavor != "woff" or "CFF " not in font:
        raise ValueError("Expected the existing CFF WOFF font")
    if font["head"].unitsPerEm != 16 * PIXEL_UNITS:
        raise ValueError("Unexpected existing font units per em")
    top = font["CFF "].cff.topDictIndex[0]
    charstrings = top.CharStrings
    if not charstrings.charStringsAreIndexed:
        raise ValueError("Expected an indexed CFF CharStrings table")
    if len(font["CFF "].cff.GlobalSubrs) or hasattr(top.Private, "Subrs"):
        raise ValueError("Unexpected CFF subroutines; review before extension")
    unicode_maps = [table for table in font["cmap"].tables
                    if table.isUnicode() and table.format == 12]
    if not unicode_maps:
        raise ValueError("Existing font needs a Unicode format-12 cmap")
    aliases = set(range(ALIAS_BASE, ALIAS_BASE + 256))
    if any(aliases.intersection(table.cmap) for table in font["cmap"].tables):
        raise ValueError("Raw ANK aliases already exist; start with the baseline")
    old_order = list(font.getGlyphOrder())
    new_names = [f"rawANK{byte:02X}" for byte in range(256)]
    if set(old_order).intersection(new_names):
        raise ValueError("Raw ANK glyph-name collision")

    # Keep the original CFF bytes lazily loaded: do not draw, decompile or
    # regenerate any existing glyph. Append only the new CharStrings.
    for byte, name in enumerate(new_names):
        rows = ank[byte * 16:(byte + 1) * 16]
        pen = T2CharStringPen(8 * PIXEL_UNITS, None)
        leftmost = 8
        for row, bits in enumerate(rows):
            column = 0
            while column < 8:
                if not bits & (1 << (7 - column)):
                    column += 1
                    continue
                start = column
                leftmost = min(leftmost, start)
                while column < 8 and bits & (1 << (7 - column)):
                    column += 1
                x0, x1 = start * PIXEL_UNITS, column * PIXEL_UNITS
                y0, y1 = (15 - row) * PIXEL_UNITS, (16 - row) * PIXEL_UNITS
                pen.moveTo((x0, y0))
                pen.lineTo((x0, y1))
                pen.lineTo((x1, y1))
                pen.lineTo((x1, y0))
                pen.closePath()
        charstring = pen.getCharString(private=top.Private,
                                      globalSubrs=charstrings.globalSubrs)
        charstrings.charStrings[name] = len(charstrings.charStringsIndex)
        charstrings.charStringsIndex.append(charstring)
        font["hmtx"].metrics[name] = (
            8 * PIXEL_UNITS, 0 if leftmost == 8 else leftmost * PIXEL_UNITS)
        for table in unicode_maps:
            table.cmap[ALIAS_BASE + byte] = name

    order = old_order + new_names
    top.charset = order
    top.numGlyphs = len(order)
    font.setGlyphOrder(order)
    font["maxp"].numGlyphs = len(order)
    font.flavor = "woff"
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    font.save(output, reorderTables=False)
    font.close()
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--exe", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = extend_font(args.baseline, args.exe, args.output)
    print(f"Added 256 raw ANK aliases U+F2000..U+F20FF: {output}")
    print(f"sha256: {hashlib.sha256(output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
