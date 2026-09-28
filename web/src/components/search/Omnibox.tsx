'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { classify, type QueryKind } from '@/lib/address';
import { describe, forgetAll, recentList, remember, routeFor, type Recent } from '@/lib/search';
import { useStatus } from '@/lib/hooks';
import Icon from '@/components/Icon';
import s from './Omnibox.module.css';

type Option = { id: string; label: string; sub?: string; href: string; group: 'open' | 'recent' | 'jump'; q?: string };

const JUMPS: Option[] = [
  { id: 'j-blocks', label: 'Blocks', sub: 'Every block, newest first', href: '/blocks', group: 'jump' },
  { id: 'j-network', label: 'Network', sub: 'Nodes on the globe and in a list', href: '/network', group: 'jump' },
  { id: 'j-stats', label: 'Statistics', sub: 'Transactions, TPS, nodes, supply', href: '/stats', group: 'jump' },
  { id: 'j-ixi', label: 'IXI', sub: 'Supply and emissions', href: '/ixi', group: 'jump' },
];

function kindLine(k: QueryKind, latest: number | null) {
  switch (k.kind) {
    case 'empty':
      return { tone: 'idle', text: 'Paste or type anything: the type is detected as you go.' };
    case 'height':
      return latest != null && k.height > latest
        ? { tone: 'warn', text: `Block ${k.height.toLocaleString('en')} does not exist yet.` }
        : { tone: 'ok', text: `Block height · open block ${k.height.toLocaleString('en')}` };
    case 'blockHash':
      return { tone: 'ok', text: 'Block hash · 128 hex characters' };
    case 'txid':
      return { tone: 'ok', text: 'Transaction ID' };
    case 'address':
      return { tone: 'ok', text: `Address, version ${k.version} · checksum valid` };
    case 'partial':
      return { tone: 'idle', text: k.hint };
    case 'invalid':
      return { tone: 'bad', text: k.reason };
  }
}

export default function Omnibox({
  size = 'md',
  autoFocus = false,
  onNavigate,
  showJumps = false,
  initial = '',
}: {
  size?: 'md' | 'lg';
  autoFocus?: boolean;
  onNavigate?: () => void;
  /** show page shortcuts when empty (palette) */
  showJumps?: boolean;
  initial?: string;
}) {
  const router = useRouter();
  const { data: status } = useStatus();
  const latest = status?.blockheight ?? null;
  const [q, setQ] = useState(initial);
  const [focus, setFocus] = useState(autoFocus);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hintId = useId();

  useEffect(() => {
    setRecent(recentList());
  }, [focus]);

  const k = useMemo(() => classify(q, latest), [q, latest]);
  const line = kindLine(k, latest);

  const options: Option[] = useMemo(() => {
    const route = routeFor(k);
    if (q.trim()) {
      if (route) return [{ id: 'open', label: describe(k), sub: 'Enter to open', href: route, group: 'open', q }];
      return [];
    }
    const out: Option[] = [];
    recent.forEach((r, i) => {
      const route2 = routeFor(classify(r.q));
      if (route2) out.push({ id: `r${i}`, label: r.label, href: route2, group: 'recent', q: r.q });
    });
    if (latest != null) out.push({ id: 'latest', label: `Latest block · ${latest.toLocaleString('en')}`, href: `/block?h=${latest}`, group: 'jump' });
    if (showJumps) out.push(...JUMPS);
    return out;
  }, [k, q, recent, latest, showJumps]);


  const go = (o: Option | null) => {
    if (o) {
      if (o.q) remember(o.q);
      router.push(o.href);
      setQ('');
      onNavigate?.();
      input.current?.blur();
      return;
    }
    const t = q.trim();
    if (!t) return;
    if (k.kind === 'invalid') return; // the reason is already on screen
    router.push(`/search?q=${encodeURIComponent(t)}`);
    onNavigate?.();
  };

  const open = (focus || showJumps) && options.length > 0;

  return (
    <div className={s.box} data-size={size} data-focus={focus || undefined} data-inline={showJumps || undefined}>
      <form
        role="search"
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          go(q.trim() ? options[0] ?? null : options[active] ?? null);
        }}
      >
        <Icon name="search" size={size === 'lg' ? 20 : 18} className={s.icon} />
        <input
          ref={input}
          className={s.input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => window.setTimeout(() => setFocus(false), 120)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % options.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a - 1 + options.length) % options.length);
            }
          }}
          autoFocus={autoFocus}
          placeholder="Block height, block hash, transaction ID or address"
          aria-label="Search ixiscope"
          aria-describedby={hintId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${options[active]?.id}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="search"
        />
        {q && (
          <button type="button" className={s.clear} onClick={() => (setQ(''), input.current?.focus())} aria-label="Clear">
            <Icon name="close" size={15} />
          </button>
        )}
        <button type="submit" className={s.submit} aria-label="Search" data-ready={routeFor(k) ? '' : undefined}>
          <Icon name="arrow" size={16} />
        </button>
      </form>
      <p id={hintId} className={s.hint} data-tone={line.tone} aria-live="polite">
        {(line.tone === 'bad' || line.tone === 'warn') && <span className={s.bang} aria-hidden>!</span>}
        {line.tone === 'ok' && <Icon name="check" size={13} className={s.okIcon} />}
        <span>{line.text}</span>
      </p>
      {open && (
        <ul id={listId} role="listbox" className={s.list} aria-label="Suggestions">
          {options.map((o, i) => {
            const firstOfGroup = i === 0 || options[i - 1].group !== o.group;
            return (
              <li key={o.id} role="presentation">
                {firstOfGroup && o.group !== 'open' && (
                  <div className={s.group} role="presentation">
                    <span>{o.group === 'recent' ? 'Recent' : 'Jump to'}</span>
                    {o.group === 'recent' && (
                      <button
                        type="button"
                        className={s.forget}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          forgetAll();
                          setRecent([]);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
                <div
                  id={`${listId}-${o.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={s.option}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(o)}
                >
                  <Icon name={o.group === 'recent' ? 'history' : o.group === 'open' ? 'arrow' : 'chevron'} size={15} className={s.optIcon} />
                  <span className={s.optLabel}>{o.label}</span>
                  {o.sub && <span className={s.optSub}>{o.sub}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
