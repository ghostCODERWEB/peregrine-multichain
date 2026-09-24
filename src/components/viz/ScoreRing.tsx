/** A 0–100 score as a ring with the number in the middle. The arc fills
 *  clockwise from the top; `color` is a CSS color or var(). */
export function ScoreRing({ score, size = 64, stroke = 6, color, label, sublabel }: {
  score: number; size?: number; stroke?: number; color: string; label?: string; sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Score'} ${Math.round(v)} of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} style={{ filter: `drop-shadow(0 0 ${stroke}px color-mix(in oklab, ${color} 45%, transparent))` }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="num font-semibold text-ink" style={{ fontSize: size * 0.3 }}>{Math.round(v)}</span>
        {sublabel && <span className="mt-0.5 text-ink-muted" style={{ fontSize: Math.max(8, size * 0.12) }}>{sublabel}</span>}
      </span>
    </div>
  );
}
