// PROXM Service Worker v1.0
// Strategy: Cache-first for static assets, network-first for API

const CACHE_NAME = "proxm-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap",
  "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js",
  "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css",
];

// ── Install: cache static shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.filter(url => url.startsWith("/")));
    })
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: route-based strategy ───────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls — network first, no cache
  if (url.pathname.startsWith("/api/") || url.hostname.includes("livekit")) {
    event.respondWith(fetch(request).catch(() =>
      new Response(JSON.stringify({ ok: false, error: { code: "OFFLINE", message: "No connection" } }), {
        status: 503, headers: { "Content-Type": "application/json" },
      })
    ));
    return;
  }

  // WebSocket — pass through
  if (request.url.startsWith("ws://") || request.url.startsWith("wss://")) return;

  // Mapbox tiles — cache with expiry
  if (url.hostname.includes("mapbox.com")) {
    event.respondWith(
      caches.open("proxm-mapbox").then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => new Response("", { status: 408 }))
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      });
    }).catch(() => caches.match("/index.html"))
  );
});

// ── Push notifications ─────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const { title = "PROXM", body = "New activity nearby", type } = data;

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    vibrate: type === "ping" ? [0, 100, 80, 100, 80, 200] : [100],
    tag: type ?? "general",
    renotify: true,
    silent: false,
    data: { url: data.url ?? "/" },
    actions: type === "ping"
      ? [
          { action: "accept", title: "PING BACK" },
          { action: "dismiss", title: "Pass" },
        ]
      : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.postMessage({ type: "notification_click", url }); }
      else clients.openWindow(url);
    })
  );
});

// ── Background sync (ping queue) ──────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "ping-queue") {
    event.waitUntil(flushPingQueue());
  }
});

async function flushPingQueue() {
  // Read queued pings from IndexedDB and retry
  // Implement with idb-keyval or raw IDB API
  console.log("[sw] flushing ping queue");
}
