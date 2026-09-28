'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useState } from 'react';
import type { Block } from '@/data/types';
import { source } from '@/data/source';
import { useLive, useQuery, useStatus, useReducedMotion } from '@/lib/hooks';
import { compact, int, middle, utc } from '@/lib/format';
import { PageHead } from '@/components/page/Page';
import { Amount, Segmented, Skel, StateBox, RetryButton, Time } from '@/components/ui/Primitives';
import { LiveBadge } from '@/components/ui/Demo';
import Icon from '@/components/Icon';
import p from '@/components/page/Page.module.css';
import s from './Blocks.module.css';

const PAGE = 25;
type View = 'simple' | 'detailed';

export default function BlocksView() {
  const q = useSearchParams();
  const router = useRouter();
  const view: View = q.get('view') === 'detailed' ? 'detailed' : 'simple';
  const beforeParam = q.get('before');
  const before = beforeParam && /^\d+$/.test(beforeParam) ? Number(beforeParam) : null;
  const { data: status } = useStatus();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [fresh, setFresh] = useState<Block[]>([]);
  const [jump, setJump] = useState('');

  // a window of blocks, opened from a chart bucket: ?from=&to=
  const num = (k: string) => {
    const v = q.get(k);
    return v && /^\d+$/.test(v) ? Number(v) : null;
  };
  const wFrom = num('from');
  const wTo = num('to');
  const win = wFrom != null && wTo != null && wFrom <= wTo ? { from: wFrom, to: wTo, n: wTo - wFrom + 1 } : null;
  const canSort = !!source.getSlowestBlocks;
  const slow = !!win && canSort && q.get('sort') === 'slow';
  const sPage = Math.max(0, num('page') ?? 0);

  const at = before ?? win?.to ?? null;
  const list = useQuery(slow ? null : `${at ?? 'top'}`, () => source.getBlocks({ before: at ?? undefined, limit: PAGE }));
  const slowList = useQuery(slow && win ? `slow|${win.from}|${win.to}|${sPage}` : null, () =>
    source.getSlowestBlocks!({ from: win!.from, to: win!.to, page: sPage, pageSize: PAGE })
  );
  const onTop = before == null && !win;
  // slowest first needs the block time column
  const cols: View = slow ? 'detailed' : view;
  useLive((e) => {
    if (e.type === 'block' && onTop && !paused) setFresh((f) => [e.block, ...f].slice(0, 10));
  }, onTop);

  const setParams = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams(q.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) u.delete(k);
      else u.set(k, v);
    }
    router.push(`/blocks${u.toString() ? `?${u}` : ''}`);
    setFresh([]);
  };
  const setParam = (k: string, v: string | null) => setParams({ [k]: v });

  const base = slow ? (slowList.data?.items ?? null) : (list.data ?? null);
  const rows = base ? [...fresh.filter((b) => !base.some((x) => x.id === b.id)), ...base].slice(0, onTop ? PAGE + fresh.length : PAGE) : null;
  const top = rows?.[0]?.id;
  const bottom = rows?.[rows.length - 1]?.id;
  const latest = status?.blockheight ?? null;
  const freshIds = new Set(fresh.map((b) => b.id));

  /* where the window's edges fall in a newest-first list */
  const divider = (prev: Block | undefined, b: Block) => {
    if (!win || slow || !prev) return null;
    const edge = prev.id > win.to && b.id <= win.to ? 'Window: newer blocks above this line' : prev.id >= win.from && b.id < win.from ? 'End of window: older blocks below this line' : null;
    if (!edge) return null;
    return (
      <tr className={s.edge} aria-hidden={false}>
        <td colSpan={cols === 'detailed' ? 9 : 6} data-a="t1">
          {edge}
        </td>
      </tr>
    );
  };

  const pager = (where: 'top' | 'bottom') => {
    let label = '';
    let buttons: React.ReactNode;
    if (slow && win) {
      const total = slowList.data?.total ?? win.n;
      const a = sPage * PAGE + 1;
      const z = Math.min(total, (sPage + 1) * PAGE);
      label = `Slowest ${int(a)} to ${int(z)} of ${int(total)} in the window`;
      buttons = (
        <>
          <button type="button" className="ix-btn ix-btn--sm" disabled={sPage === 0} onClick={() => setParam('page', sPage > 1 ? String(sPage - 1) : null)}>
            <Icon name="back" size={14} /> Slower
          </button>
          <button type="button" className="ix-btn ix-btn--sm" disabled={z >= total} onClick={() => setParam('page', String(sPage + 1))}>
            Faster <Icon name="chevron" size={14} />
          </button>
        </>
      );
    } else {
      label = top != null && bottom != null ? `Blocks ${int(bottom)} to ${int(top)}` : '';
      if (win && top != null && bottom != null && bottom <= win.to && top >= win.from) {
        const a = win.to - Math.min(top, win.to) + 1;
        const z = win.to - Math.max(bottom, win.from) + 1;
        label += ` · ${int(a)} to ${int(z)} of ${int(win.n)} in the window`;
      } else if (win && top != null && bottom != null) {
        label += top < win.from ? ' · older than the window' : ' · newer than the window';
      }
      const atWindowTop = win ? (at ?? win.to) === win.to : onTop;
      buttons = (
        <>
          <button type="button" className="ix-btn ix-btn--sm" disabled={atWindowTop} onClick={() => setParam('before', null)}>
            {win ? 'Window start' : 'Newest'}
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--sm"
            disabled={onTop}
            onClick={() => setParam('before', top != null && latest != null && top + PAGE < latest ? String(top + PAGE) : win ? String(latest ?? win.to) : null)}
          >
            <Icon name="back" size={14} /> Newer
          </button>
          <button type="button" className="ix-btn ix-btn--sm" disabled={bottom == null || bottom <= 1} onClick={() => setParam('before', String((bottom ?? 2) - 1))}>
            Older <Icon name="chevron" size={14} />
          </button>
        </>
      );
    }
    return (
      <nav className={s.pager} data-where={where} aria-label={where === 'top' ? 'Block pages' : 'Block pages, bottom'}>
        <span className={p.muted}>{label}</span>
        <div className={s.pagerBtns}>{buttons}</div>
      </nav>
    );
  };

  return (
    <div className={`ix-container ${p.page}`}>
      <PageHead
        eyebrow="Explore"
        title="Blocks"
        meta={
          <>
            <span>{latest != null ? `${int(latest)} blocks, one about every 30 seconds` : 'One block about every 30 seconds'}</span>
            {onTop && <LiveBadge paused={paused} />}
          </>
        }
        actions={
          <form
            className={s.jump}
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(jump.replace(/[,#\s]/g, ''));
              if (Number.isInteger(n) && n > 0) router.push(`/block?h=${n}`);
            }}
          >
            <label htmlFor="jump" className="ix-sr">
              Go to block height
            </label>
            <input id="jump" className={s.jumpInput} inputMode="numeric" placeholder="Go to height" value={jump} onChange={(e) => setJump(e.target.value)} />
            <button className="ix-btn ix-btn--sm" type="submit">
              Go
            </button>
          </form>
        }
      />

      <div className={s.bar}>
        <Segmented<View>
          label="Columns"
          size="sm"
          value={view}
          onChange={(v) => setParam('view', v === 'detailed' ? 'detailed' : null)}
          options={[
            { value: 'simple', label: 'Overview' },
            { value: 'detailed', label: 'Detailed' },
          ]}
        />
        {onTop && (
          <button type="button" className="ix-btn ix-btn--sm ix-btn--ghost" aria-pressed={paused} onClick={() => setPaused((x) => !x)}>
            <Icon name={paused ? 'chevron' : 'pause'} size={14} /> {paused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      {win && <WindowBar win={win} slow={slow} canSort={canSort} onSort={(v) => setParams({ sort: v ? 'slow' : null, page: null, before: null })} onClear={() => setParams({ from: null, to: null, sort: null, page: null, before: null })} />}

      {rows && rows.length > 0 && pager('top')}

      {(slow ? slowList : list).status === 'error' && !base ? (
        <StateBox kind="error" title="Blocks could not be loaded" action={<RetryButton onClick={(slow ? slowList : list).reload} />} />
      ) : rows && rows.length === 0 ? (
        <StateBox kind="empty" title="No blocks here" action={<Link href="/blocks" className="ix-btn">Newest blocks</Link>} />
      ) : (
        <div className={p.tableWrap}>
          <table className={p.table} data-view={cols} data-cards>
            <caption className="ix-sr">{slow ? 'Blocks in the window, slowest first' : 'Blocks, newest first'}</caption>
            <thead>
              <tr>
                <th scope="col">Height</th>
                <th scope="col">Hash</th>
                <th scope="col">Age</th>
                <th scope="col" className={p.num}>
                  Transactions
                </th>
                <th scope="col" className={p.num}>
                  Amount
                </th>
                <th scope="col" className={p.num}>
                  Signatures
                </th>
                {cols === 'detailed' && (
                  <>
                    <th scope="col" className={p.num}>
                      Block time
                    </th>
                    <th scope="col" className={p.num}>
                      Signer difficulty
                    </th>
                    <th scope="col" className={p.num}>
                      Version
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows
                ? rows.map((b, i) => (
                    <Fragment key={b.id}>
                    {divider(rows[i - 1], b)}
                    <tr data-new={(freshIds.has(b.id) && !reduced) || undefined} data-out={(!slow && win && (b.id < win.from || b.id > win.to)) || undefined} className={s.tr}>
                      <td data-a="t1">
                        <Link href={`/block?h=${b.id}`} className={`${p.rowLink} ix-num`} data-row>
                          {int(b.id)}
                        </Link>
                      </td>
                      <td className="ix-mono" title={b.blockChecksum} data-a="sub" data-last>
                        <span className={p.muted}>{middle(b.blockChecksum, 10, 6)}</span>
                      </td>
                      <td data-a="t2">
                        <Time ts={b.timestamp} />
                      </td>
                      <td className={p.num} data-a="sub" data-l="tx">{int(b.txCount)}</td>
                      <td className={p.num} data-a="sub">
                        <Amount value={b.txAmount} decimals={2} />
                      </td>
                      <td className={p.num} data-a="sub" data-l="signatures">
                        <span className={s.sigs}>
                          <span className={s.sigBar} aria-hidden>
                            <i style={{ width: `${Math.min(100, (b.sigCount / Math.max(1, b.sigRequired * 1.5)) * 100)}%` }} />
                            <b style={{ left: `${Math.min(100, (1 / 1.5) * 100)}%` }} />
                          </span>
                          {b.sigCount}
                          <span className={p.muted}> / {b.sigRequired}</span>
                        </span>
                      </td>
                      {cols === 'detailed' && (
                        <>
                          <td className={p.num} data-a="sub">
                            <span className={s.sigs}>
                              <i className="ix-status" data-s={b.blocktime <= 45 ? 'good' : b.blocktime <= 90 ? 'warning' : 'critical'} aria-hidden />
                              {b.blocktime} s
                            </span>
                          </td>
                          <td className={p.num} data-a="sub" data-l="difficulty">{compact(Number(b.totalSignerDifficulty), 2)}</td>
                          <td className={`${p.num} ix-mono`} data-a="sub" data-p="v">{b.version}</td>
                        </>
                      )}
                    </tr>
                    </Fragment>
                  ))
                : Array.from({ length: 12 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: cols === 'detailed' ? 9 : 6 }, (_, j) => (
                        <td key={j}>
                          <Skel w={j === 1 ? 140 : 70} h={13} />
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length > 0 && pager('bottom')}
    </div>
  );
}

/** The window opened from a chart: its time span and blocks, the order, and a way out. */
function WindowBar({
  win,
  slow,
  canSort,
  onSort,
  onClear,
}: {
  win: { from: number; to: number; n: number };
  slow: boolean;
  canSort: boolean;
  onSort: (slow: boolean) => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const first = useQuery(`b|${win.from}`, () => source.getBlock(win.from));
  const last = useQuery(`b|${win.to}`, () => source.getBlock(win.to));
  const t0 = first.data?.timestamp;
  const t1 = last.data?.timestamp;
  const span = t0 != null && t1 != null ? t1 - t0 : null;
  const spanText = span == null ? '' : span >= 86400 * 1.5 ? `${Math.round(span / 86400)} days` : span >= 5400 ? `${Math.round(span / 3600)} hours` : `${Math.max(1, Math.round(span / 60))} minutes`;
  const when =
    t0 != null && t1 != null
      ? `${utc(t0).slice(0, 16)} to ${utc(t1).slice(0, 10) === utc(t0).slice(0, 10) ? utc(t1).slice(11, 16) : utc(t1).slice(0, 16)} UTC`
      : '';
  return (
    <section className={s.window} aria-label="Window of blocks">
      <div className={s.windowText}>
        <p className={s.windowK}>Window{spanText ? ` · ${spanText}` : ''}</p>
        <p className={s.windowV}>
          {when && <span>{when}</span>}
          <span className="ix-num">
            blocks {int(win.from)} to {int(win.to)} · {int(win.n)} blocks
          </span>
        </p>
      </div>
      <div className={s.windowActions}>
        {canSort && (
          <Segmented<'new' | 'slow'>
            label="Order"
            size="sm"
            value={slow ? 'slow' : 'new'}
            onChange={(v) => onSort(v === 'slow')}
            options={[
              { value: 'new', label: 'Newest first' },
              { value: 'slow', label: 'Slowest first' },
            ]}
          />
        )}
        <button type="button" className="ix-btn ix-btn--sm ix-btn--ghost" onClick={() => router.back()}>
          <Icon name="back" size={14} /> Back
        </button>
        <button type="button" className="ix-btn ix-btn--sm ix-btn--ghost" onClick={onClear} aria-label="Close the window and show all blocks">
          <Icon name="close" size={14} /> All blocks
        </button>
      </div>
    </section>
  );
}
