'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { isDemo } from '@/data/source';
import s from './Demo.module.css';

export const DEMO_LINE = 'Generated demo data: not connected to the Ixian network yet.';

/** The persistent header marker. A calm chip that explains itself on click or focus. */
export function DemoChip({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  if (!isDemo()) return null;
  return (
    <div className={s.wrap} ref={wrap}>
      <button
        ref={btn}
        type="button"
        className={s.chip}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <DemoGlyph />
        <span className={compact ? s.short : undefined}>{compact ? 'Demo' : 'Demo data'}</span>
      </button>
      <div id={id} role="note" className={s.pop} hidden={!open}>
        <p className={s.popTitle}>You are looking at demo data</p>
        <p className={s.popBody}>
          ixiscope is not connected to the Ixian network yet. Every block, transaction, address and node here is generated
          from a fixed seed, so it behaves like the real thing but none of it is real.
        </p>
        <p className={s.popBody}>Numbers marked with the demo tag switch to live values once ixiscope is connected to the explorer.</p>
      </div>
    </div>
  );
}

/** A small square-in-square glyph: "sample", not "warning". */
export function DemoGlyph() {
  return (
    <svg className={s.glyph} width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" />
      <rect x="4" y="4" width="4" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/**
 * A live indicator. With demo data it always carries the demo tag; with real
 * data it reads "Live". `paused` shows a paused state (hover-to-pause feeds).
 */
export function LiveBadge({ label = 'Streaming', paused = false }: { label?: string; paused?: boolean }) {
  const demo = isDemo();
  return (
    <span className={s.live} data-paused={paused || undefined}>
      <i className={s.dot} aria-hidden />
      <span>{paused ? 'Paused' : demo ? label : 'Live'}</span>
      {demo && (
        <span className={s.tag}>
          <DemoGlyph />
          Demo
        </span>
      )}
    </span>
  );
}

/** Inline tag for any single figure that would otherwise read as live. */
export function DemoTag() {
  if (!isDemo()) return null;
  return (
    <span className={s.tag} title={DEMO_LINE}>
      <DemoGlyph />
      Demo
    </span>
  );
}
