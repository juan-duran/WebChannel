self.addEventListener('push', function(event) {
  if (!event.data) return;

  let notification;
  try {
    notification = event.data.json();
  } catch (e) {
    notification = {
      title: 'News Digest',
      body: event.data.text(),
    };
  }

  const title = notification.title || 'News Digest';
  const options = {
    body: notification.body || 'You have new updates',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: notification.data || {},
    tag: notification.tag || 'news-digest',
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
