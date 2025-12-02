self.addEventListener('push', function(event) {
  console.log('[SW] 🔔 push event received');

  if (!event.data) {
    console.warn('[SW] ❌ no event.data in push');
    return;
  }

  let notification;
  try {
    notification = event.data.json();
    console.log('[SW] ✅ push payload parsed:', notification);
  } catch (e) {
    console.error('[SW] ⚠️ failed to parse push payload as JSON:', e);
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

  console.log('[SW] 📣 calling showNotification with:', { title, options });

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
