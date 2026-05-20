'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import type { Goal, Entry } from '@/lib/schema';

/** Round check toggle used for binary goals, milestones, and todos. */
function CheckToggle({
  done,
  onToggle,
  disabled,
  labelDone,
  labelOpen,
}: {
  done: boolean;
  onToggle: () => void;
  disabled?: boolean;
  labelDone: string;
  labelOpen: string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={done}
      aria-label={done ? labelDone : labelOpen}
      className={`group inline-flex items-center justify-center w-11 h-11 rounded-full border-2 transition-all active:scale-90 disabled:opacity-50 ${
        done
          ? 'bg-accent-solid border-transparent text-accent-fg'
          : 'border-border text-transparent hover:border-accent hover:text-accent'
      }`}
    >
      <Check size={20} strokeWidth={3} className={done ? '' : 'opacity-0 group-hover:opacity-60'} />
    </button>
  );
}

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
  const [value, setValue] = useState<number>(todayEntry?.value ?? 0);
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
      <CheckToggle
        done={done}
        disabled={saving}
        labelDone="Mark not done"
        labelOpen="Mark done"
        onToggle={async () => {
          setSaving(true);
          const res = await fetch(`/api/goals/${goal.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ completed: !done }),
          });
          setSaving(false);
          if (res.ok) router.refresh();
        }}
      />
    );
  }

  if (goal.type === 'binary' || goal.type === 'milestone') {
    const done = (todayEntry?.value ?? value) > 0;
    const labelOpen = goal.type === 'binary' ? 'Mark done' : 'Mark worked on';
    const toggle = (
      <CheckToggle
        done={done}
        disabled={saving}
        labelDone="Undo today"
        labelOpen={labelOpen}
        onToggle={() => {
          const next = done ? 0 : 1;
          setValue(next);
          save(next);
        }}
      />
    );
    if (compact) return toggle;
    return (
      <div className="flex flex-col items-stretch gap-3">
        <div className="flex items-center gap-3">
          {toggle}
          <span className="text-sm text-muted">{done ? 'Done for today' : labelOpen}</span>
        </div>
        <input
          className="input"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => save()}
        />
      </div>
    );
  }

  // quantitative
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'flex-col items-stretch'}`}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          inputMode="decimal"
          aria-label={`Amount${goal.targetUnit ? ' in ' + goal.targetUnit : ''}`}
          className="input w-24 tnum"
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
        />
        {goal.targetUnit && <span className="text-sm text-muted">{goal.targetUnit}</span>}
        <button className="btn-primary" onClick={() => save()} disabled={saving}>
          {saved ? <Check size={16} /> : <Plus size={16} />}
          {saving ? 'Saving…' : saved ? 'Logged' : 'Log'}
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
