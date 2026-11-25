#!/usr/bin/env python3
"""Trace the two camps' chess pieces out of design/chess_set.png.

    python3 -m venv /tmp/vecenv
    /tmp/vecenv/bin/pip install pillow numpy potracer
    /tmp/vecenv/bin/python scripts/extract-chess-set-pieces.py

The reference sheet is a photograph of twelve figures in a 2 x 6 grid: one row
per camp, six columns per set. Each figure stands on a plinth whose top trim is a
flat gold band, which separates a piece from its display base.

Two products per figure:

  * a silhouette, traced from the whole figure, which becomes the solid body of
    the piece in the app;
  * two overlay regions - the camp's secondary material and its gold trim -
    traced from a cleaned material segmentation, so the pieces keep the pattern
    of the reference instead of flattening into one colour.

Column order king, queen, bishop, knight, rook, pawn is supported by three
independent signals: the standard by-value ordering, macOS Vision labels on the
cells (col 3 "horse", col 4 "tower/lighthouse", col 2 "hat" + "tool"), and the
measured heights (col 0 tallest, col 5 shortest in both rows).

Requires `potracer` (pure Python port of potrace) plus pillow and numpy; it is not
part of the npm toolchain, so this script is run by hand when the reference art
changes. It rewrites src/lib/pieceGeometry.ts.
"""
from collections import deque
from pathlib import Path
import textwrap

import numpy as np
import potrace
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "chess_set.png"
TARGET = ROOT / "src" / "lib" / "pieceGeometry.ts"

# Row bands (top of the figures .. top of the plinth trim) and the six column bands.
ROWS = [(168, 481), (565, 923)]
COLS = [(23, 268), (282, 523), (530, 755), (767, 1024), (1032, 1253), (1271, 1504)]
ORDER = ["k", "q", "b", "n", "r", "p"]
CAMPS = ["w", "b"]
NAMES = {"k": "king", "q": "queen", "b": "bishop", "n": "knight", "r": "rook", "p": "pawn"}

PAD = 6               # potrace emits a frame curve around the canvas; padding keeps
                      # the figure off that frame so the frame can be dropped
TURDSIZE = 140
ALPHA_MAX = 1.0
OPT_TOLERANCE = 0.9        # silhouette: faithful
OVERLAY_TOLERANCE = 1.6    # overlay regions: smoother, fewer nodes

# Material segmentation. Roles are decided by hue first and lightness second,
# which survives the shading of the photograph far better than RGB clustering.
SMOOTH_RADIUS = 9     # soft-majority filter: removes speckle, keeps real edges
MIN_REGION_SHARE = 0.012
TRIM_TURDSIZE = 60

IMAGE = np.asarray(Image.open(SOURCE).convert("RGB")).astype(int)


def components(mask, min_area=1, keep="all"):
    """Connected components (4-way); keep those at least `min_area` big."""
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    keepers = []
    for start_y in range(height):
        for start_x in range(width):
            if not mask[start_y, start_x] or seen[start_y, start_x]:
                continue
            queue = deque([(start_y, start_x)])
            seen[start_y, start_x] = True
            blob = []
            while queue:
                y, x = queue.popleft()
                blob.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
            keepers.append(blob)
    if keep == "largest":
        keepers = [max(keepers, key=len)] if keepers else []
    else:
        keepers = [blob for blob in keepers if len(blob) >= min_area]
    out = np.zeros_like(mask, dtype=bool)
    for blob in keepers:
        for y, x in blob:
            out[y, x] = True
    return out


def box_blur(array, radius):
    padded = np.pad(array.astype(np.float64), radius, mode="edge")
    cumulative = padded.cumsum(0).cumsum(1)
    cumulative = np.pad(cumulative, ((1, 0), (1, 0)))
    height, width = array.shape
    size = 2 * radius + 1
    window = (cumulative[size:size + height, size:size + width]
              - cumulative[0:height, size:size + width]
              - cumulative[size:size + height, 0:width]
              + cumulative[0:height, 0:width])
    return window / (size * size)


def crop_cell(row, column):
    y0, y1 = ROWS[row]
    x0, x1 = COLS[column]
    cell = IMAGE[y0:y1, x0:x1]
    mask = components(~((cell > 238).all(axis=2)), keep="largest")
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return cell[y0:y1, x0:x1], np.ascontiguousarray(mask[y0:y1, x0:x1])


def erode(mask, radius):
    """Shrink a mask so overlays never poke outside the traced silhouette."""
    out = mask.copy()
    for _ in range(radius):
        shifted = out.copy()
        shifted[1:, :] &= out[:-1, :]
        shifted[:-1, :] &= out[1:, :]
        shifted[:, 1:] &= out[:, :-1]
        shifted[:, :-1] &= out[:, 1:]
        out = shifted
    return out


def layers(row, column):
    """Return the silhouette plus the panel and trim overlays, in mask space."""
    cell, mask = crop_cell(row, column)
    red = cell[:, :, 0]
    green = cell[:, :, 1]
    blue = cell[:, :, 2]
    luminance = (red + green + blue) / 3.0

    is_red = (red - np.maximum(green, blue) > 40) & (red > 80)
    is_gold = (~is_red) & (red - blue > 50) & (green - blue > 20)
    neutral = ~is_red & ~is_gold

    if row == 0:      # ivory and oxblood: oxblood is the body, ivory the panel
        body = is_red | (neutral & (luminance <= 140))
        panel = neutral & (luminance > 140)
    else:             # black lacquer and bone: black is the body, bone the panel
        body = neutral & (luminance <= 130)
        panel = (neutral & (luminance > 130)) | is_red
    trim = is_gold

    scores = {
        "body": box_blur((body & mask).astype(float), SMOOTH_RADIUS),
        "panel": box_blur((panel & mask).astype(float), SMOOTH_RADIUS),
        "trim": box_blur((trim & mask).astype(float), SMOOTH_RADIUS),
    }
    winner = np.stack([scores["body"], scores["panel"], scores["trim"]]).argmax(axis=0)
    inside = erode(mask, 3)
    total = mask.sum()

    panel_mask = components((winner == 1) & inside, max(60, int(total * MIN_REGION_SHARE)))
    trim_mask = components((winner == 2) & inside, max(40, int(total * MIN_REGION_SHARE)))
    return mask, panel_mask, trim_mask


def trace(mask, tolerance=OPT_TOLERANCE, turdsize=TURDSIZE):
    """Trace a mask into closed contours, expressed in mask coordinates."""
    padded = np.zeros((mask.shape[0] + 2 * PAD, mask.shape[1] + 2 * PAD), dtype=bool)
    padded[PAD:-PAD, PAD:-PAD] = mask
    path = potrace.Bitmap(padded).trace(
        turdsize=turdsize, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
        alphamax=ALPHA_MAX, opticurve=True, opttolerance=tolerance,
    )
    height, width = padded.shape

    def local(point):
        return (point.x - PAD, point.y - PAD)

    curves = []
    for curve in path:
        segments = []
        points = [local(curve.start_point)]
        current = points[0]
        for segment in curve:
            if segment.is_corner:
                corner, end = local(segment.c), local(segment.end_point)
                segments.append(("L", current, corner, end))
                points += [corner, end]
                current = end
            else:
                c1, c2, end = local(segment.c1), local(segment.c2), local(segment.end_point)
                segments.append(("C", current, c1, c2, end))
                points += [c1, c2, end]
                current = end
        xs = [p[0] + PAD for p in points]
        ys = [p[1] + PAD for p in points]
        if min(xs) < 0.6 and min(ys) < 0.6 and max(xs) > width - 0.6 and max(ys) > height - 0.6:
            continue      # the canvas frame curve
        curves.append((points, segments))
    return curves


def flatten(curves, steps=16):
    polygons = []
    for points, segments in curves:
        out = [points[0]]
        for segment in segments:
            if segment[0] == "L":
                out.append(segment[3])
            else:
                start, c1, c2, end = segment[1], segment[2], segment[3], segment[4]
                for step in range(1, steps + 1):
                    t = step / steps
                    rest = 1 - t
                    out.append((
                        rest ** 3 * start[0] + 3 * rest * rest * t * c1[0] + 3 * rest * t * t * c2[0] + t ** 3 * end[0],
                        rest ** 3 * start[1] + 3 * rest * rest * t * c1[1] + 3 * rest * t * t * c2[1] + t ** 3 * end[1],
                    ))
        polygons.append(out)
    return polygons


def inside(point, polygon):
    x, y = point
    hit = False
    for i in range(len(polygon)):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % len(polygon)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def rasterise(polygons, shape):
    canvas = Image.new("L", (shape[1], shape[0]), 0)
    draw = ImageDraw.Draw(canvas)
    for index, points in enumerate(polygons):
        depth = sum(1 for other, poly in enumerate(polygons)
                    if other != index and inside(points[0], poly))
        if depth % 2 == 0:
            draw.polygon([(float(x), float(y)) for x, y in points], fill=255)
    return np.asarray(canvas) > 127


def svg_path(curves, scale, offset_x, offset_y, precision=2):
    def point(p):
        return f"{p[0] * scale + offset_x:.{precision}f} {p[1] * scale + offset_y:.{precision}f}"

    parts = []
    for points, segments in curves:
        parts.append(f"M {point(points[0])}")
        for segment in segments:
            if segment[0] == "L":
                parts.append(f"L {point(segment[2])} L {point(segment[3])}")
            else:
                parts.append(f"C {point(segment[2])} {point(segment[3])} {point(segment[4])}")
        parts.append("Z")
    return " ".join(parts)


def main():
    shapes, scores = {}, {}
    for row, camp in enumerate(CAMPS):
        shapes[camp] = {}
        for column, symbol in enumerate(ORDER):
            silhouette, panel_mask, trim_mask = layers(row, column)
            height, width = silhouette.shape
            # Keep a margin so curve overshoot cannot be clipped by the viewBox.
            scale = 95.0 / height
            offset_x = (100 - width * scale) / 2.0
            offset_y = 2.5

            entry = {}
            for name, region in (("silhouette", silhouette), ("panel", panel_mask), ("trim", trim_mask)):
                if name != "silhouette" and not region.any():
                    continue
                curves = trace(region, OVERLAY_TOLERANCE if name != "silhouette" else OPT_TOLERANCE,
                              TRIM_TURDSIZE if name == "trim" else TURDSIZE)
                polygons = flatten(curves)
                rendered = rasterise(polygons, silhouette.shape)
                iou = (rendered & region).sum() / (rendered | region).sum() if region.any() else 1.0
                if name != "silhouette" and iou < 0.80:
                    print(f"    ! {camp}-{NAMES[symbol]} {name} trace IoU only {iou:.3f}")
                entry[name] = svg_path(curves, scale, offset_x, offset_y,
                                          2 if name == "silhouette" else 1)
                entry[f"{name}IoU"] = iou
                if name != "silhouette":
                    entry[f"{name}Share"] = region.sum() / silhouette.sum()
            shapes[camp][symbol] = entry
            scores[(camp, symbol)] = entry
            print(f"  {camp}-{NAMES[symbol]:<6} {width:>3}x{height:<3}px  "
                  f"silhouette IoU {entry['silhouetteIoU']:.4f}  "
                  f"panel {entry.get('panelShare', 0) * 100:4.0f}% (IoU {entry.get('panelIoU', 1):.3f})  "
                  f"trim {entry.get('trimShare', 0) * 100:4.0f}% (IoU {entry.get('trimIoU', 1):.3f})")

    worst = min(entry["silhouetteIoU"] for entry in scores.values())
    if worst < 0.94:
        raise SystemExit(f"silhouette trace quality too low (worst IoU {worst:.3f})")

    lines = [
        'import type { Color, PieceSymbol } from "chess.js";',
        "",
        "/**",
        " * Position Zero piece geometry, traced from `design/chess_set.png`.",
        " *",
        " * The reference sheet photographs twelve figures: one row per camp, six columns",
        " * ordered king, queen, bishop, knight, rook, pawn. Each shape below is a potrace",
        " * trace of the segmented photograph, normalised to a 100 unit height and centred",
        " * horizontally, so every piece keeps the proportions of the reference sheet.",
        " *",
        " * `silhouette` is the whole figure: it becomes the solid body of the piece, filled",
        " * with the skin's body colour and outlined with its edge colour. `panel` and `trim`",
        " * are the camp's secondary material and its gold work, traced from a cleaned",
        " * material segmentation and drawn on top, so a piece keeps the pattern of the",
        " * reference instead of flattening into one colour.",
        " *",
        " * Contours are closed and only read as holes under `fill-rule: evenodd`, which the",
        " * stylesheet sets on every piece layer.",
        " *",
        " * Regenerate with `scripts/extract-chess-set-pieces.py`.",
        " */",
        'export const PIECE_VIEW_BOX = "0 0 100 100";',
        "",
        "/** One piece: a solid outline plus the overlay regions of its pattern. */",
        "export interface PieceShape {",
        "  /** Whole figure, filled with the body colour and stroked with the edge colour. */",
        "  silhouette: string;",
        "  /** Secondary material of the camp, drawn over the body. */",
        "  panel?: string;",
        "  /** Gold work, drawn over both. */",
        "  trim?: string;",
        "}",
        "",
        "export const PIECE_GEOMETRY: Record<Color, Record<PieceSymbol, PieceShape>> = {",
    ]
    notes = {
        "w": "Light camp: ivory and oxblood row. Body is oxblood, panel is ivory.",
        "b": "Dark camp: black lacquer and gold row. Body is lacquer, panel is bone.",
    }
    for camp in CAMPS:
        lines.append(f"  /** {notes[camp]} */")
        lines.append(f"  {camp}: {{")
        for symbol in ORDER:
            entry = shapes[camp][symbol]
            lines.append(f"    {symbol}: {{")
            for name in ("silhouette", "panel", "trim"):
                if name not in entry:
                    continue
                note = f"{name}, trace IoU {entry[name + 'IoU']:.3f}"
                if name != "silhouette":
                    note += f", covers {entry[name + 'Share'] * 100:.0f}% of the figure"
                lines.append(f"      // {note}")
                wrapped = textwrap.wrap(entry[name], width=102)
                lines.append(f"      {name}: `{wrapped[0]}")
                for chunk in wrapped[1:]:
                    lines.append(f"        {chunk}")
                lines[-1] += "`,"
            lines.append("    },")
        lines.append("  },")
    lines.append("};")
    TARGET.write_text("\n".join(lines) + "\n")
    print(f"\nwrote {TARGET.relative_to(ROOT)} "
          f"({TARGET.stat().st_size / 1024:.0f} KB, worst silhouette IoU {worst:.3f})")


if __name__ == "__main__":
    main()
