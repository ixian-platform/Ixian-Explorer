'use client';

import { useEffect, useRef, useState } from 'react';
import { links } from '@/lib/links';
import { forgetAll, recentList } from '@/lib/search';
import { markNoticeSeen, noticeSeen } from '@/lib/notice';
import s from './PrivacyNotice.module.css';

/* ------------------------------------------------------------------------
   Privacy notice: a small sharp card in the lower left, never a wall (the
   page stays usable behind it). First visit: one line and one "OK". Later,
   "Privacy settings" in the footer reopens it as a panel listing what this
   browser keeps, with a way to clear recent searches.
   ------------------------------------------------------------------------ */

type Mode = 'hidden' | 'notice' | 'settings';

export default function PrivacyNotice() {
  const [mode, setMode] = useState<Mode>('hidden');
  const [recent, setRecent] = useState(0);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // first visit: a moment after the page settles, so it never competes with the first paint
    const t = noticeSeen() ? 0 : window.setTimeout(() => setMode('notice'), 1400);
    const open = () => {
      setRecent(recentList().length);
      setMode('settings');
    };
    window.addEventListener('ixs-notice-open', open);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('ixs-notice-open', open);
    };
  }, []);

  useEffect(() => {
    if (mode === 'settings') card.current?.focus();
    if (mode === 'hidden') return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'settings') setMode('hidden');
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [mode]);

  if (mode === 'hidden') return null;

  const ok = () => {
    markNoticeSeen();
    setMode('hidden');
  };

  return (
    <div ref={card} className={s.card} role="region" aria-label="Privacy" tabIndex={-1} data-mode={mode}>
      <p className={s.eyebrow}>Privacy</p>
      {mode === 'notice' ? (
        <p className={s.text}>No cookies and no tracking here. Your theme and recent searches are kept in this browser only.</p>
      ) : (
        <ul className={s.rows}>
          <li>
            <span className={s.rowText}>
              <b>Cookies and tracking</b>
              <span>None. No analytics and no third-party requests.</span>
            </span>
          </li>
          <li>
            <span className={s.rowText}>
              <b>Kept in this browser</b>
              <span>Your light or dark theme, your recent searches, and that you have seen this card.</span>
            </span>
            <button
              type="button"
              className={s.small}
              disabled={recent === 0}
              onClick={() => {
                forgetAll();
                setRecent(0);
              }}
            >
              {recent === 0 ? 'No searches' : 'Clear searches'}
            </button>
          </li>
        </ul>
      )}
      <div className={s.actions}>
        <button type="button" className={s.btn} data-main onClick={ok}>
          OK
        </button>
        <a href={links.cookies} target="_blank" rel="noreferrer" className={s.more}>
          What this means
        </a>
      </div>
    </div>
  );
}
