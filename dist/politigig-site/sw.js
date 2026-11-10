/* Offline cache for the Politigig app shell and election data. */
const CACHE = "politigig-v13";
const ASSETS = [
  "./", "index.html", "styles.css", "manifest.webmanifest", "icons/mark-256.png", "icons/logo-wordmark.png", "icons/icon-192.png",
  "js/app.js", "js/elections-meta.js",
  "vendor/d3.min.js", "vendor/topojson-client.min.js", "vendor/chart.umd.min.js",
  "data/results.json", "data/counties-albers-10m.json", "data/governors.json", "data/oklahoma-2026.json", "data/oklahoma-history.json", "data/oklahoma-years.json", "data/oklahoma-local.json"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never intercept app.politigig.com
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
