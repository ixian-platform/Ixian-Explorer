'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Metric, Range, Series } from '@/data/types';
import { RANGES } from '@/data/types';
import { source } from '@/data/source';
import { useQuery, useStatus } from '@/lib/hooks';
import { compact, dec, hashrate, int, shortDate, utc } from '@/lib/format';
import { links } from '@/lib/links';
import { PageHead, Figures, Fig } from '@/components/page/Page';
import { Segmented, DocLink, Skel } from '@/components/ui/Primitives';
import { DemoTag } from '@/components/ui/Demo';
import Chart from '@/components/charts/Chart';
import ComboChart from '@/components/charts/ComboChart';
import p from '@/components/page/Page.module.css';
import s from './Stats.module.css';

const LABEL: Record<Range, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
const BUCKET: Record<Range, string> = { '24h': '10-minute', '7d': 'hourly', '30d': '6-hour', '90d': 'daily' };

/* Series answers are kept for a minute, and once a range has loaded the other ranges are fetched
   while the browser is idle, so switching ranges is instant. */
const METRICS: Metric[] = ['tx', 'tps', 'nodesDlt', 'nodesS2', 'supply', 'emission', 'blocktime', 'signerDifficulty', 'requiredDifficulty', 'hashrate', 'signatures', 'sigRequired'];
const seriesCache = new Map<string, { at: number; p: Promise<Series | null> }>();
function cachedSeries(metric: Metric, range: Range) {
  const key = `${metric}|${range}`;
  const hit = seriesCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.p;
  const p = source.getSeries(metric, range);
  seriesCache.set(key, { at: Date.now(), p });
  p.catch(() => seriesCache.delete(key));
  return p;
}
function usePrefetchRanges(range: Range) {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number };
    const idle = (fn: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 3000 }) : window.setTimeout(fn, 800));
    let cancelled = false;
    const todo = RANGES.filter((r) => r !== range).flatMap((r) => METRICS.map((m) => [m, r] as const));
    const next = () => {
      if (cancelled || !todo.length) return;
      const [m, r] = todo.shift()!;
      void cachedSeries(m, r).finally(() => idle(next));
    };
    const t = window.setTimeout(() => idle(next), 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [range]);
}

function useSeries(metric: Metric, range: Range) {
  const q = useQuery(`${metric}|${range}`, () => cachedSeries(metric, range));
  return {
    points: q.data?.points ?? null,
    step: q.data?.step ?? 3600,
    peak: q.data?.peak ?? null,
    loading: q.status === 'loading' && !!q.data,
    error: q.status === 'error' ? 'This series is not available right now.' : undefined,
  };
}

export default function StatsView() {
  const q = useSearchParams();
  const router = useRouter();
  const r = q.get('range');
  const range: Range = RANGES.includes(r as Range) ? (r as Range) : '30d';
  const { data: status } = useStatus();
  usePrefetchRanges(range);

  const tx = useSeries('tx', range);
  const tps = useSeries('tps', range);
  const dlt = useSeries('nodesDlt', range);
  const s2 = useSeries('nodesS2', range);
  const supply = useSeries('supply', range);
  const emission = useSeries('emission', range);
  const bt = useSeries('blocktime', range);
  const diff = useSeries('signerDifficulty', range);
  const req = useSeries('requiredDifficulty', range);
  const hr = useSeries('hashrate', range);
  const sig = useSeries('signatures', range);
  const sigReq = useSeries('sigRequired', range);

  const txTotal = tx.points?.reduce((a, x) => a + x.v, 0) ?? null;
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[range];
  const record = status?.tpsPeak ?? null;
  const peak = tps.peak;
  const recordInRange = record && peak && record.height === peak.height;
  const emitted = emission.points?.reduce((a, x) => a + x.v, 0) ?? null;

  const bucket = `${BUCKET[range]} buckets, UTC`;

  return (
    <div className={`ix-container ${p.page}`}>
      <PageHead
        eyebrow={
          <>
            Explore <DemoTag />
          </>
        }
        title="Statistics"
        meta={<span>Transactions, throughput, nodes, supply, block time and signing, over the range you pick.</span>}
      />

      <div className={s.filter}>
        <Segmented<Range>
          label="Range"
          value={range}
          onChange={(v) => router.replace(`/stats?range=${v}`, { scroll: false })}
          options={RANGES.map((x) => ({ value: x, label: x }))}
        />
        <span className={s.filterNote}>Every chart below shows the last {LABEL[range]}. Each has a table.</span>
      </div>

      <div className={s.figs}>
        <Figures cols={4}>
          <Fig mark="tx" k={`Transactions, ${LABEL[range]}`} v={txTotal != null ? int(txTotal) : tx.error ? 'Unavailable' : <Skel w={90} h={22} />} sub={txTotal != null ? `${int(txTotal / days)} a day on average` : undefined} />
          <Fig
            mark="tx"
            k="Peak TPS in range"
            v={peak ? dec(peak.tps, 2) : tps.error ? 'Unavailable' : <Skel w={90} h={22} />}
            sub={
              peak ? (
                <Link href={`/block?h=${peak.height}`} className="ix-link">
                  block {int(peak.height)}
                </Link>
              ) : undefined
            }
          />
          <Fig
            mark="tx"
            k="TPS record"
            v={record && record.height ? dec(record.tps, 2) : status ? (source.kind === 'mock' ? 'Not in demo' : 'Unavailable') : <Skel w={90} h={22} />}
            sub={
              record && record.height ? (
                <Link href={`/block?h=${record.height}`} className="ix-link">
                  block {int(record.height)}, {shortDate(record.timestamp)}
                </Link>
              ) : undefined
            }
          />
          <Fig mark="ixi" k={`New IXI, ${LABEL[range]}`} v={emitted != null ? compact(emitted, 2) : emission.error ? 'Unavailable' : <Skel w={90} h={22} />} sub="from block signing" />
        </Figures>
      </div>

      <section className={s.group} aria-labelledby="g-activity">
        <h2 id="g-activity" className={s.groupTitle}>
          Activity
        </h2>
        <div className={s.grid1}>
          <Chart
            title="Transactions"
            subtitle={`Transactions per bucket; ${bucket}`}
            kind="bar"
            capOutliers
            color="var(--ix-m-tx)"
            {...tx}
            loadingFrame={tx.loading}
            format={(v) => int(v)}
            tick={(v) => compact(v)}
            valueLabel="Transactions"
          />
          <Chart
            title="Transactions per second"
            subtitle={`Highest single-block TPS in each bucket; ${bucket}`}
            {...tps}
            color="var(--ix-m-tx)"
            zero
            capOutliers
            loadingFrame={tps.loading}
            format={(v) => dec(v, 2)}
            tick={(v) => compact(v)}
            marker={peak ? { t: peak.timestamp, label: `Peak ${dec(peak.tps, 2)} TPS · block ${int(peak.height)}` } : null}
            valueLabel="TPS"
            footer={
              record && record.height ? (
                <>
                  {recordInRange ? 'The peak in this range is the record: ' : 'Record, outside this range: '}
                  <Link href={`/block?h=${record.height}`} className="ix-link">
                    {dec(record.tps, 2)} TPS in block {int(record.height)}
                  </Link>{' '}
                  at {utc(record.timestamp)}. <DocLink href={links.docs.parameters}>Network parameters</DocLink>
                </>
              ) : (
                <DocLink href={links.docs.parameters}>Network parameters</DocLink>
              )
            }
          />
        </div>
      </section>

      <section className={s.group} aria-labelledby="g-nodes">
        <h2 id="g-nodes" className={s.groupTitle}>
          Nodes
        </h2>
        <div className={s.grid1}>
          <ComboChart
            title="Nodes online"
            subtitle={`At the end of each bucket; ${bucket}`}
            step={dlt.step}
            loadingFrame={dlt.loading}
            error={dlt.error ?? s2.error}
            lanes={[{ id: 'n', label: 'Nodes', zero: true, height: 170 }]}
            series={[
              { key: 'dlt', label: 'DLT nodes', color: 'var(--ix-node-dlt)', points: dlt.points, format: (v) => int(v), lane: 'n' },
              { key: 's2', label: 'S2 nodes', color: 'var(--ix-node-s2)', points: s2.points, format: (v) => int(v), lane: 'n' },
            ]}
          />
        </div>
        <p className={s.note}>
          Both node types on one axis. Click a legend entry to hide it. <Link href="/network" className="ix-link">See the nodes on the globe</Link>
        </p>
      </section>

      <section className={s.group} aria-labelledby="g-supply">
        <h2 id="g-supply" className={s.groupTitle}>
          Supply and emissions
        </h2>
        <div className={s.grid2}>
          <Chart
            title="In circulation"
            subtitle={`At the end of each bucket; ${bucket}`}
            {...supply}
            color="var(--ix-m-ixi)"
            loadingFrame={supply.loading}
            format={(v) => `${int(v)} IXI`}
            tick={(v) => compact(v, 3)}
            live
            valueLabel="In circulation (IXI)"
          />
          <Chart
            title="New IXI"
            subtitle={`Created per bucket; ${bucket}`}
            kind={range === '90d' ? 'bar' : 'line'}
            {...emission}
            color="var(--ix-m-ixi)"
            loadingFrame={emission.loading}
            format={(v) => `${int(v)} IXI`}
            tick={(v) => compact(v)}
            valueLabel="New IXI"
            footer={
              <>
                Signing rewards follow the emission schedule. <Link href="/ixi" className="ix-link">Emission schedule</Link>
              </>
            }
          />
        </div>
      </section>

      <section className={s.group} aria-labelledby="g-blocks">
        <h2 id="g-blocks" className={s.groupTitle}>
          Blocks and signing
        </h2>
        <div className={s.grid1}>
          <ComboChart
            title="Block status"
            subtitle={`Average block time, transactions and signatures; ${bucket}. The fastest and slowest blocks are in the block time chart below.`}
            step={bt.step}
            loadingFrame={bt.loading}
            error={bt.error ?? tx.error ?? sig.error}
            lanes={[
              { id: 'time', label: 'Block time', tick: (v) => `${int(v)} s`, reference: { value: 30, label: 'Target 30 s' }, domain: [0, 60], clipAt: 120, height: 100 },
              { id: 'tx', label: 'Transactions', tick: (v) => compact(v), cap: true, zero: true, height: 100 },
              { id: 'sig', label: 'Signatures', tick: (v) => dec(v, 0), zero: true, height: 100 },
            ]}
            series={[
              { key: 'bt', label: 'Block time', color: 'var(--ix-m-time)', points: bt.points, format: (v) => `${dec(v, 1)} s`, lane: 'time' },
              { key: 'tx', label: 'Transactions', color: 'var(--ix-m-tx)', points: tx.points, format: (v) => int(v), lane: 'tx', kind: 'bar' },
              { key: 'sig', label: 'Signatures', color: 'var(--ix-m-signers)', points: sig.points, format: (v) => dec(v, 1), lane: 'sig' },
            ]}
          />
          <ComboChart
            title="Block signing"
            subtitle={`What signed each block against what was required; averages per bucket; ${bucket}`}
            step={diff.step}
            loadingFrame={diff.loading}
            error={diff.error ?? req.error ?? sig.error ?? sigReq.error}
            lanes={[
              { id: 'd', label: 'Signer difficulty', log: true, tick: (v) => compact(v), height: 130 },
              { id: 's', label: 'Signatures', zero: true, tick: (v) => dec(v, 0), height: 110 },
            ]}
            series={[
              { key: 'td', label: 'Total signer difficulty', color: 'var(--ix-m-difficulty)', points: diff.points, format: (v) => compact(v, 3), lane: 'd' },
              { key: 'rd', label: 'Required signer difficulty', color: 'var(--ix-m-difficulty)', points: req.points, format: (v) => compact(v, 3), lane: 'd', dashed: true },
              { key: 'sg', label: 'Signatures', color: 'var(--ix-m-signers)', points: sig.points, format: (v) => dec(v, 1), lane: 's' },
              { key: 'rs', label: 'Required signatures', color: 'var(--ix-m-signers)', points: sigReq.points, format: (v) => dec(v, 1), lane: 's', dashed: true },
            ]}
            footer={
              <>
                Solid is what signed, dashed is what was required: a block needs 75% of the recent average signature count and the required signer difficulty.{' '}
                <DocLink href={links.docs.consensus}>Ixiac consensus</DocLink>
              </>
            }
          />
        </div>
        <div className={s.grid2} style={{ marginTop: 40 }}>
          <Chart
            title="Block time"
            subtitle={`Average seconds per block, with the fastest and slowest block; ${bucket}`}
            {...bt}
            band
            color="var(--ix-m-time)"
            loadingFrame={bt.loading}
            format={(v) => `${dec(v, 1)} s`}
            tick={(v) => `${int(v)} s`}
            reference={{ value: 30, label: 'Target 30 s' }}
            valueLabel="Average block time"
          />
          <Chart
            title="Estimated signer hashrate"
            subtitle={`Signer difficulty over 900 seconds, as the current explorer computes it; ${bucket}`}
            {...hr}
            color="var(--ix-m-difficulty)"
            loadingFrame={hr.loading}
            format={(v) => hashrate(v)}
            tick={(v) => compact(v)}
            valueLabel="Hashrate (H/s)"
          />
        </div>
        <p className={s.note}>
          Signers solve SHA3-512 proof of work to be eligible to sign.{' '}
          <DocLink href={links.docs.consensus}>Consensus</DocLink>
        </p>
      </section>
    </div>
  );
}
