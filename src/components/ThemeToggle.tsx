'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function set(next: 'light' | 'dark') {
    setTheme(next);
    if (next === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try {
      localStorage.setItem('theme', next);
    } catch {}
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex rounded-xl border border-border bg-card-2 p-1"
    >
      {(['light', 'dark'] as const).map((mode) => {
        const Icon = mode === 'light' ? Sun : Moon;
        const active = theme === mode;
        return (
          <button
            key={mode}
            onClick={() => set(mode)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-sm font-medium capitalize transition-colors ${
              active ? 'bg-card text-fg shadow-card' : 'text-muted hover:text-fg'
            }`}
          >
            <Icon size={16} />
            {mode}
          </button>
        );
      })}
    </div>
  );
}
