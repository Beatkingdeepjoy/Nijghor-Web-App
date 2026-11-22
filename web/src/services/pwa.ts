// PWA Service Worker Registration Utility

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[PWA] Service Worker registered with scope:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('[PWA] Service Worker registration failed:', err);
    return null;
  }
}

export async function subscribeToWebPush(token: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Get VAPID public key from server
    const vapidRes = await fetch('/api/push/vapid-key');
    const { public_key } = await vapidRes.json();
    if (!public_key) return false;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    });

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sub),
    });

    console.log('[Push] Successfully subscribed to VAPID push pings.');
    return true;
  } catch (err) {
    console.warn('[Push] Subscription failed:', err);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
