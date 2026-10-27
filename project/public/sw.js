/* Jalaram Real Estate — service worker for "new property" browser notifications. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Jalaram Real Estate', {
      body: data.body || 'A new property has been listed.',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      image: data.image || undefined,
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only ever open pages on this site.
  let target = new URL('/', self.location.origin);
  try {
    const candidate = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch (e) {
    /* keep homepage */
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === target.href && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target.href);
    })
  );
});
