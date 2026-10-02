'use client';

import Link from 'next/link';
import type { AddressTx, TxSummary, AddressTxSort, SortDir } from '@/data/types';
import { int, middle } from '@/lib/format';
import { Amount, Time, TypeChip, Skel } from '@/components/ui/Primitives';
import Icon from '@/components/Icon';
import p from '@/components/page/Page.module.css';

function Addr({ a, self }: { a: string | null; self?: string }) {
  if (!a) return <span className={p.muted}>New IXI</span>;
  if (a === self) return <span className={p.muted}>This address</span>;
  return (
    <Link href={`/address?a=${encodeURIComponent(a)}`} className="ix-mono" title={a}>
      {middle(a, 6, 5)}
    </Link>
  );
}

function SortHead({
  label,
  col,
  sort,
  dir,
  onSort,
  className,
}: {
  label: string;
  col: AddressTxSort;
  sort: AddressTxSort;
  dir: SortDir;
  onSort: (c: AddressTxSort, d: SortDir) => void;
  className?: string;
}) {
  const active = sort === col;
  return (
    <th scope="col" className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={p.sortBtn}
        data-active={active || undefined}
        onClick={() => onSort(col, active ? (dir === 'desc' ? 'asc' : 'desc') : 'desc')}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M5 1.5L8 4.5H2z" fill={active && dir === 'asc' ? 'currentColor' : 'var(--ix-ink-5)'} />
          <path d="M5 8.5L2 5.5h6z" fill={active && dir === 'desc' ? 'currentColor' : 'var(--ix-ink-5)'} />
        </svg>
      </button>
    </th>
  );
}

export function BlockTxTable({ items, rows = 10 }: { items: TxSummary[] | null; rows?: number }) {
  return (
    <div className={p.tableWrap}>
      <table className={p.table} data-cards>
        <caption className="ix-sr">Transactions in this block</caption>
        <thead>
          <tr>
            <th scope="col">Transaction</th>
            <th scope="col">Type</th>
            <th scope="col">From</th>
            <th scope="col">
              <span className="ix-sr">Direction</span>
            </th>
            <th scope="col">To</th>
            <th scope="col" className={p.num}>
              Amount
            </th>
            <th scope="col" className={p.num}>
              Fee
            </th>
          </tr>
        </thead>
        <tbody>
          {items
            ? items.map((t) => (
                <tr key={t.id}>
                  <td data-a="t1">
                    <Link href={`/tx?id=${encodeURIComponent(t.id)}`} className={`ix-mono ${p.rowLink}`} title={t.id} data-row>
                      {middle(t.id, 12, 6)}
                    </Link>
                  </td>
                  <td data-a="sub">
                    <TypeChip type={t.type} />
                  </td>
                  <td data-a="sub">
                    <Addr a={t.from} />
                  </td>
                  <td className={p.muted} data-a="sub">
                    <Icon name="arrow" size={13} />
                  </td>
                  <td data-a="sub">
                    <Addr a={t.to} />
                    {t.toCount > 1 && <span className={p.muted}> +{int(t.toCount - 1)}</span>}
                  </td>
                  <td className={p.num} data-a="t2">
                    <Amount value={t.amount} />
                  </td>
                  <td className={`${p.num} ${p.muted}`} data-a="sub" data-p="fee" data-last>{t.fee === '0.00000000' ? '0' : <Amount value={t.fee} unit={false} />}</td>
                </tr>
              ))
            : Array.from({ length: rows }, (_, i) => (
                <tr key={i}>
                  {[150, 90, 110, 14, 110, 110, 60].map((w, j) => (
                    <td key={j}>
                      <Skel w={w} h={13} />
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

export function AddressTxTable({
  items,
  address,
  sort,
  dir,
  onSort,
  rows = 10,
}: {
  items: AddressTx[] | null;
  address: string;
  sort: AddressTxSort;
  dir: SortDir;
  onSort: (c: AddressTxSort, d: SortDir) => void;
  rows?: number;
}) {
  return (
    <div className={p.tableWrap}>
      <table className={p.table} data-cards>
        <caption className="ix-sr">Transactions of this address</caption>
        <thead>
          <tr>
            <SortHead label="Time" col="time" sort={sort} dir={dir} onSort={onSort} />
            <th scope="col">Transaction</th>
            <th scope="col">Type</th>
            <th scope="col">Counterparty</th>
            <th scope="col" className={p.num}>
              Block
            </th>
            <SortHead label="Change" col="amount" sort={sort} dir={dir} onSort={onSort} className={p.num} />
          </tr>
        </thead>
        <tbody>
          {items
            ? items.map((t) => {
                const out = t.delta.startsWith('-');
                const other = out ? t.to : t.from;
                return (
                  <tr key={t.id}>
                    <td data-a="sub">
                      <Time ts={t.timestamp} />
                    </td>
                    <td data-a="t1">
                      <Link href={`/tx?id=${encodeURIComponent(t.id)}`} className={`ix-mono ${p.rowLink}`} title={t.id} data-row>
                        {middle(t.id, 12, 6)}
                      </Link>
                    </td>
                    <td data-a="sub">
                      <TypeChip type={t.type} />
                    </td>
                    <td data-a="sub">
                      <span className={p.muted}>{out ? 'to ' : 'from '}</span>
                      <Addr a={other} self={address} />
                    </td>
                    <td className={p.num} data-a="sub" data-p="block" data-last>
                      <Link href={`/block?h=${t.applied}`} className={p.rowLink}>
                        {int(t.applied)}
                      </Link>
                    </td>
                    <td className={`${p.num} ${out ? p.out : p.in}`} data-a="t2">
                      <Amount value={t.delta} signed />
                    </td>
                  </tr>
                );
              })
            : Array.from({ length: rows }, (_, i) => (
                <tr key={i}>
                  {[70, 150, 90, 130, 80, 120].map((w, j) => (
                    <td key={j}>
                      <Skel w={w} h={13} />
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
