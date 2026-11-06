#!/usr/bin/env python3
"""Visor local: python3 serve.py [--port 8765]. Sin dependencias Python."""
import argparse
import hashlib
import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
VIEWER = ROOT / 'viewer'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route == '/api/revision':
            digest = hashlib.sha256()
            # Content hashes also detect additions, removals and atomic editor saves.
            paths = list(ROOT.glob('*/*.md')) + list(VIEWER.glob('*.js')) + list(VIEWER.glob('*.css')) + list(VIEWER.glob('*.html'))
            for path in sorted(paths):
                if path.is_symlink() or path.parent.is_symlink():
                    continue
                try:
                    digest.update(str(path.relative_to(ROOT)).encode())
                    digest.update(path.read_bytes())
                except FileNotFoundError:
                    continue
            payload = json.dumps(dict(enabled=self.server.live_reload, revision=digest.hexdigest())).encode()
            return self.send_content(payload, 'application/json; charset=utf-8')
        if route == '/api/profiles':
            profiles = []
            for path in ROOT.glob('*/info.md'):
                if path.is_symlink() or path.parent.is_symlink():
                    continue
                content = path.read_text(encoding='utf-8')
                title = re.search(r'^#\s+(.+)$', content, re.M)
                name = title.group(1) if title else path.parent.name.replace('_', ' ').title()
                name = re.sub(r'\s*—\s*contexto para agentes.*$', '', name)
                profiles.append(dict(id=path.parent.name, name=name, content=content))
            payload = json.dumps(sorted(profiles, key=lambda p: p['name'].casefold()), ensure_ascii=False).encode()
            return self.send_content(payload, 'application/json; charset=utf-8')
        relative = route.lstrip('/') or 'index.html'
        # Only interface assets and files inside profile folders are served.
        path = (VIEWER / relative).resolve()
        allowed = path.is_relative_to(VIEWER.resolve()) and path.is_file()
        if not allowed:
            path = (ROOT / relative).resolve()
            parts = Path(relative).parts
            allowed = (len(parts) >= 2 and not any(p.startswith('.') for p in parts)
                       and path.is_relative_to(ROOT) and (ROOT / parts[0] / 'info.md').is_file()
                       and path.is_file() and path.suffix.lower() in {'.md', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'})
        if not allowed:
            self.send_error(404, 'Archivo no encontrado')
            return
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        if path.suffix == '.md':
            mime = 'text/plain; charset=utf-8'
        self.send_content(path.read_bytes(), mime)

    def send_content(self, payload, mime):
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(payload)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--reload', action='store_true', help='Recarga el navegador al cambiar Markdown o interfaz')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.live_reload = args.reload
    print(f'Perfiles · http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
