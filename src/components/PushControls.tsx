'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff, Send, ShieldAlert } from 'lucide-react';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushControls() {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
    );
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const { key } = await fetch('/api/push/public-key').then((r) => r.json());
      if (!key) {
        alert('Server is missing VAPID public key. Set VAPID_PUBLIC_KEY env var.');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await fetch('/api/push/test', { method: 'POST' });
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="flex items-center gap-2 text-sm text-bad">
        <ShieldAlert size={16} />
        This browser doesn&apos;t support push notifications.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            subscribed ? 'bg-ok' : 'bg-muted-2'
          }`}
          aria-hidden
        />
        <span className="text-muted">
          {subscribed ? 'Subscribed on this device' : 'Not subscribed on this device'}
          {permission === 'denied' && ' · blocked in browser settings'}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {!subscribed && (
          <button className="btn-primary" disabled={busy} onClick={enable}>
            <BellRing size={16} />
            Enable push
          </button>
        )}
        {subscribed && (
          <>
            <button className="btn" disabled={busy} onClick={test}>
              <Send size={16} />
              Send test
            </button>
            <button className="btn-danger" disabled={busy} onClick={disable}>
              <BellOff size={16} />
              Unsubscribe
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-muted">
        On iOS, install to your home screen first (Share → Add to Home Screen), then enable push
        from the installed app.
      </p>
    </div>
  );
}
