'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Today' },
  { href: '/goals', label: 'Goals' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 bg-bg/80 backdrop-blur border-b border-border">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          Goal Tracking
        </Link>
        <div className="flex gap-1">
          {items.map((it) => {
            const active = path === it.href || (it.href !== '/' && path.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  active ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg'
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
