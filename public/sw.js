const CACHE_NAME = 'v3-partner-v1';
const STATIC_ASSETS = ['/', '/login', '/manifest.json'];

// ── Install: cache static assets ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache strategies ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API routes: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images & fonts: cache-first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|otf)$/i)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push notifications ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'V3 Partners', {
      body: data.body ?? 'Nova notificação',
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      data: { url: data.url ?? '/' },
      tag: data.tag ?? 'v3-notification',
      requireInteraction: false,
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});

// ── Background sync: offline lead submissions ──────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-leads') {
    event.waitUntil(syncOfflineLeads());
  }
});

async function syncOfflineLeads() {
  const db = await openLeadQueue();
  const leads = await getAllLeads(db);
  await Promise.allSettled(
    leads.map(async (lead) => {
      try {
        const res = await fetch('/api/marketplace/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead.data),
        });
        if (res.ok) await deleteLead(db, lead.id);
      } catch {
        // Will retry on next sync
      }
    })
  );
}

// Minimal IndexedDB helpers for the lead queue
function openLeadQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('v3-offline-queue', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('leads', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllLeads(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('leads', 'readonly');
    const req = tx.objectStore('leads').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteLead(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('leads', 'readwrite');
    const req = tx.objectStore('leads').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
