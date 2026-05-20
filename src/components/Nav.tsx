'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Target, Settings } from 'lucide-react';

const items = [
  { href: '/', label: 'Today', icon: CalendarCheck },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-border">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-accent-solid text-accent-fg shadow-card">
            <CalendarCheck size={18} strokeWidth={2.5} />
          </span>
          <span className="hidden sm:inline">Goal Tracking</span>
        </Link>
        <div className="flex gap-1">
          {items.map((it) => {
            const active = path === it.href || (it.href !== '/' && path.startsWith(it.href));
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:text-fg hover:bg-card-2'
                }`}
              >
                <Icon size={17} />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
