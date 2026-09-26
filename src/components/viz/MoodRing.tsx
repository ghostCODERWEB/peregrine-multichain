import { Flame, Snowflake, Activity } from 'lucide-react';

export type Mood = 'hot' | 'normal' | 'quiet';

/** The reading's word, animated to match it: a flickering flame when hot, a steady pulse at normal pace, frost when quiet. */
export function MoodWord({ mood, word, className = '' }: { mood: Mood; word: string; className?: string }) {
  const Icon = mood === 'hot' ? Flame : mood === 'quiet' ? Snowflake : Activity;
  return <span className={`mood mood-${mood} inline-flex items-center gap-1 font-extrabold tracking-[-0.01em] ${className}`}><Icon className="mood-icon h-[1em] w-[1em] shrink-0" aria-hidden /><span className="mood-word">{word}</span></span>;
}

/** A 0–100 reading as a ring whose motion says what the word says: flames when hot, a calm pulse at normal pace, frost when quiet. */
export function MoodRing({ score, mood, word, detail, label, size = 124 }: { score: number; mood: Mood; word: string; detail?: React.ReactNode; label: string; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.round(Math.max(0, Math.min(100, score)));
  const grad = `mood-${mood}`;
  return (
    <div className={`mood mood-${mood} relative flex flex-col items-center text-center`}>
      <div className="mood-ring-box relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${v} of 100, ${word}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90" aria-hidden>
          <defs>
            <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
              {mood === 'hot' ? (<><stop offset="0%" stopColor="#ffd84d" /><stop offset="45%" stopColor="#ff7a1a" /><stop offset="100%" stopColor="#ff2d55" /></>)
                : mood === 'quiet' ? (<><stop offset="0%" stopColor="#e3f6ff" /><stop offset="55%" stopColor="#7cc8ff" /><stop offset="100%" stopColor="#3b82f6" /></>)
                : (<><stop offset="0%" stopColor="#5ef0c0" /><stop offset="100%" stopColor="#1fb58a" /></>)}
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
          <circle className="mood-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${grad})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${((v / 100) * c).toFixed(2)} ${c.toFixed(2)}`} />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="mood-num num font-bold" style={{ fontSize: size * 0.3 }}>{v}</span>
          <span className="mt-1 text-[11px] text-ink-muted">heat</span>
        </span>
      </div>
      <span className="mt-3 text-[11px] uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      <MoodWord mood={mood} word={word} className="mt-0.5 text-[20px]" />
      {detail && <span className="num mt-1 text-[11.5px] text-ink-2">{detail}</span>}
    </div>
  );
}
