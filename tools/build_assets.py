"""One command to rebuild and check the hero's generated assets.

    python tools/build_assets.py            # rebuild the model files and posters, then print the size report
    python tools/build_assets.py --report   # only print the size report for what is on disk
    python tools/build_assets.py --no-open  # rebuild, but you open the two pages yourself (the script waits)

What it does
  1. starts serve.py on a free port if this script was not given a running one (--port);
  2. opens tools/model-builder.html?save in your browser, which regenerates the procedural model and
     writes the three .glb files, and waits until they have been rewritten;
  3. opens the page with ?tier=ultra&poster, which re-renders the two poster images, and waits again;
  4. prints every delivered file with its size on disk and its gzip size (what GitHub Pages sends),
     and checks the totals against the budgets below.

No Node.js needed. What this script does NOT do: Draco / Meshopt mesh compression and KTX2 textures.
Those need the glTF-Transform tool, which runs on Node.js; the page already loads such files if an
artist exports them from Blender (see docs/BLENDER_ARTIST_BRIEF.md).

Exit code: 0 = within budget, 1 = over budget, 2 = the rebuild did not finish.
"""
import argparse
import gzip
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "public" / "models"
IMAGES = ROOT / "public" / "assets" / "images"
# In loading order. The first is needed before the scene can be shown; the others stream in after it.
MODEL_FILES = ["mountain-courtyard.glb", "mountain-courtyard-vegetation.glb", "mountain-courtyard-details.glb"]
POSTER_FILES = ["hero-poster.webp", "hero-poster-mobile.webp"]
THREE_JS_KB = 420  # three.js with its add-ons (360) and the two web fonts (60) from their CDNs: measured in the browser, not on disk

# Budgets, in KB as sent over the network (gzip for text and .glb; images are already compressed).
BUDGET = {
    "first view": 2200,   # everything needed before the 3D scene appears: ~2 s on a 9 Mbit/s (4G) link
    "whole page": 6000,   # Plan 2 target: first load of everything <= 6 MB
    "model on disk (MB)": 10,
}


def gz(path: Path) -> int:
    return len(gzip.compress(path.read_bytes(), compresslevel=6))


def kb(n: float) -> str:
    return f"{n / 1024:9.0f} KB"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for(paths, since: float, what: str, timeout: float) -> bool:
    """Wait until every file has been rewritten after `since`."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if all(p.exists() and p.stat().st_mtime > since for p in paths):
            time.sleep(0.5)  # let the last write finish
            return True
        time.sleep(0.5)
    stale = [p.name for p in paths if not (p.exists() and p.stat().st_mtime > since)]
    print(f"  ! timed out waiting for {what}: not rewritten: {', '.join(stale)}")
    return False


def rebuild(port: int | None, open_browser: bool, timeout: float) -> bool:
    server = None
    if port is None:
        port = free_port()
        server = subprocess.Popen([sys.executable, str(ROOT / "serve.py"), "--port", str(port)],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.0)
    base = f"http://localhost:{port}"
    steps = [
        ("model files", f"{base}/tools/model-builder.html?save", [MODELS / f for f in MODEL_FILES]),
        ("poster images", f"{base}/?tier=ultra&poster", [IMAGES / f for f in POSTER_FILES]),
    ]
    try:
        for what, url, paths in steps:
            since = time.time()
            print(f"- {what}: {url}")
            if open_browser:
                webbrowser.open(url)
            else:
                print("  open that address in a browser now")
            if not wait_for(paths, since, what, timeout):
                return False
            print("  done")
        return True
    finally:
        if server:
            server.terminate()


def report() -> bool:
    rows, first, later = [], 0, 0

    def add(group: str, path: Path, wire: int, when: str):
        nonlocal first, later
        rows.append((group, path.relative_to(ROOT).as_posix(), path.stat().st_size, wire, when))
        if when == "first view":
            first += wire
        else:
            later += wire

    missing = [f for f in MODEL_FILES[:1] + POSTER_FILES if not ((MODELS if f.endswith(".glb") else IMAGES) / f).exists()]
    if missing:
        print(f"Missing: {', '.join(missing)} — run without --report to build them.")
        return False

    add("page", ROOT / "index.html", gz(ROOT / "index.html"), "first view")
    for p in sorted((ROOT / "src" / "styles").glob("*.css")):
        add("page", p, gz(p), "first view")
    for p in sorted((ROOT / "src" / "hero").glob("*.js")):
        add("code", p, gz(p), "first view")
    for f in POSTER_FILES[:1]:  # a visitor gets one poster: desktop or mobile
        add("poster", IMAGES / f, (IMAGES / f).stat().st_size, "first view")
    for p in sorted((ROOT / "public" / "assets" / "logos").glob("*.webp")):
        add("logo", p, p.stat().st_size, "first view")
    for i, f in enumerate(MODEL_FILES):
        p = MODELS / f
        if p.exists():
            add("model", p, gz(p), "first view" if i == 0 else "streams in")
    for p in sorted(IMAGES.glob("*.webp")):
        if p.name not in POSTER_FILES:
            add("gallery", p, p.stat().st_size, "on demand")

    print(f"\n{'':10} {'file':52} {'on disk':>12} {'sent':>12}  needed")
    code_disk = code_wire = 0
    for group, name, disk, wire, when in rows:
        if group == "code":  # summarise the many small script files in one line
            code_disk += disk
            code_wire += wire
            continue
        print(f"{group:10} {name:52} {kb(disk)} {kb(wire)}  {when}")
    print(f"{'code':10} {'src/hero/*.js':52} {kb(code_disk)} {kb(code_wire)}  first view")
    print(f"{'library':10} {'three.js + web fonts from CDNs (measured)':52} {'':>12} {THREE_JS_KB:9.0f} KB  first view")

    first_kb = first / 1024 + THREE_JS_KB
    on_demand = sum(w for g, _, _, w, when in rows if when == "on demand") / 1024
    streams = sum(w for g, _, _, w, when in rows if when == "streams in") / 1024
    whole_kb = first_kb + streams + on_demand
    model_mb = sum((MODELS / f).stat().st_size for f in MODEL_FILES if (MODELS / f).exists()) / 1048576
    checks = [
        ("first view", first_kb, BUDGET["first view"], "KB"),
        ("whole page", whole_kb, BUDGET["whole page"], "KB"),
        ("model on disk (MB)", model_mb, BUDGET["model on disk (MB)"], "MB"),
    ]
    print()
    ok = True
    for name, value, limit, unit in checks:
        good = value <= limit
        ok &= good
        print(f"{'PASS' if good else 'OVER'}  {name:20} {value:8.0f} {unit}  (budget {limit} {unit})" if unit == "KB"
              else f"{'PASS' if good else 'OVER'}  {name:20} {value:8.2f} {unit}  (budget {limit} {unit})")
    print(f"      at 9 Mbit/s (typical 4G) the first view is about {first_kb * 8 / 9000:.1f} s of download; "
          f"the forest and details add {streams * 8 / 9000:.1f} s while the scene is already showing.")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description="Rebuild the generated model files and posters, then check sizes against the budgets.")
    ap.add_argument("--report", action="store_true", help="only print the size report")
    ap.add_argument("--no-open", action="store_true", help="do not open a browser; open the printed addresses yourself")
    ap.add_argument("--port", type=int, help="use a serve.py that is already running on this port (it must be this project's current serve.py)")
    ap.add_argument("--timeout", type=float, default=180, help="seconds to wait for each rebuild step (default 180)")
    args = ap.parse_args()
    if not args.report and not rebuild(args.port, not args.no_open, args.timeout):
        return 2
    return 0 if report() else 1


if __name__ == "__main__":
    sys.exit(main())
