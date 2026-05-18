'use client';

import { addDaysISO, diffDaysISO, localDateStr } from '@/lib/date';

type Cell = { date: string; level: 0 | 1 | 2 | 3 | 4; label?: string };

export function Heatmap({ cells, weeks = 26 }: { cells: Cell[]; weeks?: number }) {
  const today = localDateStr();
  // Align grid: start on the Sunday `weeks*7` days ago.
  const daysBack = weeks * 7;
  const startGuess = addDaysISO(today, -(daysBack - 1));
  const startDow = new Date(startGuess + 'T00:00:00Z').getUTCDay(); // 0 = Sun
  const start = addDaysISO(startGuess, -startDow);

  const byDate = new Map(cells.map((c) => [c.date, c]));
  const totalDays = diffDaysISO(start, today) + 1;
  const grid: (Cell | null)[][] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDaysISO(start, i);
    const col = Math.floor(i / 7);
    const row = i % 7;
    if (!grid[col]) grid[col] = Array(7).fill(null);
    grid[col][row] = byDate.get(d) ?? { date: d, level: 0 };
  }

  const colors = [
    'bg-muted/15',
    'bg-accent/30',
    'bg-accent/55',
    'bg-accent/80',
    'bg-accent',
  ];

  return (
    <div className="flex gap-1 overflow-x-auto py-1">
      {grid.map((col, i) => (
        <div key={i} className="flex flex-col gap-1">
          {col.map((c, j) => (
            <div
              key={j}
              title={c ? `${c.date}${c.label ? ' — ' + c.label : ''}` : ''}
              className={`w-3 h-3 rounded-sm ${c ? colors[c.level] : 'opacity-0'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
