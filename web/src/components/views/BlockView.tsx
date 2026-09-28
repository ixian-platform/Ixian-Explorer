'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TxType } from '@/data/types';
import { source } from '@/data/source';
import { useQuery, useStatus } from '@/lib/hooks';
import { int, compact, hashrate, utc, duration, TX_TYPE_LABEL } from '@/lib/format';
import { signingRewardAt, miningRewardAt } from '@/data/emission';
import { links } from '@/lib/links';
import { PageHead, Section, Figures, Fig, Raw } from '@/components/page/Page';
import { Amount, Hash, KV, Time, Skel, StateBox, RetryButton, Pager, DocLink, CopyButton } from '@/components/ui/Primitives';
import { DemoTag } from '@/components/ui/Demo';
import { BlockTxTable } from '@/components/tables/TxTable';
import Icon from '@/components/Icon';
import p from '@/components/page/Page.module.css';

const PAGE = 25;
const TYPES: (TxType | 'all')[] = ['all', 0, 2, 1, 4];

export default function BlockView() {
  const q = useSearchParams();
  const router = useRouter();
  const hParam = q.get('h');
  const hashParam = q.get('hash');
  const { data: status } = useStatus();
  const latest = status?.blockheight ?? null;
  const height = hParam && /^\d+$/.test(hParam.replace(/,/g, '')) ? Number(hParam.replace(/,/g, '')) : null;

  const key = height != null ? `h${height}` : hashParam ? `x${hashParam}` : null;
  const block = useQuery(key ?? 'none', () =>
    height != null ? source.getBlock(height) : hashParam ? source.getBlockByHash(hashParam) : Promise.resolve(null)
  );
  const b = block.status === 'ok' ? block.data : block.status === 'loading' ? block.data : null;
  // after a lookup by hash, show the canonical URL
  useEffect(() => {
    if (hashParam && block.status === 'ok' && block.data) router.replace(`/block?h=${block.data.id}`);
  }, [hashParam, block.status, block.data, router]);

  const [page, setPage] = useState(0);
  const [type, setType] = useState<TxType | 'all'>('all');
  useEffect(() => {
    setPage(0);
    setType('all');
  }, [key]);
  const txs = useQuery(b ? `${b.id}|${page}|${type}` : null, () =>
    source.getBlockTransactions(b!.id, { page, pageSize: PAGE, type: type === 'all' ? undefined : type })
  );

  const id = b?.id ?? height;
  const prev = id != null && id > 1 ? id - 1 : null;
  const next = id != null && (latest == null || id < latest) ? id + 1 : null;

  // arrow keys: previous and next block
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest('svg,[role="radiogroup"],canvas')) return;
      if (e.key === 'ArrowLeft' && prev) router.push(`/block?h=${prev}`);
      if (e.key === 'ArrowRight' && next) router.push(`/block?h=${next}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, router]);

  if (!key) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox kind="notfound" title="Which block?" action={<Link href="/blocks" className="ix-btn">Browse blocks</Link>}>
          Open a block from the list, or search for a height or block hash.
        </StateBox>
      </div>
    );
  }
  if (block.status === 'notfound' || (height != null && latest != null && height > latest && block.status !== 'ok')) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox
          kind="notfound"
          title={height != null ? `Block ${int(height)} not found` : 'No block with this hash'}
          action={
            <>
              {latest != null && (
                <Link href={`/block?h=${latest}`} className="ix-btn">
                  Latest block ({int(latest)})
                </Link>
              )}
              <Link href="/blocks" className="ix-btn ix-btn--ghost">
                All blocks
              </Link>
            </>
          }
        >
          {height != null && latest != null && height > latest
            ? `The chain is at block ${int(latest)}. At one block every 30 seconds, block ${int(height)} is about ${duration((height - latest) * 30)} away.`
            : 'Check the hash for typos: block hashes are 128 hex characters.'}
        </StateBox>
      </div>
    );
  }
  if (block.status === 'error' && !b) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox kind="error" title="This block could not be loaded" action={<RetryButton onClick={block.reload} />}>
          {block.error.message}
        </StateBox>
      </div>
    );
  }

  const depth = b && latest != null ? latest - b.id : null;
  const frozen = depth != null && depth >= 5;
  const reward = b ? signingRewardAt(b.id) : null;
  const mined = b ? b.powField !== '' : false;
  const tx = txs.status === 'ok' || txs.status === 'loading' ? txs.data : null;

  return (
    <div className={`ix-container ${p.page}`}>
      <PageHead
        eyebrow={
          <>
            Block <DemoTag />
          </>
        }
        title={id != null ? `#${int(id)}` : <Skel w={260} h={44} />}
        meta={
          b ? (
            <>
              <Time ts={b.timestamp} mode="both" />
              <span className={p.chip} data-tone={frozen ? 'done' : undefined} title="Signers can sign until 5 blocks are built on top; then the signer set is frozen.">
                <i className={p.chipDot} aria-hidden />
                {frozen ? 'Signatures frozen' : depth != null ? `Collecting signatures · depth ${depth} of 5` : 'Collecting signatures'}
              </span>
            </>
          ) : (
            <Skel w={320} h={16} />
          )
        }
        actions={
          <div className={p.navBtns}>
            <span className={p.kbdHint}>
              <kbd>←</kbd>
              <kbd>→</kbd>
            </span>
            {prev ? (
              <Link href={`/block?h=${prev}`} className="ix-btn" aria-label={`Previous block, ${int(prev)}`}>
                <Icon name="back" size={15} /> {int(prev)}
              </Link>
            ) : (
              <span className="ix-btn" aria-disabled="true" style={{ opacity: 0.4 }}>
                <Icon name="back" size={15} /> Genesis
              </span>
            )}
            {next ? (
              <Link href={`/block?h=${next}`} className="ix-btn" aria-label={`Next block, ${int(next)}`}>
                {int(next)} <Icon name="chevron" size={15} />
              </Link>
            ) : (
              <span className="ix-btn" aria-disabled="true" style={{ opacity: 0.4 }} title="This is the latest block">
                Latest <Icon name="chevron" size={15} />
              </span>
            )}
          </div>
        }
      />

      <div style={{ marginTop: 28 }}>
        <Figures cols={4}>
          <Fig
            mark="tx"
            k="Transactions"
            v={b ? int(b.txCount) : <Skel w={80} h={24} />}
            sub={b ? <Amount value={b.txAmount} decimals={2} /> : null}
          />
          <Fig
            mark="signers"
            k="Signatures"
            v={b ? `${int(b.sigCount)} of ${int(b.sigRequired)} required` : <Skel w={140} h={24} />}
            sub={
              b ? (
                <span className={p.meter} role="meter" aria-label="Signatures against required" aria-valuemin={0} aria-valuemax={Math.max(b.sigCount, b.sigRequired)} aria-valuenow={b.sigCount} style={{ display: 'block' }}>
                  <span className={p.meterFill} style={{ width: `${Math.min(100, (b.sigCount / Math.max(b.sigCount, b.sigRequired * 1.4)) * 100)}%` }} />
                  <span className={p.meterMark} style={{ left: `${Math.min(100, (b.sigRequired / Math.max(b.sigCount, b.sigRequired * 1.4)) * 100)}%` }} />
                </span>
              ) : null
            }
          />
          <Fig mark="time" k="Block time" v={b ? `${b.blocktime} s` : <Skel w={60} h={24} />} sub="since the previous block · target 30 s" />
          <Fig
            mark="ixi"
            k="Signing reward"
            v={reward != null ? `${int(reward)} IXI` : b ? 'Share of supply' : <Skel w={90} h={24} />}
            sub={
              mined && b ? (
                <>
                  plus <Amount value={miningRewardAt(b.id).toFixed(8)} decimals={2} /> proof-of-work reward (legacy)
                </>
              ) : (
                <DocLink href={links.docs.emission}>Emission schedule</DocLink>
              )
            }
          />
        </Figures>
      </div>

      <Section
        id="txs"
        title={b ? `Transactions (${int(b.txCount)})` : 'Transactions'}
        aside={
          <div className={p.filters} role="group" aria-label="Filter by type">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`ix-btn ix-btn--sm ${type === t ? '' : 'ix-btn--ghost'}`}
                aria-pressed={type === t}
                onClick={() => {
                  setType(t);
                  setPage(0);
                }}
              >
                {t === 'all' ? 'All' : TX_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        }
      >
        {txs.status === 'error' ? (
          <StateBox kind="error" title="Transactions could not be loaded" action={<RetryButton onClick={txs.reload} />} />
        ) : tx && tx.total === 0 ? (
          <StateBox kind="empty" title={type === 'all' ? 'No transactions in this block' : `No ${TX_TYPE_LABEL[type as number].toLowerCase()} transactions here`}>
            {type === 'all' ? 'The block carries only its header.' : 'Try another type, or show all.'}
          </StateBox>
        ) : (
          <>
            <BlockTxTable items={tx ? tx.items : null} rows={b ? Math.min(PAGE, b.txCount || 1) : 8} />
            {tx && <Pager page={page} total={tx.total} pageSize={PAGE} onPage={setPage} label="Transaction pages" />}
          </>
        )}
      </Section>

      {b && (
        <Raw>
          <KV
            items={[
              { k: 'Block hash', hint: 'SHA3-512 checksum of the block', v: <Hash value={b.blockChecksum} head={16} tail={12} /> },
              {
                k: 'Previous block',
                v: b.lastBlockChecksum ? <Hash value={b.lastBlockChecksum} href={`/block?h=${b.id - 1}`} head={16} tail={12} /> : <span className={p.muted}>None (genesis)</span>,
              },
              { k: 'Wallet state checksum', v: <Hash value={b.wsChecksum} head={16} tail={12} /> },
              {
                k: 'Signature freeze checksum',
                hint: b.id > 5 ? `Freezes the signers of block ${int(b.id - 5)}` : undefined,
                v: b.sigFreezeChecksum ? (
                  <>
                    <Hash value={b.sigFreezeChecksum} head={16} tail={12} />{' '}
                    <DocLink href={links.docs.consensus}>Ixiac consensus</DocLink>
                  </>
                ) : (
                  <span className={p.muted}>None</span>
                ),
              },
              { k: 'Signature checksum', v: <Hash value={b.sigChecksum} head={16} tail={12} /> },
              { k: 'Signatures', v: `${int(b.sigCount)} (required ${int(b.sigRequired)})` },
              { k: 'Total signer difficulty', v: <span className="ix-num">{int(Number(b.totalSignerDifficulty))} ({compact(Number(b.totalSignerDifficulty), 2)})</span> },
              { k: 'Required signer difficulty', v: <span className="ix-num">{int(Number(b.requiredSignerDifficulty))} ({compact(Number(b.requiredSignerDifficulty), 2)})</span> },
              { k: 'Estimated signer hashrate', hint: 'Total signer difficulty / 900 s', v: hashrate(Number(b.hashrate)) },
              { k: 'Difficulty', v: <span className="ix-mono">{b.difficulty}</span> },
              { k: 'PoW field', v: b.powField ? <span className="ix-mono">{b.powField}</span> : <span className={p.muted}>Empty</span> },
              { k: 'Version', v: String(b.version) },
              { k: 'Timestamp', v: `${b.timestamp} · ${utc(b.timestamp)}` },
              {
                k: 'Raw',
                v: (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <CopyButton value={JSON.stringify(b, null, 2)} label="Copy JSON" />
                    </div>
                    <code className={p.code}>{JSON.stringify(b, null, 2)}</code>
                  </div>
                ),
              },
            ]}
          />
        </Raw>
      )}
    </div>
  );
}
