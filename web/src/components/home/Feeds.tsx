'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Block, TxSummary } from '@/data/types';
import { source } from '@/data/source';
import { useLive, useReducedMotion } from '@/lib/hooks';
import { int, middle } from '@/lib/format';
import { Amount, Time, TypeChip, Skel, StateBox, RetryButton } from '@/components/ui/Primitives';
import { LiveBadge } from '@/components/ui/Demo';
import Icon from '@/components/Icon';
import s from './Home.module.css';

const BLOCKS = 8;
const TXS = 10;

/**
 * A list that streams: new items slide in at the top. Hovering or focusing
 * the list pauses it; what arrives meanwhile waits in a queue and a chip
 * offers to show it.
 */
function useStream<T extends { id: string | number }>(max: number) {
  const [items, setItems] = useState<T[] | null>(null);
  const [queue, setQueue] = useState<T[]>([]);
  const [paused, setPaused] = useState(false);
  const [fresh, setFresh] = useState<Set<string | number>>(() => new Set());
  const mark = (ids: (string | number)[]) => {
    setFresh((f) => {
      const n = new Set(f);
      ids.forEach((i) => n.add(i));
      return n;
    });
    window.setTimeout(
      () =>
        setFresh((f) => {
          const n = new Set(f);
          ids.forEach((i) => n.delete(i));
          return n;
        }),
      1600
    );
  };
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const push = (x: T) => {
    if (pausedRef.current) {
      setQueue((q) => [x, ...q].slice(0, 50));
      return;
    }
    mark([x.id]);
    setItems((list) => (list ? [x, ...list.filter((y) => y.id !== x.id)].slice(0, max) : list));
  };
  const queueRef = useRef<T[]>([]);
  queueRef.current = queue;
  const flush = () => {
    const q = queueRef.current;
    if (!q.length) return;
    mark(q.map((x) => x.id));
    setItems((list) => (list ? [...q, ...list].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, max) : list));
    setQueue([]);
  };
  useEffect(() => {
    if (!paused) flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  return { items, setItems, queue, paused, setPaused, push, fresh, flush };
}

function pauseProps(setPaused: (p: boolean) => void) {
  return {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: (e: React.FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
    },
  };
}

export function BlockFeed() {
  const st = useStream<Block & { id: number }>(BLOCKS);
  const [error, setError] = useState(false);
  const reduced = useReducedMotion();
  const load = () => {
    setError(false);
    source
      .getBlocks({ limit: BLOCKS })
      .then((b) => st.setItems(b))
      .catch(() => setError(true));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);
  useLive((e) => {
    if (e.type === 'block') st.push(e.block);
  });

  return (
    <section className={s.feed} aria-labelledby="bf-title" {...pauseProps(st.setPaused)}>
      <header className={s.feedHead}>
        <h2 id="bf-title" className={s.feedTitle}>
          <Icon name="block" size={16} /> Latest blocks
        </h2>
        <LiveBadge paused={st.paused} />
      </header>
      {st.queue.length > 0 && (
        <button type="button" className={s.queued} onClick={() => st.setPaused(false)}>
          {st.queue.length} new block{st.queue.length > 1 ? 's' : ''} while paused
        </button>
      )}
      {error ? (
        <StateBox kind="error" title="Blocks could not be loaded." action={<RetryButton onClick={load} />} />
      ) : (
        <ol className={s.rows} aria-live={st.paused ? 'off' : 'polite'} aria-relevant="additions">
          {st.items
            ? st.items.map((b) => {
                const isNew = st.fresh.has(b.id);
                return (
                  <li key={b.id} className={s.row} data-new={(isNew && !reduced) || undefined}>
                    <div className={s.rowMain}>
                      <Link href={`/block?h=${b.id}`} className={s.rowTitle}>
                        <span className="ix-num">{int(b.id)}</span>
                      </Link>
                      <span className={`ix-mono ${s.rowHash}`} title={b.blockChecksum}>
                        {middle(b.blockChecksum, 8, 6)}
                      </span>
                    </div>
                    <div className={s.rowMeta}>
                      <span className="ix-num">
                        {int(b.txCount)} tx{b.txCount === 1 ? '' : 's'}
                      </span>
                      <span className={`${s.sig} ix-num`} title={`${b.sigCount} signatures, ${b.sigRequired} required`}>
                        {b.sigCount}/{b.sigRequired} sig
                      </span>
                      <Time ts={b.timestamp} />
                    </div>
                  </li>
                );
              })
            : Array.from({ length: BLOCKS }, (_, i) => (
                <li key={i} className={s.row}>
                  <div className={s.rowMain}>
                    <Skel w={90} h={16} />
                    <Skel w={140} h={12} />
                  </div>
                  <div className={s.rowMeta}>
                    <Skel w={120} h={12} />
                  </div>
                </li>
              ))}
        </ol>
      )}
      <Link href="/blocks" className={s.more}>
        All blocks <Icon name="arrow" size={14} />
      </Link>
    </section>
  );
}

export function TxFeed() {
  const st = useStream<TxSummary>(TXS);
  const [error, setError] = useState(false);
  const reduced = useReducedMotion();
  const load = () => {
    setError(false);
    source
      .getRecentTransactions(TXS)
      .then((t) => st.setItems(t))
      .catch(() => setError(true));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);
  useLive((e) => {
    if (e.type === 'tx') st.push(e.tx);
  });

  return (
    <section className={s.feed} aria-labelledby="tf-title" {...pauseProps(st.setPaused)}>
      <header className={s.feedHead}>
        <h2 id="tf-title" className={s.feedTitle}>
          <Icon name="tx" size={16} /> Latest transactions
        </h2>
        <LiveBadge paused={st.paused} />
      </header>
      {st.queue.length > 0 && (
        <button type="button" className={s.queued} onClick={() => st.setPaused(false)}>
          {st.queue.length} new transaction{st.queue.length > 1 ? 's' : ''} while paused
        </button>
      )}
      {error ? (
        <StateBox kind="error" title="Transactions could not be loaded." action={<RetryButton onClick={load} />} />
      ) : st.items && st.items.length === 0 ? (
        <StateBox kind="empty" title="No transactions yet">
          New transactions appear here as blocks arrive.
        </StateBox>
      ) : (
        <ol className={s.rows} aria-live="off">
          {st.items
            ? st.items.map((t) => {
                const isNew = st.fresh.has(t.id);
                return (
                  <li key={t.id} className={s.row} data-new={(isNew && !reduced) || undefined}>
                    <div className={s.rowMain}>
                      <Link href={`/tx?id=${encodeURIComponent(t.id)}`} className={s.rowTitle}>
                        <Amount value={t.amount} decimals={4} />
                      </Link>
                      <span className={s.flow}>
                        {t.from ? (
                          <span className="ix-mono" title={t.from}>
                            {middle(t.from, 5, 4)}
                          </span>
                        ) : (
                          <span className={s.newIxi}>New IXI</span>
                        )}
                        <Icon name="arrow" size={12} className={s.flowArrow} />
                        <span className="ix-mono" title={t.to ?? ''}>
                          {t.to ? middle(t.to, 5, 4) : ''}
                        </span>
                        {t.toCount > 1 && <span className={s.plus}>+{t.toCount - 1}</span>}
                      </span>
                    </div>
                    <div className={s.rowMeta}>
                      <TypeChip type={t.type} />
                      <Time ts={t.timestamp} />
                    </div>
                  </li>
                );
              })
            : Array.from({ length: TXS }, (_, i) => (
                <li key={i} className={s.row}>
                  <div className={s.rowMain}>
                    <Skel w={110} h={16} />
                    <Skel w={170} h={12} />
                  </div>
                  <div className={s.rowMeta}>
                    <Skel w={110} h={12} />
                  </div>
                </li>
              ))}
        </ol>
      )}
      <p className={s.more}>Every transaction is in its block and on its addresses.</p>
    </section>
  );
}
