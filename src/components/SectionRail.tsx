'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';

type Mark = { el: HTMLElement; title: string };

// Section headings the rail can jump to: page cards and panels, not nested sub-headings.
const HEADINGS = 'main h2';
const clean = (t: string) => t.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);

/** A compact fast-scroll rail (phones: drag to scrub; desktop: hover to preview, click to jump) on the right edge. One tick per section, the current one longest;
 *  drag or tap to jump, with the section's name floating beside the finger. Fades out when idle. */
export function SectionRail() {
  const path = usePathname();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [awake, setAwake] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const sleep = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Collect headings once the page has streamed in, and again when sections appear later.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      const found = [...document.querySelectorAll<HTMLElement>(HEADINGS)]
        .filter((h) => h.offsetParent !== null && clean(h.textContent ?? '').length > 1)
        .map((h) => ({ el: (h.closest('section, .material') as HTMLElement | null) ?? h, title: clean(h.textContent ?? '') }));
      const seen = new Set<HTMLElement>();
      setMarks(found.filter((m) => (seen.has(m.el) ? false : (seen.add(m.el), true))));
    };
    const soon = () => { clearTimeout(t); t = setTimeout(read, 400); };
    soon();
    const mo = new MutationObserver(soon);
    const main = document.querySelector('main');
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => { clearTimeout(t); mo.disconnect(); };
  }, [path]);

  // Which section is in view, and wake the rail while the page scrolls.
  useEffect(() => {
    if (marks.length < 3) return;
    const onScroll = () => {
      const y = innerHeight * 0.3;
      let i = 0;
      marks.forEach((m, k) => { if (m.el.getBoundingClientRect().top <= y) i = k; });
      setActive(i);
      setAwake(true);
      clearTimeout(sleep.current);
      sleep.current = setTimeout(() => setAwake(false), 1400);
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [marks]);

  const indexAt = useCallback((clientY: number) => {
    const r = rail.current?.getBoundingClientRect();
    if (!r || !marks.length) return 0;
    return Math.max(0, Math.min(marks.length - 1, Math.floor(((clientY - r.top) / r.height) * marks.length)));
  }, [marks.length]);

  const go = useCallback((i: number, smooth: boolean) => {
    const el = marks[i]?.el;
    if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY - 72; // clear the fixed header
    scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }, [marks]);

  if (marks.length < 3) return null;
  const shown = dragging ?? hover ?? active;
  const labelAt = dragging ?? hover;
  const onPointer = (e: React.PointerEvent) => {
    const i = indexAt(e.clientY);
    // Mouse: hovering previews the section name; a click jumps (see the tick's onClick). Touch: drag to scrub.
    if (e.pointerType === 'mouse') { if (e.type === 'pointermove') setHover(i); return; }
    if (e.type === 'pointerdown') { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDragging(i); go(i, false); navigator.vibrate?.(5); }
    else if (dragging != null && i !== dragging) { setDragging(i); go(i, false); navigator.vibrate?.(3); }
  };
  const end = (e: React.PointerEvent) => { if (dragging == null) return; go(indexAt(e.clientY), true); setDragging(null); };

  return (
    <nav aria-label="Jump to section" onPointerLeave={() => setHover(null)} className={`section-rail ${awake || dragging != null || hover != null ? 'is-awake' : ''} ${dragging != null || hover != null ? 'is-dragging' : ''}`}>
      {labelAt != null && (
        <div key={dragging != null ? 'drag' : 'hover'} className="section-rail-label" style={{ top: `${((labelAt + 0.5) / marks.length) * 100}%` }} role="status">
          <span className="section-rail-count">{labelAt + 1}/{marks.length}</span>{marks[labelAt].title}
        </div>
      )}
      <div ref={rail} className="section-rail-track" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={end} onPointerCancel={end}>
        {marks.map((m, i) => {
          const d = Math.abs(i - shown);
          return (
            <button key={i} type="button" tabIndex={-1} aria-label={m.title} aria-current={i === active ? 'true' : undefined}
              className="section-rail-tick" style={{ '--w': d === 0 ? 1 : d === 1 ? 0.64 : 0.41, opacity: d === 0 ? 1 : d === 1 ? 0.6 : 0.35 } as CSSProperties}
              onClick={(e) => { e.preventDefault(); go(i, true); }} />
          );
        })}
      </div>
    </nav>
  );
}
