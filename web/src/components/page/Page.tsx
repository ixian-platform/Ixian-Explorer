import type { ReactNode } from 'react';
import s from './Page.module.css';

/** Page header: eyebrow, title, a meta line and actions on the right. */
export function PageHead({
  eyebrow,
  title,
  meta,
  actions,
  children,
  mono = false,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  mono?: boolean;
}) {
  return (
    <header className={s.head}>
      <div className={s.headMain}>
        {eyebrow && <div className={s.eyebrow}>{eyebrow}</div>}
        <h1 className={mono ? s.titleMono : s.title}>{title}</h1>
        {meta && <div className={s.meta}>{meta}</div>}
        {children}
      </div>
      {actions && <div className={s.actions}>{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  id,
  aside,
  children,
  lead,
}: {
  title: ReactNode;
  id?: string;
  aside?: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={s.section} id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className={s.sectionHead}>
        <div>
          <h2 className={s.h2} id={id ? `${id}-h` : undefined}>
            {title}
          </h2>
          {lead && <p className={s.lead}>{lead}</p>}
        </div>
        {aside && <div className={s.aside}>{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** A hairline grid of figures. */
export function Figures({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  return (
    <dl className={s.figs} data-cols={cols}>
      {children}
    </dl>
  );
}

export type MetricKey = 'time' | 'tx' | 'signers' | 'difficulty' | 'ixi' | 'dlt' | 's2';

export function Fig({ k, v, sub, title, mark }: { k: ReactNode; v: ReactNode; sub?: ReactNode; title?: string; mark?: MetricKey }) {
  return (
    <div className={s.fig}>
      <dt className={s.figK}>
        {mark && <i className="ix-key" data-m={mark} aria-hidden />}
        {k}
      </dt>
      <dd className={s.figV} title={title}>
        {v}
      </dd>
      {sub && <dd className={s.figSub}>{sub}</dd>}
    </div>
  );
}

/** Folded technical details ("readable first, raw second"). */
export function Raw({ title = 'Technical details', children, open = false }: { title?: string; children: ReactNode; open?: boolean }) {
  return (
    <details className={s.raw} open={open}>
      <summary className={s.rawSum}>
        <span>{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className={s.rawChev}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className={s.rawBody}>{children}</div>
    </details>
  );
}
