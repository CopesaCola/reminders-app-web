export function ProgressRing({
  value,
  target,
  size = 44,
  stroke = 4,
  label,
}: {
  value: number;
  target: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const pct = target > 0 ? Math.min(value / target, 1) : value > 0 ? 1 : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const done = pct >= 1;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(pct * 100)}% of target`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? 'rgb(var(--ok))' : 'rgb(var(--accent))'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tnum">
        {Math.round(pct * 100)}
      </span>
    </div>
  );
}
