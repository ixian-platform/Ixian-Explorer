// Serve the static export like a static host: /blocks → blocks.html, unknown → 404.html.
// Used by the end-to-end tests: node scripts/serve-out.mjs [port]; also `npm start`
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'out');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp', '.xml': 'application/xml' };

const exists = async (p) => (await stat(p).catch(() => null))?.isFile() ?? false;

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(ROOT, path), join(ROOT, `${path}.html`), join(ROOT, path, 'index.html')];
  for (const file of candidates) {
    if (file.startsWith(ROOT) && (await exists(file))) {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      return res.end(await readFile(file));
    }
  }
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  res.end(await readFile(join(ROOT, '404.html')).catch(() => 'Not found'));
}).listen(PORT, '127.0.0.1', () => console.log(`out/ on http://127.0.0.1:${PORT}`));
