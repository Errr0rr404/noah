// Fails when the asset version strings drift apart.
// index.html query strings, sw.js PRECACHE and the sw.js CACHE name must agree.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const versions = new Map();
const note = (where, v) => { if (!versions.has(v)) versions.set(v, []); versions.get(v).push(where); };
for (const m of html.matchAll(/(?:href|src)="([^"]+\.(?:css|js))\?v=(\d+)"/g)) note(`index.html ${m[1]}`, m[2]);
for (const m of sw.matchAll(/'\.\/[^']+\.(?:css|js)\?v=(\d+)'/g)) note(`sw.js precache`, m[1]);
const cache = sw.match(/const CACHE = '[^']*-v(\d+)'/);
if (!cache) { console.error('sw.js: CACHE name has no -vN suffix'); process.exit(1); }
note('sw.js CACHE name', cache[1]);
// every versioned file in index.html must be precached with the same query string
const missing = [...html.matchAll(/(?:href|src)="(([^"]+\.(?:css|js))\?v=\d+)"/g)]
  .filter((m) => !sw.includes(`'./${m[1]}'`)).map((m) => m[1]);
if (missing.length) { console.error('not precached in sw.js:', missing.join(', ')); process.exit(1); }
if (versions.size !== 1) {
  console.error('version drift:'); for (const [v, w] of versions) console.error(` v${v}: ${[...new Set(w)].join('; ')}`);
  process.exit(1);
}
console.log(`ok: all assets at v${[...versions.keys()][0]}`);
