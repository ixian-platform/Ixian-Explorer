'use client';

import Link from 'next/link';
import { source } from '@/data/source';
import { useQuery, useStatus } from '@/lib/hooks';
import { compact, int } from '@/lib/format';
import { BLOCKS_PER_DAY, BLOCK_SECONDS, nextSigningChange, signingRewardAt } from '@/data/emission';
import { links } from '@/lib/links';
import Sparkline from '@/components/charts/Sparkline';
import { DocLink, Skel } from '@/components/ui/Primitives';
import { DemoTag } from '@/components/ui/Demo';
import Icon from '@/components/Icon';
import s from './Home.module.css';

/** Emissions at a glance: the documented schedule applied to the current height. */
export default function EmissionsGlance() {
  const { data: st } = useStatus();
  const supply = useQuery('supply-90d', () => source.getSeries('supply', '90d'));
  const h = st?.blockheight ?? null;
  const reward = h != null ? signingRewardAt(h + 1) : null;
  const next = h != null ? nextSigningChange(h + 1) : null;
  const blocksLeft = next && h != null ? next.at - (h + 1) : null;
  const days = blocksLeft != null ? (blocksLeft * BLOCK_SECONDS) / 86400 : null;
  const vals = supply.data?.points.map((p) => p.v) ?? [];
  const first = vals[0];
  const last = vals[vals.length - 1];

  return (
    <section className={s.emis} aria-labelledby="em-title">
      <div className={s.sectionHead}>
        <h2 id="em-title" className={s.h2}>
          Emissions at a glance
        </h2>
        <p className={s.lead}>
          New IXI comes only from block signing. Below, the emission schedule at the current height.
        </p>
      </div>
      <div className={s.emisGrid}>
        <div className={s.emisCell}>
          <p className={s.cellK}>Signing reward</p>
          <p className={s.emisV}>{reward != null ? `${int(reward)} IXI` : <Skel w={120} h={30} />}</p>
          <p className={s.cellSub}>per block, split among its signers</p>
        </div>
        <div className={s.emisCell}>
          <p className={s.cellK}>Next change</p>
          {next && days != null && h != null ? (
            <>
              <p className={s.emisV}>
                {int(next.from ?? 0)} <Icon name="arrow" size={18} className={s.emisArrow} /> {int(next.to ?? 0)} IXI
              </p>
              <p className={s.cellSub}>
                at block{' '}
                <span className="ix-num">{int(next.at)}</span>, in about {days < 2 ? `${Math.round(days * 24)} hours` : `${Math.round(days)} days`}{' '}
                <DemoTag />
              </p>
              <div
                className={s.meter}
                role="meter"
                aria-label="Blocks until the next reward change"
                aria-valuemin={0}
                aria-valuemax={90 * BLOCKS_PER_DAY}
                aria-valuenow={Math.max(0, 90 * BLOCKS_PER_DAY - (blocksLeft ?? 0))}
              >
                <i style={{ width: `${Math.max(2, Math.min(100, 100 - ((blocksLeft ?? 0) / (90 * BLOCKS_PER_DAY)) * 100))}%` }} />
              </div>
              <p className={s.meterNote}>Last 90 days of the countdown</p>
            </>
          ) : (
            <Skel w={160} h={30} />
          )}
        </div>
        <div className={s.emisCell}>
          <p className={s.cellK}>
            Supply, 90 days <DemoTag />
          </p>
          <p className={s.emisV}>{last != null ? `${compact(last, 2)} IXI` : <Skel w={130} h={30} />}</p>
          <div className={s.spark}>
            {vals.length > 1 ? (
              <Sparkline
                color="var(--ix-m-ixi)"
                values={vals}
                width={240}
                height={44}
                live
                label={`Supply rose from ${int(first)} to ${int(last)} IXI over 90 days.`}
              />
            ) : (
              <Skel h={44} />
            )}
          </div>
        </div>
      </div>
      <div className={s.emisFoot}>
        <p>
          Signers prove work to be eligible to sign.{' '}
          <DocLink href={links.docs.emission}>Emission schedule</DocLink>
        </p>
        <Link href="/ixi" className={s.more}>
          Supply and emissions <Icon name="arrow" size={14} />
        </Link>
      </div>
    </section>
  );
}
