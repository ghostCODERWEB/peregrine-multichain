'use client';
import { Sparkles } from 'lucide-react';

/** The floating "Analyze with Nansen" button: shown by the launcher before the panel has loaded, and by the panel while closed. */
export function AnalyzeButton({ onClick, onPointerEnter }: { onClick: () => void; onPointerEnter?: () => void }) {
  return (
    <button type="button" data-analyze-dock onClick={onClick} onPointerEnter={onPointerEnter} aria-label="Analyze with Nansen (⌘J)"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] right-3 z-50 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,#1fe0a3_45%,var(--hair))] bg-[var(--surface-2)] p-3 text-[13px] sm:px-4 sm:py-2.5 font-bold text-ink analyze-glow transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-6">
      <Sparkles className="analyze-glow-icon h-4 w-4 text-[#1fe0a3]" aria-hidden /><span className="hidden sm:inline">Analyze with Nansen</span>
      <span className="kbd !hidden lg:!inline">⌘J</span>
    </button>
  );
}
