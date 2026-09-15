/**
 * Static Noah Super World. Assets live in the repo root; this Worker only
 * attaches the same cache / security headers Netlify used to set.
 */
const ALWAYS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function cacheControl(pathname) {
  if (pathname === "/manifest.json") return "public, max-age=3600";
  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/sw.js" ||
    pathname.endsWith(".html") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css")
  ) {
    return "public, max-age=0, must-revalidate";
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    for (const [key, value] of Object.entries(ALWAYS)) {
      headers.set(key, value);
    }
    const cache = cacheControl(url.pathname);
    if (cache) headers.set("Cache-Control", cache);
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};
