self.addEventListener('push', (event) => {
  const { title, body, url } = event.data.json()
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icons/intern-192.png', data: { url } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data.url
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(([client]) => {
      if (!client) return self.clients.openWindow(url)
      return client.focus().then((focused) => focused.navigate(url))
    }),
  )
})
