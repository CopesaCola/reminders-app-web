'use client';

import { useEffect } from 'react';

export function PushBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW register failed', e));
  }, []);
  return null;
}
