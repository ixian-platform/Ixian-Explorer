'use client';

import Link from 'next/link';
import { useStatus } from '@/lib/hooks';
import { int, middle } from '@/lib/format';
import Omnibox from '@/components/search/Omnibox';
import { Lost, Trace, Row, Ahead } from './Lost';
import s from './Lost.module.css';

function LatestActions({ latest }: { latest: number | null }) {
  return (
    <>
      {latest != null && (
        <Link href={`/block?h=${latest}`} className="ix-btn ix-btn--primary">
          Latest block #{int(latest)}
        </Link>
      )}
      <Link href="/blocks" className="ix-btn">
        All blocks
      </Link>
    </>
  );
}

/** A height the chain hasn't reached: counts down to it. The view reloads the block when it lands. */
export function BlockAhead({ height }: { height: number }) {
  const { data: status } = useStatus();
  const latest = status?.blockheight ?? null;
  return (
    <Lost
      eyebrow="Block"
      title={[`Block ${int(height)}`, 'isn’t here yet.']}
      lead={
        latest != null ? (
          <p>
            The chain is at {int(latest)} and adds a block about every 30 seconds. Keep this page open and it opens the block when it lands.
          </p>
        ) : (
          <p>The chain hasn’t reached this height. Keep this page open and it opens the block when it lands.</p>
        )
      }
      actions={<LatestActions latest={latest} />}
      aside={
        latest != null ? (
          <Trace label="Time to this block" top={<Ahead latest={latest} target={height} latestAt={status?.timestamp ?? null} />}>
            <Row k="Now" state="ok">
              <Link className={s.guess} href={`/block?h=${latest}`}>
                Block <b>#{int(latest)}</b>
              </Link>
            </Row>
            <Row k="To go" state="wait" note="Each block is made by the DLT nodes that sign it.">
              {int(height - latest)} blocks
            </Row>
            <Row k="Target" state="step">
              <span className={s.big}>#{int(height)}</span>
            </Row>
          </Trace>
        ) : null
      }
    />
  );
}

/** Heights start at 1. */
export function BlockZero({ height }: { height: number }) {
  const { data: status } = useStatus();
  return (
    <Lost
      eyebrow="Block"
      title={['There is no', `block ${int(height)}.`]}
      lead={<p>Block heights start at 1, the genesis block.</p>}
      actions={
        <>
          <Link href="/block?h=1" className="ix-btn ix-btn--primary">
            Block #1
          </Link>
          <LatestActions latest={status?.blockheight ?? null} />
        </>
      }
    />
  );
}

/** A hash that no block has. */
export function BlockHashLost({ hash }: { hash: string }) {
  const { data: status } = useStatus();
  const clean = hash.trim().toLowerCase();
  const hex = /^[0-9a-f]*$/.test(clean);
  const okLen = clean.length === 128;
  const shape = hex && okLen;
  return (
    <Lost
      eyebrow="Block"
      title={['No block', 'with this hash.']}
      lead={<p>A block hash is exact: one changed character gives a different hash. Copy it again from where you found it, or search by height.</p>}
      actions={<LatestActions latest={status?.blockheight ?? null} />}
      search={<Omnibox />}
      aside={
        <Trace label="What ixiscope checked">
          <Row k="Hash">
            <code className={s.mono}>{middle(clean, 24, 12)}</code>
          </Row>
          <Row
            k="Format"
            state={shape ? 'ok' : 'no'}
            note={shape ? 'SHA3-512: 128 hex characters.' : !hex ? 'Hex uses 0 to 9 and a to f only.' : `Block hashes are 128 hex characters.`}
          >
            {shape ? '128 hex characters' : !hex ? 'Not hex' : `${clean.length} of 128 characters`}
          </Row>
          <Row k="Chain" state="no" note="No block on the chain has this hash.">
            Not found
          </Row>
        </Trace>
      }
    />
  );
}
