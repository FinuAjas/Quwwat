"""Plan 3: compare the "before" and "after" snapshot sets (made with tools/plan3-snapshot.html).

    python tools/plan3_diff.py              # report + difference images in tools/plan3/diff/
    python tools/plan3_diff.py --margin 3   # metres added round the work area (default 3)

For the two top views it masks the Plan 3 work area (plus the margin) and counts the pixels that changed
OUTSIDE it. The mask also covers the one approved exception, the old west-road tail (P3.4). A pixel counts as changed when a colour channel differs by more than THRESHOLD levels; the
snapshot tool measured that two captures of the same model never differ by more than 1 level.
It also compares the per-group mesh, triangle and instance counts recorded in the two manifests.
Needs Pillow. Exit code: 0 = nothing changed outside the area, 1 = something did.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent / "plan3"
THRESHOLD = 12
# The approved exception (P3.4): the old west road's tail from the work area to the hairpin junction, in layout
# pixels, and how far from it the ground may change (the removed road, its kerbs and the 8 m over which the ground
# was graded to meet it).
TAIL_PX = [(1040, 555), (1022, 575), (1005, 596), (987, 616), (977, 625)]
TAIL_REACH_M = 13.0


def changed_mask(a, b):
    """White where any channel differs by more than THRESHOLD."""
    d = ImageChops.difference(a, b).convert("RGB")
    r, g, bl = d.split()
    m = ImageChops.lighter(ImageChops.lighter(r, g), bl)
    return m.point(lambda v: 255 if v > THRESHOLD else 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--margin", type=float, default=3.0, help="metres added round the work area")
    args = ap.parse_args()
    before = json.loads((ROOT / "before" / "manifest.json").read_text(encoding="utf-8"))
    after = json.loads((ROOT / "after" / "manifest.json").read_text(encoding="utf-8"))
    out = ROOT / "diff"
    out.mkdir(exist_ok=True)
    px_m = before["layout"]["pxToMetres"]
    area = [tuple(p) for p in before["areaPx"]]
    failed = False

    print(f"Pixels changed outside the work area (+{args.margin:g} m), threshold {THRESHOLD}/255")
    for view in before["views"]:
        if view["kind"] != "top":
            continue
        name, scale = view["file"], view["layoutScale"]
        a = Image.open(ROOT / "before" / name).convert("RGB")
        b = Image.open(ROOT / "after" / name).convert("RGB")
        w, h = a.size
        # layout pixel -> image pixel (the frame keeps layout pixel (800, 600) at the same place for every scale)
        to_img = lambda p: ((p[0] - 800) / scale + 800, (p[1] - 600) / scale + 600)
        poly = [to_img(p) for p in area]
        inside = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(inside)
        d.polygon(poly, fill=255)
        grow = args.margin / px_m / scale
        d.line(poly + [poly[0]], fill=255, width=max(1, round(grow * 2)), joint="curve")
        for p in poly:
            d.ellipse([p[0] - grow, p[1] - grow, p[0] + grow, p[1] + grow], fill=255)
        tail, reach = [to_img(p) for p in TAIL_PX], TAIL_REACH_M / px_m / scale
        d.line(tail, fill=255, width=max(1, round(reach * 2)), joint="curve")
        for p in tail:
            d.ellipse([p[0] - reach, p[1] - reach, p[0] + reach, p[1] + reach], fill=255)
        ch = changed_mask(a, b)
        outside = ImageChops.multiply(ch, ImageChops.invert(inside))
        n_out = sum(outside.histogram()[255:])
        n_in = sum(ImageChops.multiply(ch, inside).histogram()[255:])
        box = outside.getbbox()
        failed |= n_out > 0
        print(f"  {name:14s} outside: {n_out:7d} px ({n_out * (px_m * scale) ** 2:8.0f} m²)   inside: {n_in:7d} px"
              + (f"   outside box (image px): {box}" if box else ""))
        # picture: the after image, dimmed, with outside changes in red, inside changes in green, and the outline
        vis = Image.blend(b, Image.new("RGB", (w, h), (0, 0, 0)), 0.45)
        vis.paste((255, 40, 40), mask=outside)
        vis.paste((60, 230, 90), mask=ImageChops.multiply(ch, inside))
        ImageDraw.Draw(vis).line(poly + [poly[0]], fill=(255, 235, 60), width=2)
        ImageDraw.Draw(vis).line(tail, fill=(255, 235, 60), width=1)
        vis.save(out / name)

    print("\nModel groups (meshes / triangles / instances): before -> after")
    keys = sorted(set(before["groups"]) | set(after["groups"]))
    for k in keys:
        x, y = before["groups"].get(k), after["groups"].get(k)
        f = lambda g: "—" if g is None else f"{g['meshes']}/{g['triangles']}/{g['instances']}"
        mark = "" if x == y else "   <- changed"
        print(f"  {k.split('/', 1)[-1]:44s} {f(x):>22s} -> {f(y):<22s}{mark}")

    def per_mesh(m):
        return {f"{e['path']}/{e['name']}": (e["triangles"], e["instances"]) for e in m["meshes"]}
    pa, pb = per_mesh(before), per_mesh(after)
    print("\nMeshes that differ:")
    for k in sorted(set(pa) | set(pb)):
        if pa.get(k) != pb.get(k):
            print(f"  {k.split('/', 2)[-1]:58s} {str(pa.get(k)):>16s} -> {pb.get(k)}")
    print(f"\nDifference images: {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
