"""Shrink a .glb by storing vertex attributes in smaller number types (glTF extension KHR_mesh_quantization).

    python tools/glb_quantize.py                 # quantize the three model files in public/models in place
    python tools/glb_quantize.py a.glb b.glb     # or the given files

serve.py runs this on every model the builder uploads, so files on disk are always quantized.
Converted (float32 -> smaller):
  NORMAL      -> int8 normalized   (12 -> 4 bytes per vertex, ~0.5 degree error: invisible in shading)
  COLOR_0     -> uint16 normalized (12/16 -> 8 bytes; 16-bit keeps dark linear colours free of banding)
  TEXCOORD_n  -> uint16 normalized (8 -> 4 bytes; only when all values lie in 0..1)
  instance ROTATION (EXT_mesh_gpu_instancing) -> int16 normalized (16 -> 8 bytes)
POSITION stays float32: quantizing it needs a de-quantizing scale on the node, which would also scale the instance
transforms of EXT_mesh_gpu_instancing and break code that reads terrain heights from the geometry.
Lossless in structure (same meshes, names, extras); running it twice changes nothing.
"""
import json
import struct
import sys
from array import array
from pathlib import Path

FLOAT, BYTE, UBYTE, SHORT, USHORT = 5126, 5120, 5121, 5122, 5123
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
CSIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
EXT = "KHR_mesh_quantization"


def _read(glb: bytes):
    magic, _version, length = struct.unpack_from("<4sII", glb, 0)
    if magic != b"glTF":
        raise ValueError("not a glb")
    off, js, bin_ = 12, None, b""
    while off < length:
        clen, ctype = struct.unpack_from("<II", glb, off)
        chunk = glb[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            bin_ = bytes(chunk)
        off += 8 + clen
    return js, bin_


def _write(js, bin_: bytes) -> bytes:
    j = json.dumps(js, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    bin_ += b"\0" * (-len(bin_) % 4)
    total = 12 + 8 + len(j) + (8 + len(bin_) if bin_ else 0)
    out = struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<II", len(j), 0x4E4F534A) + j
    if bin_:
        out += struct.pack("<II", len(bin_), 0x004E4942) + bin_
    return out


def _floats(js, bin_, acc):
    bv = js["bufferViews"][acc["bufferView"]]
    n = acc["count"] * NCOMP[acc["type"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    a = array("f")
    a.frombytes(bin_[start: start + n * 4])
    if sys.byteorder != "little":
        a.byteswap()
    return a


def _pack(values, ncomp, stride_comps, fmt, scale, lo, hi):
    """Pack `values` (ncomp per vertex) as normalized integers, padding each vertex to `stride_comps` components."""
    out = array(fmt)
    pad = [0] * (stride_comps - ncomp)
    for i in range(0, len(values), ncomp):
        for c in range(ncomp):
            v = round(values[i + c] * scale)
            out.append(lo if v < lo else hi if v > hi else v)
        out.extend(pad)
    if sys.byteorder != "little":
        out.byteswap()
    return out.tobytes()


def quantize(glb: bytes) -> bytes:
    js, bin_ = _read(glb)
    if not js.get("bufferViews") or len(js.get("buffers", [])) != 1:
        return glb  # nothing to do, or an external / multi-buffer file this tool does not handle
    accessors, views = js["accessors"], js["bufferViews"]

    # How often each bufferView is used: only views owned by a single, tightly packed accessor are rewritten.
    view_users = {}
    for a in accessors:
        if "bufferView" in a:
            view_users[a["bufferView"]] = view_users.get(a["bufferView"], 0) + 1

    plan = {}  # accessor index -> semantic
    for mesh in js.get("meshes", []):
        for prim in mesh["primitives"]:
            for sem, idx in prim["attributes"].items():
                if sem == "NORMAL" or sem.startswith("COLOR_") or sem.startswith("TEXCOORD_"):
                    plan[idx] = sem
            for target in prim.get("targets", []):  # morph targets: leave their base attributes alone
                for idx in target.values():
                    plan.pop(idx, None)
    # Instance rotations (EXT_mesh_gpu_instancing). Translation, scale and _COLOR_0 stay float: three.js copies
    # _COLOR_0 straight into instanceColor, which loader.js writes floats into when it thins the forest.
    for node in js.get("nodes", []):
        inst = node.get("extensions", {}).get("EXT_mesh_gpu_instancing")
        if inst and "ROTATION" in inst.get("attributes", {}):
            plan[inst["attributes"]["ROTATION"]] = "ROTATION"

    new_data, changed = {}, False
    for idx, sem in plan.items():
        acc = accessors[idx]
        if acc["componentType"] != FLOAT or "sparse" in acc or "bufferView" not in acc:
            continue
        bv = views[acc["bufferView"]]
        if view_users[acc["bufferView"]] != 1 or bv.get("byteStride") not in (None, 4 * NCOMP[acc["type"]]):
            continue
        vals = _floats(js, bin_, acc)
        n = NCOMP[acc["type"]]
        if sem == "NORMAL" and n == 3:
            data, ctype, stride = _pack(vals, 3, 4, "b", 127, -127, 127), BYTE, 4
        elif sem.startswith("COLOR_") and n in (3, 4) and all(0 <= v <= 1 for v in vals):
            data, ctype, stride = _pack(vals, n, 4, "H", 65535, 0, 65535), USHORT, 8
        elif sem.startswith("TEXCOORD_") and n == 2 and all(0 <= v <= 1 for v in vals):
            data, ctype, stride = _pack(vals, 2, 2, "H", 65535, 0, 65535), USHORT, 4
        elif sem == "ROTATION" and n == 4:
            data, ctype, stride = _pack(vals, 4, 4, "h", 32767, -32767, 32767), SHORT, 8
        else:
            continue
        new_data[acc["bufferView"]] = (data, stride if stride != n * CSIZE[ctype] else None)
        acc["componentType"], acc["normalized"] = ctype, True
        acc.pop("byteOffset", None)
        acc.pop("min", None)  # optional for these attributes; the float bounds would no longer match
        acc.pop("max", None)
        changed = True

    if not changed:
        return glb

    # Re-pack the binary chunk: every view in its original order, 4-byte aligned (the rewritten ones need it).
    out = bytearray()
    for i, bv in enumerate(views):
        out += b"\0" * (-len(out) % 4)
        if i in new_data:
            data, stride = new_data[i]
            bv.pop("byteStride", None)
            if stride:
                bv["byteStride"] = stride
        else:
            s = bv.get("byteOffset", 0)
            data = bin_[s: s + bv["byteLength"]]
        bv["byteOffset"], bv["byteLength"] = len(out), len(data)
        out += data
    js["buffers"][0]["byteLength"] = len(out)
    for key in ("extensionsUsed", "extensionsRequired"):
        if EXT not in js.setdefault(key, []):
            js[key].append(EXT)
    return _write(js, bytes(out))


def main(paths):
    root = Path(__file__).resolve().parent.parent / "public" / "models"
    files = [Path(p) for p in paths] or sorted(root.glob("*.glb"))
    for f in files:
        before = f.read_bytes()
        after = quantize(before)
        if after is not before:
            f.write_bytes(after)
        print(f"{f.name:40s} {len(before) / 1024:8.0f} KB -> {len(after) / 1024:8.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
