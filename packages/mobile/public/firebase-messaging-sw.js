/* CleanOps foreground push registration uses Firebase in the page context.
   Configure Firebase Messaging here before relying on rich background FCM. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }

  const notification = payload.notification || {};
  const title = notification.title || 'CleanOps alert';
  const options = {
    body: notification.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: payload.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
