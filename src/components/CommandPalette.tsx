'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type GoalLite = { id: number; title: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [goals, setGoals] = useState<GoalLite[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isModK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') setOpen(false);
      if (!open && (e.target as HTMLElement | null)?.tagName !== 'INPUT' && (e.target as HTMLElement | null)?.tagName !== 'TEXTAREA') {
        if (e.key === 'n') router.push('/goals/new');
        if (e.key === 'g') router.push('/goals');
        if (e.key === '?') setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, router]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/goals')
      .then((r) => r.json())
      .then((rows) => setGoals(rows.map((g: any) => ({ id: g.id, title: g.title }))))
      .catch(() => {});
    setQ('');
    setIdx(0);
  }, [open]);

  const actions = useMemo(() => {
    const base = [
      { id: 'home', label: 'Today (dashboard)', run: () => router.push('/') },
      { id: 'goals', label: 'All goals', run: () => router.push('/goals') },
      { id: 'new', label: 'New goal', run: () => router.push('/goals/new') },
      { id: 'settings', label: 'Settings', run: () => router.push('/settings') },
      { id: 'export-json', label: 'Export JSON', run: () => (window.location.href = '/api/export?format=json') },
      { id: 'export-csv', label: 'Export CSV', run: () => (window.location.href = '/api/export?format=csv') },
    ];
    const goalItems = goals.map((g) => ({
      id: `goal-${g.id}`,
      label: `Goal: ${g.title}`,
      run: () => router.push(`/goals/${g.id}`),
    }));
    const items = [...base, ...goalItems];
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(needle));
  }, [q, goals, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24 px-4"
      onClick={() => setOpen(false)}
    >
      <div className="card w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="w-full px-4 py-3 bg-transparent outline-none border-b border-border"
          placeholder="Type a command or goal…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, actions.length - 1));
            if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0));
            if (e.key === 'Enter') {
              actions[idx]?.run();
              setOpen(false);
            }
          }}
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {actions.length === 0 && <li className="px-4 py-3 text-sm text-muted">No matches</li>}
          {actions.map((a, i) => (
            <li
              key={a.id}
              className={`px-4 py-2 cursor-pointer ${i === idx ? 'bg-accent/10' : ''}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                a.run();
                setOpen(false);
              }}
            >
              {a.label}
            </li>
          ))}
        </ul>
        <div className="px-4 py-2 text-xs text-muted border-t border-border flex justify-between">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span>n = new goal · g = goals</span>
        </div>
      </div>
    </div>
  );
}
