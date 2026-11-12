"""Local dev server for the Mountain Courtyard hero.

    python serve.py            # http://localhost:5173
    python serve.py --port 8080

Serves the project folder with correct MIME types (incl. .js modules / .glb / .wasm)
and accepts two uploads from the project's own tools:
  POST /api/save-model            from tools/model-builder.html → public/models/mountain-courtyard.glb
  POST /api/save-image?name=...   from the page opened with ?poster → public/assets/images/<poster>.webp
"""
import argparse
import gzip
import http.server
import socketserver
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "public" / "models" / "mountain-courtyard.glb"
MAX_UPLOAD = 80 * 1024 * 1024
IMAGE_DIR = ROOT / "public" / "assets" / "images"
POSTER_NAMES = {"hero-poster.webp", "hero-poster-mobile.webp"}  # the only images the server will write


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".glb": "model/gltf-binary",
        ".gltf": "model/gltf+json",
        ".wasm": "application/wasm",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # gzip text/binary assets like a production CDN would (the .glb shrinks ~2.5x).
    GZIP_EXT = {".glb", ".js", ".mjs", ".css", ".html", ".svg", ".json", ".gltf"}
    _gz_cache = {}

    def do_GET(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            path = path / "index.html"
        if (path.suffix in self.GZIP_EXT and path.is_file()
                and "gzip" in self.headers.get("Accept-Encoding", "")):
            stat = path.stat()
            key = (str(path), stat.st_mtime_ns)
            body = self._gz_cache.get(key)
            if body is None:
                body = gzip.compress(path.read_bytes(), compresslevel=6)
                self._gz_cache.clear() if len(self._gz_cache) > 64 else None
                self._gz_cache[key] = body
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(path)))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Uncompressed-Length", str(stat.st_size))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        url = urlsplit(self.path)
        if url.path == "/api/save-model":
            target, check = MODEL_PATH, lambda d: d[:4] == b"glTF"
        elif url.path == "/api/save-image":
            name = parse_qs(url.query).get("name", [""])[0]
            if name not in POSTER_NAMES:
                self.send_error(400, "unknown image name")
                return
            target, check = IMAGE_DIR / name, lambda d: d[:4] == b"RIFF" and d[8:12] == b"WEBP"
        else:
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= MAX_UPLOAD:
            self.send_error(413)
            return
        data = self.rfile.read(length)
        if not check(data):
            self.send_error(400, "unexpected file type")
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        body = str(target.relative_to(ROOT)).replace("\\", "/").encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5173)
    args = ap.parse_args()
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", args.port), Handler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{args.port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
