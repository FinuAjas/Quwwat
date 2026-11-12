"""Local dev server for the Mountain Courtyard hero.

    python serve.py            # http://localhost:5173
    python serve.py --port 8080

Serves the project folder with correct MIME types (incl. .js modules / .glb / .wasm)
and accepts POST /api/save-model from tools/model-builder.html, writing
public/models/mountain-courtyard.glb.
"""
import argparse
import gzip
import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "public" / "models" / "mountain-courtyard.glb"
MAX_UPLOAD = 80 * 1024 * 1024


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
        if self.path != "/api/save-model":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= MAX_UPLOAD:
            self.send_error(413)
            return
        data = self.rfile.read(length)
        if data[:4] != b"glTF":
            self.send_error(400, "not a GLB")
            return
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        MODEL_PATH.write_bytes(data)
        body = str(MODEL_PATH.relative_to(ROOT)).replace("\\", "/").encode()
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
