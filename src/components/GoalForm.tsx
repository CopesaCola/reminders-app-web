'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Goal } from '@/lib/schema';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function GoalForm({ goal }: { goal?: Goal }) {
  const router = useRouter();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [why, setWhy] = useState(goal?.why ?? '');
  const [type, setType] = useState<'binary' | 'quantitative' | 'milestone'>(
    (goal?.type as any) ?? 'binary'
  );
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>(
    (goal?.cadence as any) ?? 'daily'
  );
  const [targetValue, setTargetValue] = useState<number | ''>(goal?.targetValue ?? '');
  const [targetUnit, setTargetUnit] = useState(goal?.targetUnit ?? '');
  const [time, setTime] = useState(
    goal?.remindAtMinutes != null
      ? `${String(Math.floor(goal.remindAtMinutes / 60)).padStart(2, '0')}:${String(
          goal.remindAtMinutes % 60
        ).padStart(2, '0')}`
      : '20:00'
  );
  const [daysMask, setDaysMask] = useState<number>(goal?.remindDaysMask ?? 0b1111111);
  const [pausedUntil, setPausedUntil] = useState(goal?.pausedUntil ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const [hh, mm] = time.split(':').map(Number);
    const payload: any = {
      title,
      why: why || null,
      cadence,
      targetValue: type === 'quantitative' ? (targetValue === '' ? null : Number(targetValue)) : null,
      targetUnit: type === 'quantitative' ? targetUnit || null : null,
      remindAtMinutes: hh * 60 + mm,
      remindDaysMask: daysMask,
    };
    if (!goal) payload.type = type;
    if (goal) payload.pausedUntil = pausedUntil || null;

    const url = goal ? `/api/goals/${goal.id}` : '/api/goals';
    const method = goal ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const row = await res.json();
      router.push(`/goals/${row.id ?? goal?.id}`);
      router.refresh();
    } else {
      alert('Failed to save');
    }
  }

  async function toggleArchived() {
    if (!goal) return;
    if (!confirm(goal.archivedAt ? 'Restore this goal?' : 'Archive this goal?')) return;
    await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archived: !goal.archivedAt }),
    });
    router.push('/goals');
    router.refresh();
  }

  async function destroy() {
    if (!goal) return;
    if (!confirm('Delete this goal and all entries permanently?')) return;
    await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' });
    router.push('/goals');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Title</label>
        <input
          className="input mt-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Run 20 miles per week"
        />
      </div>
      <div>
        <label className="label">Why does this matter?</label>
        <textarea
          className="input mt-1 min-h-[80px]"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Pinned at the top during check-ins."
        />
      </div>

      {!goal && (
        <div>
          <label className="label">Type</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(['binary', 'quantitative', 'milestone'] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={type === t ? 'btn-primary' : 'btn'}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1">
            {type === 'binary' && 'Did it / didn\'t.'}
            {type === 'quantitative' && 'Sum a value across the period (e.g. miles, pages).'}
            {type === 'milestone' && 'Long project — log when you worked on it.'}
          </p>
        </div>
      )}

      <div>
        <label className="label">Cadence</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {(['daily', 'weekly', 'monthly'] as const).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCadence(c)}
              className={cadence === c ? 'btn-primary' : 'btn'}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {type === 'quantitative' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Target per {cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month'}</label>
            <input
              type="number"
              step="any"
              className="input mt-1"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Unit</label>
            <input
              className="input mt-1"
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="miles / pages / hours"
            />
          </div>
        </div>
      )}

      <div>
        <label className="label">Remind me at</label>
        <input
          type="time"
          className="input mt-1 max-w-[150px]"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <div className="flex gap-1 mt-2">
          {dayLabels.map((d, i) => {
            const bit = 1 << i;
            const on = (daysMask & bit) !== 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDaysMask(daysMask ^ bit)}
                className={`px-2 py-1 rounded text-xs border ${
                  on ? 'bg-accent text-white border-transparent' : 'border-border text-muted'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {goal && (
        <div>
          <label className="label">Paused until (optional)</label>
          <input
            type="date"
            className="input mt-1 max-w-[200px]"
            value={pausedUntil ?? ''}
            onChange={(e) => setPausedUntil(e.target.value)}
          />
          <p className="text-xs text-muted mt-1">
            No reminders during pause, and the streak won't break.
          </p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          {goal && (
            <>
              <button type="button" onClick={toggleArchived} className="btn">
                {goal.archivedAt ? 'Restore' : 'Archive'}
              </button>
              <button type="button" onClick={destroy} className="btn-danger">
                Delete
              </button>
            </>
          )}
        </div>
        <button type="submit" className="btn-primary" disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : goal ? 'Save changes' : 'Create goal'}
        </button>
      </div>
    </form>
  );
}
