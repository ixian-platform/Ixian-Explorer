'use client';

import Link from 'next/link';
import { useStatus, useNow } from '@/lib/hooks';
import { compact, dec, int, shortDate } from '@/lib/format';
import { BLOCK_SECONDS, BLOCKS_PER_DAY } from '@/data/emission';
import { LiveBadge } from '@/components/ui/Demo';
import { isDemo } from '@/data/source';
import { Skel, RetryButton } from '@/components/ui/Primitives';
import { links } from '@/lib/links';
import s from './Home.module.css';

/** The network's headline numbers next to the globe. */
export default function KeyNumbers() {
  const { data, error } = useStatus();
  const now = useNow(1000);
  const age = data && now != null ? Math.max(0, Math.round(now - data.timestamp)) : null;

  const cells: { k: string; m?: string; v: React.ReactNode; key?: number; sub: React.ReactNode; title?: string; tick?: boolean }[] = [
    {
      k: 'Block height',
      v: data ? int(data.blockheight) : null,
      key: data?.blockheight,
      sub: data ? (
        <Link href={`/block?h=${data.blockheight}`} className={s.subLink}>
          Open latest block
        </Link>
      ) : null,
    },
    {
      k: 'Last block',
      m: 'time',
      v:
        age != null ? (
          <span className={s.ageV}>
            <i className="ix-status" data-s={age <= 60 ? 'good' : age <= 180 ? 'warning' : 'critical'} aria-hidden />
            {age} s ago
            <span className="ix-sr">{age <= 60 ? ', on time' : age <= 180 ? ', slower than usual' : ', delayed'}</span>
          </span>
        ) : null,
      sub: (
        <a href={links.docs.parameters} target="_blank" rel="noreferrer" className={s.subLink}>
          Target {BLOCK_SECONDS} s
        </a>
      ),
      tick: true,
    },
    { k: 'DLT nodes', m: 'dlt', v: data ? int(data.nodes_m) : null, sub: <Link href="/network" className={s.subLink}>Sign blocks</Link> },
    { k: 'S2 nodes', m: 's2', v: data ? int(data.nodes_r) : null, sub: <Link href="/network" className={s.subLink}>Relay traffic</Link> },
    {
      k: 'In circulation',
      m: 'ixi',
      v: data ? `${compact(Number(data.totalixi), 2)} IXI` : null,
      sub: data ? `+${compact(Number(data.signingReward) * BLOCKS_PER_DAY, 2)} IXI a day` : null,
      title: data ? `${int(Number(data.totalixi))} IXI` : undefined,
    },
    {
      k: 'TPS now',
      m: 'tx',
      v: data ? dec(data.tpsNow, 2) : null,
      sub: data ? (
        !data.tpsPeak.height ? (
          isDemo() ? 'No record in demo data' : 'Record not available yet'
        ) : (
        <Link href={`/block?h=${data.tpsPeak.height}`} className={s.subLink}>
          Record {dec(data.tpsPeak.tps, 2)} · {shortDate(data.tpsPeak.timestamp)}
        </Link>
        )
      ) : null,
    },
  ];

  return (
    <section className={s.numbers} aria-labelledby="kn-title">
      <div className={s.numbersHead}>
        <h2 id="kn-title" className={s.numbersTitle}>
          Network now
        </h2>
        {!(error && !data) && <LiveBadge label="Updating" />}
      </div>
      {error && !data ? (
        <div className={s.numbersError}>
          <p>Network numbers could not be loaded.</p>
        </div>
      ) : (
        <dl className={s.grid}>
          {cells.map((c) => (
            <div key={c.k} className={s.cell}>
              <dt className={s.cellK}>
                {c.m && <i className="ix-key" data-m={c.m} aria-hidden />}
                {c.k}
              </dt>
              <dd className={s.cellV} title={c.title}>
                {c.v == null ? <Skel w="70%" h={26} /> : <span key={c.key ?? undefined} className={c.key ? s.flash : undefined}>{c.v}</span>}
              </dd>
              <dd className={s.cellSub}>{c.sub ?? <Skel w="55%" h={12} />}</dd>
            </div>
          ))}
        </dl>
      )}
      {error && !data && <RetryButton onClick={() => location.reload()} />}
    </section>
  );
}
