'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Goal, Entry } from '@/lib/schema';

export function CheckInForm({
  goal,
  todayEntry,
  compact = false,
}: {
  goal: Goal;
  todayEntry?: Entry | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number>(
    todayEntry?.value ?? (goal.type === 'binary' ? 0 : 0)
  );
  const [note, setNote] = useState<string>(todayEntry?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(nextValue?: number) {
    setSaving(true);
    setSaved(false);
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        goalId: goal.id,
        value: nextValue ?? value,
        note: note || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    }
  }

  // One-time todo: completion lives on the goal itself, not in entries.
  if (goal.type === 'todo') {
    const done = goal.completedAt != null;
    return (
      <button
        onClick={async () => {
          setSaving(true);
          const res = await fetch(`/api/goals/${goal.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ completed: !done }),
          });
          setSaving(false);
          if (res.ok) router.refresh();
        }}
        className={done ? 'btn-primary' : 'btn'}
        disabled={saving}
      >
        {done ? '✓ Done' : 'Mark done'}
      </button>
    );
  }

  if (goal.type === 'binary') {
    const done = (todayEntry?.value ?? value) > 0;
    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'flex-col items-stretch'}`}>
        <button
          onClick={() => {
            const next = done ? 0 : 1;
            setValue(next);
            save(next);
          }}
          className={done ? 'btn-primary' : 'btn'}
          disabled={saving}
        >
          {done ? '✓ Done today' : 'Mark done'}
        </button>
        {!compact && (
          <input
            className="input"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => save()}
          />
        )}
      </div>
    );
  }

  if (goal.type === 'quantitative') {
    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'flex-col items-stretch'}`}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="any"
            inputMode="decimal"
            className="input w-28"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
          />
          <span className="text-sm text-muted">{goal.targetUnit ?? ''}</span>
          <button className="btn-primary" onClick={() => save()} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Log'}
          </button>
        </div>
        {!compact && (
          <input
            className="input"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </div>
    );
  }

  // milestone — toggle done for today (e.g. "worked on it")
  return (
    <button
      onClick={() => {
        const next = value > 0 ? 0 : 1;
        setValue(next);
        save(next);
      }}
      className={value > 0 ? 'btn-primary' : 'btn'}
      disabled={saving}
    >
      {value > 0 ? '✓ Worked on it today' : 'Mark worked on'}
    </button>
  );
}
