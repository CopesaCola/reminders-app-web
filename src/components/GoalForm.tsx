'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Goal } from '@/lib/schema';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type GoalType = 'binary' | 'quantitative' | 'milestone';
type Cadence = 'daily' | 'weekly' | 'monthly';

type ExampleGoal = {
  title: string;
  why?: string;
  cadence: Cadence;
  targetValue?: number;
  targetUnit?: string;
};

const TYPE_INFO: Record<GoalType, { blurb: string; goodFor: string; examples: ExampleGoal[] }> = {
  binary: {
    blurb:
      "Yes-or-no per period. One tap on the dashboard counts a check-in. The streak grows each period you do it.",
    goodFor:
      'Habits where any positive count is a win — and "didn\'t do it" should clearly break the streak.',
    examples: [
      { title: 'Meditate', cadence: 'daily', why: 'Calmer days, sharper focus.' },
      { title: 'Take vitamins', cadence: 'daily' },
      {
        title: 'Call a family member',
        cadence: 'weekly',
        why: 'Stay close even when life is busy.',
      },
    ],
  },
  quantitative: {
    blurb:
      'Sum a number across each period; the period counts as "hit" when the total reaches your target. Log multiple entries per period — they add up.',
    goodFor: 'Volume goals where you accumulate progress and want to hit a number.',
    examples: [
      { title: 'Run 20 miles per week', cadence: 'weekly', targetValue: 20, targetUnit: 'miles' },
      {
        title: 'Read 30 minutes per day',
        cadence: 'daily',
        targetValue: 30,
        targetUnit: 'minutes',
      },
      {
        title: 'Write 500 words per day',
        cadence: 'daily',
        targetValue: 500,
        targetUnit: 'words',
      },
    ],
  },
  milestone: {
    blurb:
      "A long-running project with no per-period number. You log when you worked on it; streaks track consistency, not output.",
    goodFor: 'Multi-month projects where any forward motion counts.',
    examples: [
      {
        title: 'Finish writing a novel',
        cadence: 'daily',
        why: 'A page a day adds up to a book in two years.',
      },
      { title: 'Learn Spanish to B2', cadence: 'daily' },
      { title: 'Renovate the kitchen', cadence: 'weekly' },
    ],
  },
};

export function GoalForm({ goal }: { goal?: Goal }) {
  const router = useRouter();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [why, setWhy] = useState(goal?.why ?? '');
  const [type, setType] = useState<GoalType>((goal?.type as GoalType) ?? 'binary');
  const [cadence, setCadence] = useState<Cadence>((goal?.cadence as Cadence) ?? 'daily');
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

  function applyExample(ex: ExampleGoal) {
    setTitle(ex.title);
    if (ex.why) setWhy(ex.why);
    setCadence(ex.cadence);
    setTargetValue(ex.targetValue ?? '');
    setTargetUnit(ex.targetUnit ?? '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const [hh, mm] = time.split(':').map(Number);
    const payload: any = {
      title,
      why: why || null,
      cadence,
      targetValue:
        type === 'quantitative' ? (targetValue === '' ? null : Number(targetValue)) : null,
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

  const info = TYPE_INFO[type];

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

          <div className="mt-3 rounded-lg border border-border bg-muted/5 p-3 space-y-3">
            <p className="text-sm">{info.blurb}</p>
            <p className="text-xs text-muted">
              <span className="font-medium text-fg">Good for:</span> {info.goodFor}
            </p>
            <div>
              <p className="text-xs text-muted mb-1.5">
                Tap an example to fill in the form below:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {info.examples.map((ex) => (
                  <button
                    type="button"
                    key={ex.title}
                    onClick={() => applyExample(ex)}
                    title={
                      ex.targetValue
                        ? `${ex.cadence} · target ${ex.targetValue} ${ex.targetUnit ?? ''}`
                        : ex.cadence
                    }
                    className="px-2.5 py-1 rounded-md border border-border hover:border-accent hover:text-accent text-xs transition-colors"
                  >
                    {ex.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
            <label className="label">
              Target per {cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month'}
            </label>
            <input
              type="number"
              step="any"
              className="input mt-1"
              value={targetValue}
              onChange={(e) =>
                setTargetValue(e.target.value === '' ? '' : Number(e.target.value))
              }
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
