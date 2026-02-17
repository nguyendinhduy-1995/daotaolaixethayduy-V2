const SW_VERSION = "v1.0.0";
const CACHE_NAME = "thayduy-crm-" + SW_VERSION;

const PRECACHE_URLS = [
    "/dashboard",
    "/login",
    "/offline",
];

const CACHE_FIRST_PATTERNS = [
    /\/_next\/static\//,
    /\/icons\//,
    /\/manifest\.json$/,
    /\.woff2?$/,
    /\.png$/,
    /\.ico$/,
];

const NETWORK_FIRST_PATTERNS = [
    /\/api\//,
    /\/_next\/data\//,
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (key) { return key !== CACHE_NAME; })
                    .map(function (key) { return caches.delete(key); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener("fetch", function (event) {
    var request = event.request;

    if (request.method !== "GET") return;

    var url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // API calls → Network only (no cache)
    if (NETWORK_FIRST_PATTERNS.some(function (p) { return p.test(url.pathname); })) {
        event.respondWith(
            fetch(request).catch(function () {
                return new Response(
                    JSON.stringify({ error: "OFFLINE", message: "Không có kết nối mạng" }),
                    {
                        status: 503,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            })
        );
        return;
    }

    // Static assets → Cache first
    if (CACHE_FIRST_PATTERNS.some(function (p) { return p.test(url.pathname); })) {
        event.respondWith(
            caches.match(request).then(function (cached) {
                if (cached) return cached;
                return fetch(request).then(function (response) {
                    if (response.ok) {
                        var clone = response.clone();
                        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, clone); });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Pages → Stale-while-revalidate
    event.respondWith(
        caches.match(request).then(function (cached) {
            var fetchPromise = fetch(request)
                .then(function (response) {
                    if (response.ok) {
                        var clone = response.clone();
                        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, clone); });
                    }
                    return response;
                })
                .catch(function () {
                    if (cached) return cached;
                    // Offline fallback for navigation
                    if (request.mode === "navigate") {
                        return caches.match("/offline").then(function (offlinePage) {
                            return offlinePage || new Response(
                                "<html><body><h1>Offline</h1><p>Vui lòng kết nối mạng.</p></body></html>",
                                { headers: { "Content-Type": "text/html; charset=utf-8" } }
                            );
                        });
                    }
                    return new Response("", { status: 408 });
                });

            return cached || fetchPromise;
        })
    );
});
