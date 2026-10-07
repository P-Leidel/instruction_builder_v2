// The build writer versions this cache and lists every emitted asset,
// including lazy PDF chunks, so first-use exports work after going offline.
const CACHE_NAME = "instruction-builder-v2-development";
const CACHE_PREFIX = "instruction-builder-";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch("/offline-assets.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Offline asset manifest could not be loaded");
    const manifest = await response.json();
    if (manifest.cacheName !== CACHE_NAME) throw new Error("Offline assets belong to a different build");
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(manifest.assets);
    // Updates wait until the previous worker's tabs close. Forcing immediate
    // activation would delete lazy export chunks still needed by those tabs.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Routing policy, kept separate from the fetch handler's execution
 * mechanics below (a 2026-09-14 architecture review's own distinction -
 * see docs/known-issues.md) - a pure function of a `Request`'s own
 * properties, with no `self`/`caches`/`event` access, so the decision
 * itself is easy to reason about (and to hand-check against a plain
 * `Request` in a console) independent of the clone/waitUntil mechanics
 * that actually carry it out.
 *
 * - "passthrough": let the browser handle this one natively, untouched.
 * - "network-first": try the network, falling back to the cache.
 * - "cache-first": try the cache, falling back to the network.
 */
function chooseStrategy(request) {
  // Only same-origin GET requests are ever handled - anything else (a
  // POST, a cross-origin font/API call) passes straight through untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return "passthrough";
  }

  // Navigations (loading/reloading the page itself): network-first, so an
  // online user always gets the current build, falling back to whatever
  // was last cached (the SPA shell at "/") once offline.
  if (request.mode === "navigate") {
    return "network-first";
  }

  // Everything else (hashed JS/CSS bundles, the manifest, icons): cache-first
  // - a hashed filename never changes meaning once built, so a cache hit is
  // never stale.
  return "cache-first";
}

// Caches a response as a side effect of returning it - two things about
// *when* each step happens matter here, not just what they do. `.clone()`
// must happen synchronously, before this function returns, or it throws
// ("Response body is already used") the moment the original response's
// body has started being read elsewhere - which happens almost immediately
// once `event.respondWith` hands it to the page. And writing that clone to
// the cache has to be wrapped in `event.waitUntil`, since a fetch event's
// own promise (the one passed to `respondWith`) is the only thing the
// browser actually guarantees to wait for - without `waitUntil`, the SW can
// be freed before the cache write's own `.then()` chain finishes, silently
// dropping it.
function cachePut(event, request, response) {
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
  }
  return response;
}

// Reloads can supply only-if-cached with cors/navigate modes, a combination
// fetch() refuses. Keep cache lookup working; normalize only the network
// attempt instead of bypassing the worker and breaking offline reloads.
function fetchNetwork(request) {
  return fetch(request.cache === "only-if-cached" && request.mode !== "same-origin"
    ? new Request(request, { cache: "default" })
    : request);
}

function matchCached(request) {
  // Public build assets are identical for every same-origin request. Hosts
  // may add Vary: Origin, while install-time and page requests carry
  // different Origin headers. That must not make precached assets miss.
  const isBuildAsset = /^\/(assets|icons|fonts)\//.test(new URL(request.url).pathname);
  return caches.match(request, { ignoreVary: isBuildAsset });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = chooseStrategy(request);

  if (strategy === "passthrough") return;

  if (strategy === "network-first") {
    event.respondWith(
      fetchNetwork(request)
        .then((response) => cachePut(event, request, response))
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    matchCached(request)
      .then((cached) => cached ?? fetchNetwork(request).then((response) => cachePut(event, request, response))),
  );
});
