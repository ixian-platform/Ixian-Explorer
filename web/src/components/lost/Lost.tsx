'use client';

import type { ReactNode } from 'react';
import { int, duration } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { DemoTag } from '@/components/ui/Demo';
import s from './Lost.module.css';

/** The page frame for anything that isn't there: copy on the left, the instrument that checked it on the right. */
export function Lost({
  eyebrow,
  title,
  lead,
  actions,
  search,
  aside,
}: {
  eyebrow: string;
  title: [string, string];
  lead: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={s.lost}>
      <div className={`ix-container ${s.grid}`}>
        <div className={s.copy}>
          <p className={s.eyebrow}>
            {eyebrow} <DemoTag />
          </p>
          <h1 className={s.h1}>
            {title[0]} <span className={s.h1b}>{title[1]}</span>
          </h1>
          <div className={s.lead}>{lead}</div>
          {actions && <div className={s.actions}>{actions}</div>}
          {search && <div className={s.search}>{search}</div>}
        </div>
        {aside && <div className={s.aside}>{aside}</div>}
      </div>
    </section>
  );
}

export type RowState = 'step' | 'ok' | 'no' | 'wait';

/** One check on the trace: a label, a node on the rail, the value and an optional note. */
export function Row({ k, state = 'step', children, note }: { k: string; state?: RowState; children: ReactNode; note?: ReactNode }) {
  return (
    <li className={s.row} data-state={state}>
      <span className={s.k}>{k}</span>
      <span className={s.node} aria-hidden />
      <div className={s.v}>
        <div className={s.val}>
          {state === 'no' && <Cross />}
          {children}
        </div>
        {note && <small className={s.note}>{note}</small>}
      </div>
    </li>
  );
}

export function Trace({ label, children, top }: { label: string; children: ReactNode; top?: ReactNode }) {
  return (
    <div className={s.card} role="group" aria-label={label}>
      {top}
      <ol className={s.trace}>{children}</ol>
    </div>
  );
}

function Cross() {
  return (
    <svg className={s.cross} viewBox="-8 -8 16 16" width="16" height="16" aria-hidden>
      <circle r="6.5" />
      <path d="M-2.4 -2.4l4.8 4.8M2.4 -2.4l-4.8 4.8" />
    </svg>
  );
}

/** The newest blocks, the gap and the block that isn't made yet, with the time left at the 30 s target. */
export function Ahead({ latest, target, latestAt }: { latest: number; target: number; latestAt: number | null }) {
  const now = useNow(1000);
  const left = Math.max(0, target - latest);
  const secs = latestAt != null && now != null ? Math.max(0, left * 30 - (now - latestAt)) : left * 30;
  const eta = now != null ? new Date((now + secs) * 1000) : null;
  const when = eta
    ? new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(eta)
    : null;
  const recent = [latest - 2, latest - 1, latest].filter((h) => h >= 1);
  return (
    <div className={s.ahead}>
      <div className={s.strip} aria-hidden>
        {recent.map((h) => (
          <span key={h} className={s.blk} data-latest={h === latest || undefined}>
            <b>{int(h).slice(-3)}</b>
          </span>
        ))}
        <span className={s.gap}>
          <i />
          <em>+{int(left - 1)}</em>
          <i />
        </span>
        <span className={s.blk} data-target>
          <b>{int(target).slice(-3)}</b>
        </span>
      </div>
      <p className={s.count}>
        <span className="ix-sr">Time left: </span>
        {secs < 3600 ? clock(secs) : duration(secs)}
      </p>
      <p className={s.countNote}>
        {when ? <>around {when}, your time. </> : null}At one block every 30 seconds, so it can drift.
      </p>
    </div>
  );
}

const clock = (sec: number) => {
  const t = Math.round(sec);
  return `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, '0')} s`;
};
