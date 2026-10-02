'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Transaction, TxIO } from '@/data/types';
import { source } from '@/data/source';
import { useQuery, useStatus } from '@/lib/hooks';
import { int, middle, utc, TX_TYPE_LONG } from '@/lib/format';
import { links } from '@/lib/links';
import { knownLabel } from '@/data/knownWallets';
import { PageHead, Section, Raw } from '@/components/page/Page';
import { Amount, Hash, KV, Time, TypeChip, Skel, StateBox, RetryButton, DocLink, CopyButton } from '@/components/ui/Primitives';
import { DemoTag } from '@/components/ui/Demo';
import { TxLost, isPending } from '@/components/lost/TxLost';
import Icon from '@/components/Icon';
import p from '@/components/page/Page.module.css';
import s from './Tx.module.css';

const SHOW = 8;

function Party({ io, empty }: { io: TxIO | null; empty?: string }) {
  if (!io) return <div className={s.party} data-empty><span className={s.newIxi}>{empty}</span></div>;
  const label = knownLabel(io.address);
  return (
    <div className={s.party}>
      <span className={s.addrLine}>
        <Link href={`/address?a=${encodeURIComponent(io.address)}`} className={`ix-mono ${s.addr}`} title={io.address}>
          {middle(io.address, 10, 8)}
        </Link>
        {label && <span className={s.label}>{label}</span>}
      </span>
      <Amount value={io.amount} className={s.partyAmt} />
    </div>
  );
}

/** Inputs on the left, outputs on the right, joined by drawn connectors. */
function Flow({ tx }: { tx: Transaction }) {
  const [all, setAll] = useState(false);
  const outs = all ? tx.to : tx.to.slice(0, SHOW);
  const src = tx.from.length ? tx.from : [null];
  const newLabel = tx.type === 2 ? 'New IXI: signing reward' : tx.type === 1 ? 'New IXI: proof-of-work reward (legacy)' : tx.type === 3 ? 'Genesis allocation' : 'No inputs';
  const rows = Math.max(src.length, outs.length);
  const rowH = 64;
  const H = rows * rowH;
  const yIn = (i: number) => (H / src.length) * (i + 0.5);
  const yOut = (i: number) => rowH * (i + 0.5);
  return (
    <div className={s.flow}>
      <div className={s.col}>
        <p className={s.colHead}>From</p>
        <div className={s.colBody} style={{ minHeight: H }}>
          {src.map((io, i) => (
            <div key={i} className={s.slot} style={{ top: yIn(i) - 25 }}>
              <Party io={io} empty={newLabel} />
            </div>
          ))}
        </div>
      </div>
      <svg className={s.wires} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden style={{ height: H }}>
        {src.map((_, i) =>
          outs.map((__, j) => (
            <path
              key={`${i}-${j}`}
              d={`M0 ${yIn(i)} C50 ${yIn(i)} 50 ${yOut(j)} 100 ${yOut(j)}`}
              fill="none"
              stroke="var(--ix-route)"
              strokeOpacity={outs.length > 4 ? 0.35 : 0.6}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))
        )}
      </svg>
      <div className={s.col}>
        <p className={s.colHead}>
          To {tx.to.length > 1 && <span className={p.muted}>({int(tx.to.length)})</span>}
        </p>
        <div className={s.colBody} style={{ minHeight: H }}>
          {outs.map((io, i) => (
            <div key={i} className={s.slot} style={{ top: yOut(i) - 25 }}>
              <Party io={io} />
            </div>
          ))}
        </div>
        {tx.to.length > SHOW && (
          <button type="button" className="ix-btn ix-btn--sm" onClick={() => setAll((a) => !a)} style={{ marginTop: 8 }}>
            {all ? 'Show fewer' : `Show all ${int(tx.to.length)} recipients`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function TxView() {
  const q = useSearchParams();
  const id = (q.get('id') || '').trim();
  const { data: status } = useStatus();
  const t = useQuery(id || null, () => source.getTransaction(id));
  // a transaction still waiting for its block: look again on every new block
  const latest = status?.blockheight ?? null;
  const waiting = t.status === 'notfound' && isPending(id, latest);
  const reloadTx = t.reload;
  const checkedAt = useRef<number | null>(null);
  useEffect(() => {
    checkedAt.current = null;
  }, [id]);
  useEffect(() => {
    if (!waiting || latest == null) return;
    if (checkedAt.current == null) checkedAt.current = latest;
    else if (latest > checkedAt.current) {
      checkedAt.current = latest;
      reloadTx();
    }
  }, [waiting, latest, reloadTx]);

  if (!id) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox kind="notfound" title="Which transaction?">
          Search for a transaction ID: a block number, a dash and Base58 characters.
        </StateBox>
      </div>
    );
  }
  if (t.status === 'notfound' || (t.status === 'loading' && checkedAt.current != null)) return <TxLost id={id} />;
  if (t.status === 'error' && !t.data) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox kind="error" title="This transaction could not be loaded." action={<RetryButton onClick={t.reload} />}>
          {t.error.message}
        </StateBox>
      </div>
    );
  }
  const tx = t.data;
  const conf = tx && status ? Math.max(0, status.blockheight - tx.applied + 1) : null;

  return (
    <div className={`ix-container ${p.page}`}>
      <PageHead
        eyebrow={
          <>
            Transaction {tx && <TypeChip type={tx.type} />} <DemoTag />
          </>
        }
        title={tx ? <Amount value={tx.amount} trim /> : <Skel w={280} h="1.02em" />}
        meta={
          tx ? (
            <>
              <Time ts={tx.timestamp} mode="both" />
              <span>
                in block{' '}
                <Link href={`/block?h=${tx.applied}`} className="ix-link">
                  {int(tx.applied)}
                </Link>
                {conf != null && <span className={p.muted}> · {int(conf)} block{conf === 1 ? '' : 's'} deep</span>}
              </span>
            </>
          ) : (
            <>
              <Skel w={237} h={22} />
              <Skel w={229} h={22} />
            </>
          )
        }
      >
        <div className={s.txid}>
          <Hash value={id} head={24} tail={12} />
        </div>
      </PageHead>

      <Section title="Where the IXI went" lead={tx ? TX_TYPE_LONG[tx.type] : <Skel w={200} h={22} />}>
        {tx ? <Flow tx={tx} /> : <Skel h={120} />}
      </Section>

      {tx && (
        <Section title="Summary">
          <KV
            items={[
              { k: 'Type', v: TX_TYPE_LONG[tx.type] },
              { k: 'Amount', v: <Amount value={tx.amount} /> },
              {
                k: 'Fee',
                v: <Amount value={tx.fee} />,
                hint: tx.from.length ? 'Paid by the sender, shared by the block signers' : 'None: new IXI is not sent by anyone',
              },
              {
                k: 'Block',
                v: (
                  <Link href={`/block?h=${tx.applied}`} className="ix-link">
                    {int(tx.applied)}
                  </Link>
                ),
                hint: tx.blockNr !== tx.applied ? `Created for block ${int(tx.blockNr)}` : undefined,
              },
              { k: 'Time', v: <Time ts={tx.timestamp} mode="both" /> },
            ]}
          />
          <p style={{ marginTop: 12 }}>
            <DocLink href={links.docs.transactions}>Transactions</DocLink> <DocLink href={links.docs.economics}>Fees and rewards</DocLink>
          </p>
        </Section>
      )}

      {tx && (
        <Raw>
          <KV
            items={[
              { k: 'Transaction ID', v: <Hash value={tx.id} full /> },
              { k: 'Checksum', v: <Hash value={tx.checksum} head={16} tail={12} /> },
              { k: 'Nonce', v: <span className="ix-mono">{tx.nonce}</span> },
              {
                k: 'Signature',
                v: tx.signature ? <Hash value={tx.signature} head={20} tail={12} /> : <span className={p.muted}>None (created by the network)</span>,
              },
              { k: 'Data', v: tx.data ? <Hash value={tx.data} head={24} tail={8} /> : <span className={p.muted}>Empty</span> },
              { k: 'Version', v: String(tx.version) },
              { k: 'Created for block', v: int(tx.blockNr) },
              { k: 'Applied in block', v: int(tx.applied) },
              { k: 'Timestamp', v: `${tx.timestamp} · ${utc(tx.timestamp)}` },
              {
                k: 'Raw',
                v: (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <CopyButton value={JSON.stringify(tx, null, 2)} label="Copy JSON" />
                    </div>
                    <code className={p.code}>{JSON.stringify({ ...tx, signature: tx.signature ? tx.signature.slice(0, 64) + '…' : '' }, null, 2)}</code>
                  </div>
                ),
              },
            ]}
          />
        </Raw>
      )}
      {tx && (
        <p className={s.back}>
          <Icon name="back" size={14} /> <Link href="/blocks">All blocks</Link>
        </p>
      )}
    </div>
  );
}
