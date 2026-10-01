'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Amount as AmountT, TxType } from '@/data/types';
import { ago, middle, splitAmount, utc, TX_TYPE_LABEL } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import Icon from '@/components/Icon';
import s from './ui.module.css';

/* ------------------------------------------------------------------ copy */

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ value, label = 'Copy', className, text }: { value: string; label?: string; className?: string; text?: string }) {
  const [done, setDone] = useState<null | boolean>(null);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={text ? `ix-btn ix-btn--sm ${className ?? ''}` : `${s.iconBtn} ${className ?? ''}`}
      onClick={async () => {
        const ok = await copyText(value);
        setDone(ok);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setDone(null), 1600);
      }}
      aria-label={label}
      title={label}
    >
      <Icon name={done ? 'check' : 'copy'} size={text ? 14 : 15} />
      {text && <span aria-hidden>{done ? 'Copied' : text}</span>}
      <span className="ix-sr" aria-live="polite">
        {done === true ? 'Copied' : done === false ? 'Copy failed' : ''}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ hash */

/**
 * A hash, txid or address: middle-truncated by default, expands in place,
 * copies in full. Mono only here, per the design rules.
 */
export function Hash({
  value,
  href,
  head = 10,
  tail = 8,
  expandable = true,
  copy = true,
  full = false,
  className,
}: {
  value: string;
  href?: string;
  head?: number;
  tail?: number;
  expandable?: boolean;
  copy?: boolean;
  /** start expanded */
  full?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(full);
  const short = middle(value, head, tail);
  const truncated = short !== value;
  const text = open || !truncated ? value : short;
  const body = href ? (
    <Link href={href} className={s.hashLink} title={value}>
      {text}
    </Link>
  ) : (
    <span title={value}>{text}</span>
  );
  return (
    <span className={`${s.hash} ${className ?? ''}`} data-open={open || undefined}>
      <span className={`ix-mono ${s.hashText}`}>
        {body}
        {!open && truncated && <span className="ix-sr">{value}</span>}
      </span>
      {expandable && truncated && (
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Shorten' : 'Show in full'}
          title={open ? 'Shorten' : 'Show in full'}
          aria-expanded={open}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            {open ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      )}
      {copy && <CopyButton value={value} label="Copy" />}
    </span>
  );
}

/* ---------------------------------------------------------------- amount */

/** IXI amount, exact from the decimal string; trailing zeros dimmed. */
export function Amount({
  value,
  decimals = 8,
  unit = true,
  signed = false,
  trim = false,
  className,
}: {
  value: AmountT;
  decimals?: number;
  unit?: boolean;
  signed?: boolean;
  /** drop trailing zeros instead of dimming them (headline figures) */
  trim?: boolean;
  className?: string;
}) {
  const p = splitAmount(value, decimals);
  const sign = p.sign ? '−' : signed && value !== '0' && !/^0\.?0*$/.test(value) ? '+' : '';
  return (
    <span className={`${s.amount} ix-num ${className ?? ''}`} data-flow={signed && sign ? (sign === '+' ? 'in' : 'out') : undefined}>
      {sign && <span className={s.sign}>{sign}</span>}
      {p.whole}
      {(() => {
        // the first two decimals read at full strength; the rest is quieter
        const digits = p.frac + (trim ? '' : p.zeros);
        if (!digits) return null;
        const head = digits.slice(0, 2);
        const tail = digits.slice(2);
        const headZero = !p.frac;
        return (
          <>
            <span className={headZero ? s.zeros : undefined}>.{head}</span>
            {tail && <span className={s.zeros}>{tail}</span>}
          </>
        );
      })()}
      {unit && <span className={s.unit}> IXI</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ time */

/** Relative time that ticks, with the absolute UTC time alongside or on hover. */
export function Time({ ts, mode = 'rel' }: { ts: number; mode?: 'rel' | 'both' }) {
  const now = useNow(1000);
  const abs = utc(ts);
  const rel = now == null ? '' : ago(ts, now);
  if (mode === 'both') {
    return (
      <span className={s.timeBoth}>
        <time dateTime={new Date(ts * 1000).toISOString()}>{rel || abs}</time>
        {rel && <span className={s.timeAbs}>{abs}</span>}
      </span>
    );
  }
  return (
    <time className={s.time} dateTime={new Date(ts * 1000).toISOString()} title={abs}>
      {rel || abs}
    </time>
  );
}

/* --------------------------------------------------------------- type chip */

export function TypeChip({ type }: { type: TxType }) {
  return (
    <span className={s.type} data-type={type}>
      <i className={s.typeMark} aria-hidden />
      {TX_TYPE_LABEL[type]}
    </span>
  );
}

/* ---------------------------------------------------------------- states */

export function Skel({ w = '100%', h = 14, className }: { w?: number | string; h?: number | string; className?: string }) {
  return <span className={`ix-skel ${className ?? ''}`} style={{ width: w, height: h }} aria-hidden />;
}

export function StateBox({
  kind,
  title,
  children,
  action,
  heading,
}: {
  kind: 'empty' | 'error' | 'notfound';
  title: string;
  /** render the title as the page's h1 (a page whose only content is this box) */
  heading?: boolean;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={s.state} data-kind={kind} role={kind === 'error' ? 'alert' : undefined}>
      <StateGlyph kind={kind} />
      {heading ? <h1 className={s.stateTitle}>{title}</h1> : <p className={s.stateTitle}>{title}</p>}
      {children && <div className={s.stateBody}>{children}</div>}
      {action && <div className={s.stateAction}>{action}</div>}
    </div>
  );
}

function StateGlyph({ kind }: { kind: 'empty' | 'error' | 'notfound' }) {
  return (
    <svg className={s.stateGlyph} width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="39" height="39" rx="3" stroke="var(--ix-line-2)" />
      {kind === 'empty' && <path d="M12 20h16" stroke="var(--ix-text-3)" strokeWidth="1.5" />}
      {kind === 'notfound' && (
        <>
          <circle cx="18" cy="18" r="6" stroke="var(--ix-text-2)" strokeWidth="1.5" />
          <path d="M22.5 22.5L28 28" stroke="var(--ix-text-2)" strokeWidth="1.5" />
        </>
      )}
      {kind === 'error' && (
        <>
          <path d="M20 12v10" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="20" cy="27" r="1.2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ix-btn ix-btn--sm" onClick={onClick}>
      <Icon name="replay" size={14} /> Try again
    </button>
  );
}

/* --------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className={s.seg} role="radiogroup" aria-label={label} data-size={size}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className={s.segBtn}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const j = (i + d + options.length) % options.length;
            onChange(options[j].value);
            refs.current[j]?.focus();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ pager */

export function Pager({
  page,
  total,
  pageSize,
  onPage,
  label = 'Pages',
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav className={s.pager} aria-label={label}>
      <span className={`${s.pagerInfo} ix-num`}>
        {from.toLocaleString('en')}–{to.toLocaleString('en')} of {total.toLocaleString('en')}
      </span>
      <div className={s.pagerBtns}>
        <button type="button" className="ix-btn ix-btn--sm" disabled={page === 0} onClick={() => onPage(0)} aria-label="First page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M17 6l-6 6 6 6M7 6v12" />
          </svg>
        </button>
        <button type="button" className="ix-btn ix-btn--sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <Icon name="back" size={14} /> Previous
        </button>
        <span className={`${s.pagerNum} ix-num`} aria-current="page">
          {(page + 1).toLocaleString('en')} / {pages.toLocaleString('en')}
        </span>
        <button type="button" className="ix-btn ix-btn--sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          Next <Icon name="back" size={14} style={{ transform: 'scaleX(-1)' }} />
        </button>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------ key/value */

export function KV({ items }: { items: { k: ReactNode; v: ReactNode; hint?: string }[] }) {
  return (
    <dl className={s.kv}>
      {items.map((it, i) => (
        <div key={i} className={s.kvRow}>
          <dt className={s.kvKey}>
            {it.k}
            {it.hint && <span className={s.kvHint}>{it.hint}</span>}
          </dt>
          <dd className={s.kvVal}>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Frame with the site's corner marks. */
export function Frame({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const T = as;
  return (
    <T className={`${s.frame} ${className ?? ''}`}>
      <i className={s.cornerTL} aria-hidden />
      <i className={s.cornerTR} aria-hidden />
      <i className={s.cornerBL} aria-hidden />
      <i className={s.cornerBR} aria-hidden />
      {children}
    </T>
  );
}

/** External docs link with the outbound arrow. */
export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={s.doc}>
      {children}
      <Icon name="external" size={12} />
    </a>
  );
}
