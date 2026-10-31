import { ClientResponseError } from 'pocketbase'
import { pb } from './client'
import { explainRateLimit, PushDeniedError } from './errors'

export type PushSupport = 'unsupported' | 'needsInstall' | 'ready'

export function pushSupport(): PushSupport {
  if ('PushManager' in globalThis && 'serviceWorker' in navigator) return 'ready'
  // iOS offers push to installed web apps only.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const installed = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
  return ios && !installed ? 'needsInstall' : 'unsupported'
}

async function publicKey(): Promise<string | null> {
  try {
    const { publicKey } = await pb.send<{ publicKey: string }>('/api/push/key', {})
    return publicKey
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 404) return null
    throw err
  }
}

export async function pushAvailable(): Promise<boolean> {
  return (await publicKey()) !== null
}

// Without a registered service worker `ready` never settles, so waiting is bounded.
async function currentSubscription(): Promise<PushSubscription | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), 5000)
  })
  try {
    const registration = await Promise.race([navigator.serviceWorker.ready, timeout])
    return registration ? await registration.pushManager.getSubscription() : null
  } finally {
    clearTimeout(timer)
  }
}

// A browser whose push service is off (Firefox without its connection) cannot read the
// subscription; push is then off here rather than the settings failing to load.
export async function pushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'ready') return false
  try {
    return (await currentSubscription()) !== null
  } catch {
    return false
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function register(subscription: PushSubscription): Promise<void> {
  const { endpoint, keys } = subscription.toJSON()
  await pb.send('/api/push/subscribe', {
    method: 'POST',
    body: { endpoint, p256dh: keys?.p256dh, auth: keys?.auth, deviceLabel: navigator.userAgent },
  })
}

export async function enablePush(): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') throw new PushDeniedError()
  const key = await publicKey()
  if (!key) throw new Error('Push is not set up on the server.')
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) })
  await register(subscription)
}

// Used on logout: the device must stop receiving what belongs to the signed-out user.
export async function disablePush(): Promise<void> {
  try {
    const subscription = await currentSubscription()
    if (!subscription) return
    const { endpoint } = subscription
    await subscription.unsubscribe()
    const row = await pb.collection('push_subscriptions').getFirstListItem(pb.filter('endpoint = {:endpoint}', { endpoint }))
    await pb.collection('push_subscriptions').delete(row.id)
  } catch {
    // The server drops dead subscriptions when a send fails.
  }
}

// Used after login: ties this browser's subscription to the signed-in user.
export async function syncPush(): Promise<void> {
  try {
    if (pushSupport() !== 'ready') return
    const subscription = await currentSubscription()
    if (subscription) await register(subscription)
  } catch {
    // The next login tries again.
  }
}

export async function sendTestPush(): Promise<number> {
  try {
    const { delivered } = await pb.send<{ delivered: number }>('/api/push/test', { method: 'POST' })
    return delivered
  } catch (err) {
    throw explainRateLimit(err)
  }
}
