'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from 'recharts';

export function TrendChart({
  data,
  target,
  unit,
  kind = 'line',
}: {
  data: { date: string; value: number }[];
  target?: number;
  unit?: string;
  kind?: 'line' | 'bar';
}) {
  const Chart: any = kind === 'bar' ? BarChart : LineChart;
  const Series: any = kind === 'bar' ? Bar : Line;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }}
            tickFormatter={(s: string) => s.slice(5)}
          />
          <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} width={32} />
          <Tooltip
            contentStyle={{
              background: 'rgb(var(--card))',
              border: '1px solid rgb(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: any) => [`${v}${unit ? ' ' + unit : ''}`, 'value']}
          />
          {target ? (
            <ReferenceLine y={target} stroke="rgb(var(--accent))" strokeDasharray="3 3" />
          ) : null}
          <Series
            type="monotone"
            dataKey="value"
            stroke="rgb(var(--accent))"
            fill="rgb(var(--accent))"
            strokeWidth={2}
            dot={false}
          />
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
