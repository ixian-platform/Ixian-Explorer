'use client';

import { useStatus } from '@/lib/hooks';
import { compact, int } from '@/lib/format';
import { links } from '@/lib/links';
import {
  BLOCKS_PER_DAY,
  BLOCK_SECONDS,
  GENESIS_SUPPLY,
  SIGNING_SCHEDULE,
  nextSigningChange,
  signingRewardAt,
  type RewardStep,
} from '@/data/emission';
import { PageHead, Section, Figures, Fig } from '@/components/page/Page';
import { DocLink, Skel } from '@/components/ui/Primitives';
import { DemoTag } from '@/components/ui/Demo';
import StepChart from '@/components/charts/StepChart';
import p from '@/components/page/Page.module.css';
import s from './Ixi.module.css';

function ScheduleTable({ steps, now, caption }: { steps: RewardStep[]; now: number | null; caption: string }) {
  return (
    <table className={s.sched}>
      <caption className="ix-sr">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Blocks</th>
          <th scope="col" className={p.num}>
            Reward per block
          </th>
        </tr>
      </thead>
      <tbody>
        {steps.map((st) => {
          const current = now != null && now >= st.from && (st.to == null || now <= st.to);
          return (
            <tr key={st.from} data-current={current || undefined}>
              <td className="ix-num">
                {int(st.from)} to {st.to != null ? int(st.to) : 'onwards'}
                {current && <span className={s.nowTag}>now</span>}
              </td>
              <td className={p.num}>{st.reward != null ? `${st.reward.toLocaleString('en')} IXI` : st.note}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function IxiView() {
  const { data: status } = useStatus();
  const h = status?.blockheight ?? null;
  const supply = status ? Number(status.totalixi) : null;
  const reward = h != null ? signingRewardAt(h + 1) : null;
  const next = h != null ? nextSigningChange(h + 1) : null;
  const daysToNext = next && h != null ? ((next.at - h - 1) * BLOCK_SECONDS) / 86400 : null;


  return (
    <div className={`ix-container ${p.page}`}>
      <PageHead
        eyebrow={
          <>
            Explore <DemoTag />
          </>
        }
        title="IXI"
        meta={<span>How much IXI exists and where new IXI comes from.</span>}
      />

      <div style={{ marginTop: 28 }}>
        <Figures cols={4}>
          <Fig mark="ixi" k="In circulation" v={supply != null ? `${compact(supply, 3)} IXI` : <Skel w={120} h={24} />} sub={supply != null ? `${int(supply)} IXI` : undefined} />
          <Fig mark="ixi" k="New IXI per day" v={reward != null ? int(reward * BLOCKS_PER_DAY) : <Skel w={120} h={24} />} sub={reward != null ? `${int(reward)} IXI per block` : undefined} />
          <Fig
            k="Next change"
            v={next ? `${int(next.to ?? 0)} IXI per block` : <Skel w={140} h={24} />}
            sub={
              next && daysToNext != null ? (
                <>
                  at block {int(next.at)}, in about {Math.round(daysToNext)} days <DemoTag />
                </>
              ) : undefined
            }
          />
          <Fig mark="ixi" k="At genesis" v={`${compact(GENESIS_SUPPLY, 4)} IXI`} sub={<DocLink href={links.docs.emission}>Premine</DocLink>} />
        </Figures>
      </div>

      <Section
        id="emissions"
        title="Emissions"
        lead="New IXI comes only from block signing. The signing reward is paid to the DLT nodes that sign each block."
        aside={<DocLink href={links.docs.emission}>IXI emission</DocLink>}
      >
        <div className={s.emGrid}>
          <div className={s.emChart}>
            <h3 className={s.h3}>Signing reward per block</h3>
            <p className={s.sub}>IXI per block over block height, to block 16M. From block 105,120,000 it stays at 36 IXI.</p>
            <StepChart title="Signing reward per block" steps={SIGNING_SCHEDULE} now={h} xMax={16_000_000} valueAt={(x) => signingRewardAt(x)} />
          </div>
          <ScheduleTable steps={SIGNING_SCHEDULE} now={h} caption="Signing reward schedule" />
        </div>
      </Section>

    </div>
  );
}
