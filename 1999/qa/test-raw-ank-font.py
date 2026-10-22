#!/usr/bin/env python3
"""Independently verify the private 1999 raw ANK WOFF extension.

No embedded original font bytes, no EXE execution, and no browser-font claim.
Uses exact CFF path geometry and compares against all 4096 source ANK bytes.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import fontTools
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def fields(table, excluded=()):
    return {key: value for key, value in vars(table).items()
            if key not in excluded}


def contours(charstring):
    """Decode CFF paths independently of the extension's row-run builder."""
    pen = RecordingPen()
    charstring.draw(pen)
    result, active = [], None
    for operation, arguments in pen.value:
        if operation == "moveTo":
            assert active is None
            active = [arguments[0]]
        elif operation == "lineTo":
            assert active is not None
            active.extend(arguments)
        elif operation == "closePath":
            assert active is not None and len(active) >= 4
            result.append(active)
            active = None
        else:
            raise AssertionError(f"Unexpected non-pixel path operation: {operation}")
    assert active is None
    return result


def winding_at(polygons, x, y):
    count = 0
    for polygon in polygons:
        for start, end in zip(polygon, polygon[1:] + polygon[:1]):
            x0, y0 = start
            x1, y1 = end
            cross = (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0)
            if y0 <= y < y1 and cross > 0:
                count += 1
            elif y1 <= y < y0 and cross < 0:
                count -= 1
    return count


def verify(baseline_path, extended_path, exe_path):
    base_bytes = baseline_path.read_bytes()
    new_bytes = extended_path.read_bytes()
    exe = exe_path.read_bytes()
    assert sha256(exe) == "8eaf841b5af1810687b26b7b07c16de0e2d434546c19c6088d31a228fb38d1f5"
    ank = exe[0x357B0 + 0x07EC:0x357B0 + 0x07EC + 4096]
    assert len(ank) == 4096
    before = TTFont(baseline_path, recalcBBoxes=False, recalcTimestamp=False)
    after = TTFont(extended_path, recalcBBoxes=False, recalcTimestamp=False)
    assert before.flavor == after.flavor == "woff"
    assert set(before.keys()) == set(after.keys())
    assert before["head"].unitsPerEm == after["head"].unitsPerEm == 1024
    old_order, new_order = before.getGlyphOrder(), after.getGlyphOrder()
    expected_names = [f"rawANK{byte:02X}" for byte in range(256)]
    assert new_order == old_order + expected_names

    # Existing cmap entries and subtable metadata are all immutable.
    before_maps, after_maps = before["cmap"].tables, after["cmap"].tables
    assert len(before_maps) == len(after_maps)
    for old, new in zip(before_maps, after_maps):
        assert (old.format, old.platformID, old.platEncID, old.language) == (
            new.format, new.platformID, new.platEncID, new.language)
        additions = ({0xF2000 + byte: name for byte, name in enumerate(expected_names)}
                     if old.isUnicode() and old.format == 12 else {})
        assert not set(old.cmap).intersection(additions)
        assert new.cmap == {**old.cmap, **additions}
        if not additions:
            assert old.compile(before) == new.compile(after)

    base_cff, new_cff = before["CFF "].cff, after["CFF "].cff
    old_top, new_top = base_cff.topDictIndex[0], new_cff.topDictIndex[0]
    assert base_cff.fontNames == new_cff.fontNames
    assert len(base_cff.GlobalSubrs) == len(new_cff.GlobalSubrs) == 0
    assert not hasattr(old_top.Private, "Subrs") and not hasattr(new_top.Private, "Subrs")
    assert old_top.Private.rawDict == new_top.Private.rawDict
    for attribute in ["FontBBox", "FontMatrix", "FontName", "FullName",
                      "FamilyName", "Weight", "isFixedPitch", "ItalicAngle",
                      "UnderlinePosition", "UnderlineThickness", "PaintType",
                      "CharstringType", "StrokeWidth"]:
        assert getattr(old_top, attribute, None) == getattr(new_top, attribute, None), attribute
    unchanged_charstrings = hashlib.sha256()
    for name in old_order:
        old_code = old_top.CharStrings[name].bytecode
        new_code = new_top.CharStrings[name].bytecode
        assert old_code is not None and old_code == new_code, name
        unchanged_charstrings.update(len(old_code).to_bytes(4, "big"))
        unchanged_charstrings.update(old_code)
        assert before["hmtx"].metrics[name] == after["hmtx"].metrics[name], name
    assert set(after["hmtx"].metrics) == set(new_order)

    # Only structural count/checksum fields may differ. WOFF compression and
    # directory offsets are containers, not glyph outlines or metrics.
    assert fields(before["head"], ["checkSumAdjustment"]) == fields(after["head"], ["checkSumAdjustment"])
    assert fields(before["hhea"], ["numberOfHMetrics"]) == fields(after["hhea"], ["numberOfHMetrics"])
    assert fields(before["maxp"], ["numGlyphs"]) == fields(after["maxp"], ["numGlyphs"])
    assert after["maxp"].numGlyphs == before["maxp"].numGlyphs + 256
    unchanged_tables = ["OS/2", "name", "post"]
    for tag in unchanged_tables:
        assert before.getTableData(tag) == after.getTableData(tag), tag

    checks = []
    for byte, name in enumerate(expected_names):
        charstring = new_top.CharStrings[name]
        polygons = contours(charstring)
        # Axis-aligned, 64-unit-aligned paths confined to the 8 x 16 cell
        # establish that cell-center occupancy proves the entire bitmap.
        for polygon in polygons:
            for x, y in polygon:
                assert 0 <= x <= 512 and 0 <= y <= 1024
                assert x % 64 == 0 and y % 64 == 0
            for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]):
                assert x0 == x1 or y0 == y1
        observed = bytearray()
        for row in range(16):
            value = 0
            for column in range(8):
                value = (value << 1) | bool(winding_at(
                    polygons, column * 64 + 32, (15 - row) * 64 + 32))
            observed.append(value)
        expected = ank[byte * 16:(byte + 1) * 16]
        assert bytes(observed) == expected, f"Bitmap mismatch for byte {byte}"
        assert after.getBestCmap()[0xF2000 + byte] == name
        assert after["hmtx"].metrics[name][0] == charstring.width == 512
        xs = [column for bits in expected for column in range(8)
              if bits & (1 << (7 - column))]
        assert after["hmtx"].metrics[name][1] == (min(xs) * 64 if xs else 0)
        checks.append({"byte": byte, "codepoint": f"U+{0xF2000 + byte:05X}",
                       "glyph": name, "pixel_mismatches": 0,
                       "advance_px_at_16px": 8, "left_side_bearing_units":
                       after["hmtx"].metrics[name][1]})

    return {
        "status": "PASS",
        "scope": "1999 private source-derived raw ANK font extension only",
        "fonttools_version": fontTools.__version__,
        "source_exe_sha256": sha256(exe),
        "source_table": {"ds_file_base": "0x357b0", "ds_offset": "0x07ec",
                         "file_offset": "0x35f9c", "length_bytes": 4096,
                         "sha256": sha256(ank)},
        "baseline_font_sha256": sha256(base_bytes),
        "extended_font_sha256": sha256(new_bytes),
        "baseline_bytes": len(base_bytes), "extended_bytes": len(new_bytes),
        "existing_glyphs_preserved": len(old_order),
        "existing_best_cmap_entries_preserved": len(before.getBestCmap()),
        "existing_charstrings_byte_for_byte_unchanged": True,
        "existing_charstrings_length_prefixed_sha256": unchanged_charstrings.hexdigest(),
        "existing_hmtx_metrics_unchanged": True,
        "existing_unchanged_tables": unchanged_tables,
        "allowed_structural_changes": ["cmap additions", "CFF appended glyphs and offsets",
            "hmtx appended metrics and encoding", "hhea.numberOfHMetrics",
            "maxp.numGlyphs", "head.checkSumAdjustment", "WOFF directory/compression"],
        "raw_ank_aliases": len(checks), "source_pixels_checked": 256 * 8 * 16,
        "pixel_mismatches": 0, "all_aliases_advance_px_at_16px": 8,
        "browser_font_rendering_validated": False,
        "privacy": "Original and generated font resources remain private; do not publish to public GitHub.",
        "glyph_checks": checks,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--extended", required=True, type=Path)
    parser.add_argument("--exe", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    result = verify(args.baseline, args.extended, args.exe)
    # A fresh reconstruction from the unchanged baseline must reproduce the
    # exact target WOFF bytes twice, not just an equivalent bitmap.
    extension_script = Path(__file__).with_name("extend-raw-ank-font.py")
    with tempfile.TemporaryDirectory(prefix="httd-raw-ank-rebuild-") as directory:
        for repeat in range(2):
            rebuilt = Path(directory) / f"rebuild-{repeat}.woff"
            subprocess.run([sys.executable, str(extension_script),
                            "--baseline", str(args.baseline),
                            "--exe", str(args.exe), "--output", str(rebuilt)],
                           check=True, capture_output=True, text=True)
            assert rebuilt.read_bytes() == args.extended.read_bytes()
    result["reproducible_extension_verified"] = True
    result["byte_identical_fresh_rebuilds"] = 2
    args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: result[key] for key in (
        "status", "existing_glyphs_preserved", "raw_ank_aliases",
        "source_pixels_checked", "pixel_mismatches", "extended_font_sha256")}))


if __name__ == "__main__":
    main()
