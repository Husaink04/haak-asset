const CACHE_VERSION = "v3";
const STATIC_CACHE = `haak-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `haak-runtime-${CACHE_VERSION}`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/haak-logo-transparent.png",
  "/icons/favicon-192.png",
  "/icons/favicon-512.png"
];

function isApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.href.includes(":4000/api/");
}

function isCacheable(response) {
  return response && (response.ok || response.type === "opaque");
}

async function putCache(cacheName, request, response) {
  if (!isCacheable(response)) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return putCache(RUNTIME_CACHE, request, response);
  } catch {
    return (await caches.match(request)) || caches.match("/index.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return putCache(RUNTIME_CACHE, request, response);
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then((response) => putCache(RUNTIME_CACHE, request, response))
    .catch(() => undefined);
  return cached || refresh || caches.match("/index.html");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/uploads/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
