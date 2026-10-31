const fallbackUrl = '/material'

function parsePayload(data) {
  try {
    const { title, body, url } = data.json()
    return { title: title || 'FF Intern', body: body || '', url }
  } catch {
    return { title: 'FF Intern', body: '', url: fallbackUrl }
  }
}

// Only same-origin targets are followed; anything else falls back to the due list.
function safeUrl(url) {
  try {
    if (typeof url !== 'string') throw new TypeError('missing url')
    const target = new URL(url, self.location.origin)
    return target.origin === self.location.origin ? target.href : new URL(fallbackUrl, self.location.origin).href
  } catch {
    return new URL(fallbackUrl, self.location.origin).href
  }
}

self.addEventListener('push', (event) => {
  const { title, body, url } = parsePayload(event.data)
  // A push must always show a notification, or browsers may revoke the subscription.
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icons/intern-192.png', data: { url } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = safeUrl(event.notification.data?.url)
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(([client]) => {
        if (!client) return self.clients.openWindow(url)
        return client
          .focus()
          .then((focused) => focused.navigate(url))
          .then((navigated) => navigated ?? self.clients.openWindow(url))
          .catch(() => self.clients.openWindow(url))
      }),
  )
})
