/**
 * TrafficFlow Service Worker - High-Performance PWA Caching & Offline Engine
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `traffic-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `traffic-dynamic-${CACHE_VERSION}`;
const API_CACHE = `traffic-api-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/screenshots/screenshot-desktop.png',
  '/screenshots/screenshot-mobile.png',
];

// Maximum cached API items & Dynamic items limit
const MAX_DYNAMIC_ENTRIES = 50;

// Helper: Trim cache to avoid storage bloat
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxEntries);
  }
}

// 1. Install Event: Precache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (err) {
        console.warn('[ServiceWorker] Some precache assets failed:', err);
      }
      return self.skipWaiting();
    })()
  );
});

// 2. Activate Event: Invalidate outdated caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => !validCaches.includes(key) || key.includes('v1'))
          .map((key) => caches.delete(key))
      );
      return self.clients.claim();
    })()
  );
});

// 3. Fetch Event Routing Strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip WebSocket connections, non-GET requests, or chrome-extension URLs
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/api/ws') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // During local development, bypass SW caching for HTML navigation & API to prevent hydration divergence
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
      return;
    }
  }

  // Strategy A: HTML Navigation (Network-First with fallback to Cache & /offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            return networkResponse;
          }
        } catch (error) {
          // Network failed, try cache
        }

        // Try matched cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fallback to offline page
        const offlinePage = await caches.match('/offline');
        if (offlinePage) {
          return offlinePage;
        }

        return new Response('Offline - TrafficFlow Dashboard', {
          headers: { 'Content-Type': 'text/plain' },
        });
      })()
    );
    return;
  }

  // Strategy B: API Calls (/api/segments) -> Network-First with Stale Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }
        } catch (error) {
          // Network unavailable
        }

        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Return cached response with custom header indicating offline data
          const headers = new Headers(cachedResponse.headers);
          headers.set('x-sw-cached-data', 'true');
          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            statusText: cachedResponse.statusText,
            headers: headers,
          });
        }

        // Return empty JSON fallback rather than a broken page
        return new Response(JSON.stringify({ success: false, offline: true, data: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })()
    );
    return;
  }

  // Strategy C: Next.js Static Assets & Chunks (/_next/static/*) -> Cache-First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const res = await fetch(request);
          if (res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch (err) {
          return cached || new Response('', { status: 404 });
        }
      })()
    );
    return;
  }

  // Strategy D: Static Public Media, Icons, Fonts, Maps Styles -> Stale-While-Revalidate
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/screenshots/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.includes('maplibre')
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const fetchPromise = fetch(request)
          .then(async (networkRes) => {
            if (networkRes.ok) {
              const cache = await caches.open(DYNAMIC_CACHE);
              cache.put(request, networkRes.clone());
              trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
            }
            return networkRes;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })()
    );
    return;
  }

  // Default: Stale-While-Revalidate with network fallback
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      try {
        const networkRes = await fetch(request);
        if (networkRes.ok) {
          const cache = await caches.open(DYNAMIC_CACHE);
          cache.put(request, networkRes.clone());
        }
        return networkRes;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })()
  );
});

// 4. Message Event Handling (Skip Waiting, Cache Purging)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

// 5. Push Notification Handling
self.addEventListener('push', (event) => {
  let data = { title: 'Traffic Alert', body: 'New incident detected along your routes' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Traffic Alert', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon-32x32.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'view', title: 'View Map' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 6. Notification Click Handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
