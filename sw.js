// Only caches named "bg-remover-v..." are cleaned up. The downloaded High quality models live in
// "bg-remover-models" and must never be deleted here.
const CACHE = "bg-remover-v4";

const PRECACHE = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "ort/ort.wasm.min.js",
  "ort/ort-wasm-simd-threaded.mjs",
  "ort/ort-wasm-simd-threaded.wasm",
  "models/u2netp.onnx",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bg-remover-v") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  const heavy = /\/(ort|models|icons)\//.test(new URL(req.url).pathname);
  event.respondWith(heavy ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") {
      const index = await caches.match("index.html");
      if (index) return index;
    }
    throw err;
  }
}