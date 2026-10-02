'use client';

import Link from 'next/link';
import { source } from '@/data/source';
import { useNow, useQuery, useStatus } from '@/lib/hooks';
import { ago, int, middle } from '@/lib/format';
import Omnibox from '@/components/search/Omnibox';
import { Lost, Trace, Row } from './Lost';
import s from './Lost.module.css';

/** How long a missing transaction counts as "waiting for a block" after the block its ID names. */
export const PENDING_BLOCKS = 20;

const B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Read a transaction ID: "<height>-<Base58>", older IDs with a short type prefix. */
export function parseTxid(id: string): { height: number; tail: string } | { error: string } {
  const m = id.trim().match(/^(?:[a-z]{1,4}-)?(\d+)-(.+)$/);
  if (!m) return { error: id.includes('-') ? 'The part before the dash should be a block height.' : 'There is no dash between the block height and the rest.' };
  const bad = m[2].match(/[^1-9A-HJ-NP-Za-km-z]/);
  if (bad) {
    const hint = '0OIl'.includes(bad[0]) ? ' Base58 leaves out 0, O, I and l because they look alike.' : '';
    return { error: `"${bad[0]}" after the dash is not a Base58 character.${hint}` };
  }
  if (!B58.test(m[2]) || m[2].length < 20) return { error: 'The part after the dash is too short for a transaction ID.' };
  return { height: Number(m[1]), tail: m[2] };
}

/** True while a missing transaction may still be waiting for its block (the view keeps checking). */
export function isPending(id: string, latest: number | null) {
  const p = parseTxid(id);
  return 'height' in p && latest != null && p.height <= latest && latest - p.height <= PENDING_BLOCKS;
}

export function TxLost({ id }: { id: string }) {
  const { data: status } = useStatus();
  const latest = status?.blockheight ?? null;
  const now = useNow(5000);
  const p = parseTxid(id);
  const h = 'height' in p ? p.height : null;
  const blk = useQuery(h != null && latest != null && h <= latest ? `b${h}` : null, () => source.getBlock(h!));
  const shown = middle(id.trim(), 18, 10);

  if ('error' in p) {
    return (
      <Lost
        eyebrow="Transaction"
        title={['That isn’t', 'a transaction ID.']}
        lead={<p>A transaction ID is the block height at which it was made, a dash and Base58 characters.</p>}
        actions={
          <Link href="/blocks" className="ix-btn">
            Browse blocks
          </Link>
        }
        search={<Omnibox initial={id.trim()} />}
        aside={
          <Trace label="What ixiscope checked">
            <Row k="ID">
              <code className={s.mono}>{shown}</code>
            </Row>
            <Row k="Format" state="no" note={p.error}>
              Not a transaction ID
            </Row>
          </Trace>
        }
      />
    );
  }

  const height = p.height;
  if (latest != null && height > latest) {
    return (
      <Lost
        eyebrow="Transaction"
        title={['This ID points', 'past the chain.']}
        lead={
          <p>
            Its ID starts with block {int(height)}, and the chain is at {int(latest)}. Check the digits before the dash.
          </p>
        }
        actions={
          <Link href={`/block?h=${latest}`} className="ix-btn ix-btn--primary">
            Latest block #{int(latest)}
          </Link>
        }
        search={<Omnibox initial={id.trim()} />}
        aside={
          <Trace label="What ixiscope checked">
            <Row k="ID">
              <code className={s.mono}>{shown}</code>
            </Row>
            <Row k="Format" state="ok">
              Height, dash, Base58
            </Row>
            <Row k="Block" state="no" note={`${int(height - latest)} blocks ahead of the chain.`}>
              #{int(height)}
            </Row>
          </Trace>
        }
      />
    );
  }

  const pending = isPending(id, latest);
  const madeAt = blk.status === 'ok' && now != null ? ago(blk.data.timestamp, now) : null;
  const blockRow = (
    <Row k="Made at" state="ok" note={madeAt ? `Block made ${madeAt}.` : undefined}>
      <Link className={s.guess} href={`/block?h=${height}`}>
        Block <b>#{int(height)}</b>
      </Link>
    </Row>
  );

  if (pending) {
    return (
      <Lost
        eyebrow="Transaction"
        title={['Waiting for', 'its block.']}
        lead={
          <p>
            A new transaction appears here once a block includes it, usually within 30 seconds. This page checks again with every new block.
          </p>
        }
        actions={
          <Link href={`/block?h=${height}`} className="ix-btn">
            Block #{int(height)}
          </Link>
        }
        aside={
          <Trace label="Waiting for a block">
            <Row k="ID">
              <code className={s.mono}>{shown}</code>
            </Row>
            {blockRow}
            <Row
              k="Included"
              state="wait"
              note={latest != null ? `Last checked at block #${int(latest)}. ${PENDING_BLOCKS - (latest - height)} more blocks before ixiscope stops waiting.` : undefined}
            >
              Waiting
            </Row>
          </Trace>
        }
      />
    );
  }

  return (
    <Lost
      eyebrow="Transaction"
      title={['No transaction', 'with this ID.']}
      lead={
        <p>
          Its ID names block {int(height)}, which exists, but nothing on the chain matches the rest of the ID. A character may have slipped, or it was
          never included.
        </p>
      }
      actions={
        <>
          <Link href={`/block?h=${height}`} className="ix-btn ix-btn--primary">
            Open block #{int(height)}
          </Link>
          <Link href="/blocks" className="ix-btn">
            Browse blocks
          </Link>
        </>
      }
      search={<Omnibox initial={id.trim()} />}
      aside={
        <Trace label="What ixiscope checked">
          <Row k="ID">
            <code className={s.mono}>{shown}</code>
          </Row>
          <Row k="Format" state="ok">
            Height, dash, Base58
          </Row>
          {blockRow}
          <Row k="Match" state="no">
            None on the chain
          </Row>
        </Trace>
      }
    />
  );
}
