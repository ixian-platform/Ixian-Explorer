'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Omnibox from './Omnibox';
import s from './Palette.module.css';

const EVT = 'ixiscope:palette';
export const openPalette = () => window.dispatchEvent(new CustomEvent(EVT));

/**
 * The ⌘K / Ctrl-K palette (also "/"): the omnibox in a dialog, with recent
 * searches and page shortcuts. Focus is trapped while open and returns to
 * where it was on close.
 */
export default function Palette() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    const onOpen = () => {
      back.current = document.activeElement as HTMLElement;
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) setOpen(false);
        else onOpen();
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener(EVT, onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(EVT, onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      back.current?.focus?.();
      return;
    }
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className={s.scrim} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div ref={panel} className={s.panel} role="dialog" aria-modal="true" aria-label="Search">
        <Omnibox autoFocus showJumps onNavigate={() => setOpen(false)} />
        <p className={s.foot}>
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to choose
          </span>
          <span>
            <kbd>Enter</kbd> to open
          </span>
          <span>
            <kbd>Esc</kbd> to close
          </span>
        </p>
      </div>
    </div>
  );
}
