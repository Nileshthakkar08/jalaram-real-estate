'use client';

import { api } from '@/lib/api';

/** Browser push for "new property" alerts. Subscriptions are anonymous. */

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

let keyPromise: Promise<string | null> | null = null;
export function getPushPublicKey(): Promise<string | null> {
  keyPromise ??= api.get<{ data: { enabled: boolean; public_key: string | null } }>('/push/public-key')
    .then((r) => (r.data.enabled ? r.data.public_key : null))
    .catch(() => {
      keyPromise = null;
      return null;
    });
  return keyPromise;
}

async function saveSubscription(subscription: PushSubscription) {
  const encodings = (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings ?? [];
  await api.post('/push/subscriptions', {
    ...subscription.toJSON(),
    contentEncoding: encodings.includes('aes128gcm') ? 'aes128gcm' : 'aesgcm',
  });
}

/** Subscribe after permission is granted, replacing a subscription made with an old server key. */
async function ensureSubscribed(publicKey: string): Promise<void> {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const key = base64UrlToBytes(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await saveSubscription(subscription);
}

/** Asks for permission (must be called from a click) and subscribes. */
export async function enablePush(): Promise<'subscribed' | 'denied' | 'unavailable'> {
  if (!pushSupported()) return 'unavailable';
  const publicKey = await getPushPublicKey();
  if (!publicKey) return 'unavailable';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  await ensureSubscribed(publicKey);
  return 'subscribed';
}

/** For visitors who already allowed notifications: keep the server's copy of their subscription current. */
export async function refreshPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const publicKey = await getPushPublicKey();
  if (publicKey) await ensureSubscribed(publicKey);
}
