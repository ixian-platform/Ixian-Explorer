'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import SigningChart from '@/components/charts/SigningChart';
import type { NodeInfo, NodeKind, NodeVersion } from '@/data/types';
import { source } from '@/data/source';
import { isNotAvailable } from '@/data/api';
import { useNow, useQuery, useStatus } from '@/lib/hooks';
import { ago, compact, duration, hashrate, int } from '@/lib/format';
import { links } from '@/lib/links';
import { PageHead, Section, Figures, Fig } from '@/components/page/Page';
import { Segmented, Skel, StateBox, RetryButton, Pager, DocLink } from '@/components/ui/Primitives';
import { DemoTag, LiveBadge } from '@/components/ui/Demo';
import GlobePanel from '@/components/globe/GlobePanel';
import p from '@/components/page/Page.module.css';
import s from './Network.module.css';

type Kind = 'all' | NodeKind;
type Col = 'kind' | 'city' | 'country' | 'version' | 'uptime' | 'lastSeen';
const PAGE = 25;

/** Version counts from the node list, or from the server's version counts when locations aren't published. */
function versionCounts(nodes: NodeInfo[] | null, counts: NodeVersion[] | null, kind: NodeKind): [string, number][] {
  const m = new Map<string, number>();
  if (nodes) nodes.filter((n) => n.kind === kind).forEach((n) => m.set(n.version, (m.get(n.version) ?? 0) + 1));
  else (counts ?? []).filter((c) => c.kind === kind).forEach((c) => m.set(c.version, (m.get(c.version) ?? 0) + c.count));
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0], 'en', { numeric: true }));
}

function Versions({ nodes, counts, kind }: { nodes: NodeInfo[] | null; counts: NodeVersion[] | null; kind: NodeKind }) {
  const rows = versionCounts(nodes, counts, kind);
  const list = { length: rows.reduce((a, r) => a + r[1], 0) };
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className={s.versions}>
      <h3 className={s.vTitle}>
        {kind === 'dlt' ? 'DLT nodes' : 'S2 nodes'} <span className={p.muted}>({int(list.length)})</span>
      </h3>
      <table className={s.vTable}>
        <caption className="ix-sr">{kind === 'dlt' ? 'DLT' : 'S2'} node versions</caption>
        <thead className="ix-sr">
          <tr>
            <th scope="col">Version</th>
            <th scope="col">Nodes</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([v, c], i) => (
            <tr key={v}>
              <th scope="row">
                <span className={s.vName}>
                  <i className="ix-status" data-s={i === 0 ? 'good' : 'warning'} aria-hidden />
                  <span className="ix-mono">{v}</span>
                  <span className={i === 0 ? s.vLatest : s.vOld}>{i === 0 ? 'latest' : 'older'}</span>
                </span>
              </th>
              <td className={s.vBarCell}>
                <span className={s.vBar} data-kind={kind} data-latest={i === 0 || undefined} style={{ width: `${(c / max) * 100}%` }} aria-hidden />
              </td>
              <td className={`${s.vNum} ix-num`}>{int(c)}</td>
              <td className={`${s.vNum} ${p.muted} ix-num`}>{Math.round((c / list.length) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NetworkView() {
  const q = useSearchParams();
  const cityParam = q.get('city');
  const nodes = useQuery('nodes', () => source.getNodes());
  const latest = useQuery('latest-block', () => source.getLatestBlock());
  const { data: status } = useStatus();
  const now = useNow(5000);
  const latestVersion = useMemo(() => {
    const out: Record<string, string> = {};
    for (const n of nodes.data ?? []) if (!out[n.kind] || n.version.localeCompare(out[n.kind], 'en', { numeric: true }) > 0) out[n.kind] = n.version;
    return out;
  }, [nodes.data]);
  const list = nodes.status === 'ok' ? nodes.data : null;
  // the explorer server doesn't publish node locations yet: counts and versions only
  const unpublished = nodes.status === 'error' && isNotAvailable(nodes.error);
  const versions = useQuery(unpublished && source.getNodeVersions ? 'node-versions' : null, () => source.getNodeVersions!());

  const [kind, setKind] = useState<Kind>('all');
  const [text, setText] = useState(cityParam ? cityParam.split('|')[0] : '');
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'kind', dir: 1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    if (!list) return null;
    const t = text.trim().toLowerCase();
    const f = list.filter(
      (n) => (kind === 'all' || n.kind === kind) && (!t || n.city.toLowerCase().includes(t) || n.country.toLowerCase().includes(t) || n.version.includes(t))
    );
    const key = (n: NodeInfo): string | number =>
      sort.col === 'uptime' ? n.uptime : sort.col === 'lastSeen' ? -n.lastSeen : sort.col === 'kind' ? `${n.kind}${n.id}` : String(n[sort.col]);
    return f.sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [list, kind, text, sort]);

  const countries = list ? new Set(list.map((n) => n.countryCode)).size : null;
  const cities = list ? new Set(list.map((n) => `${n.city}|${n.countryCode}`)).size : null;
  const b = latest.data;

  const th = (col: Col, label: string, num = false) => (
    <th scope="col" className={num ? p.num : undefined} aria-sort={sort.col === col ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={p.sortBtn}
        data-active={sort.col === col || undefined}
        onClick={() => {
          setSort((s0) => ({ col, dir: s0.col === col ? ((-s0.dir) as 1 | -1) : 1 }));
          setPage(0);
        }}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M5 1.5L8 4.5H2z" fill={sort.col === col && sort.dir === 1 ? 'currentColor' : 'var(--ix-ink-5)'} />
          <path d="M5 8.5L2 5.5h6z" fill={sort.col === col && sort.dir === -1 ? 'currentColor' : 'var(--ix-ink-5)'} />
        </svg>
      </button>
    </th>
  );

  return (
    <div className={`ix-container ${p.page}`}>
      <PageHead
        eyebrow={
          <>
            Explore <DemoTag />
          </>
        }
        title="Network"
        meta={
          <>
            <span>The DLT nodes that sign blocks and the S2 nodes that relay traffic, where they are and what they run.</span>
            <LiveBadge label="Updating" />
          </>
        }
      />

      <div style={{ marginTop: 28 }}>
        <Figures cols={5}>
          <Fig mark="dlt" k="DLT nodes" v={status ? int(status.nodes_m) : <Skel w={60} h={24} />} sub={<DocLink href={links.docs.operatorsDlt}>Run a DLT node</DocLink>} />
          <Fig mark="s2" k="S2 nodes" v={status ? int(status.nodes_r) : <Skel w={60} h={24} />} sub={<DocLink href={links.docs.operatorsS2}>Run an S2 node</DocLink>} />
          <Fig
            k="Countries"
            v={unpublished ? '–' : countries != null ? int(countries) : <Skel w={40} h={24} />}
            sub={unpublished ? 'locations not published yet' : cities != null ? `${int(cities)} cities` : undefined}
          />
          <Fig
            mark="signers"
            k="Last block signers"
            v={b ? `${int(b.sigCount)} of ${int(b.sigRequired)}` : <Skel w={90} h={24} />}
            sub={b ? <Link href={`/block?h=${b.id}`} className="ix-link">block {int(b.id)}</Link> : undefined}
          />
          <Fig mark="difficulty" k="Signer hashrate" v={b ? hashrate(Number(b.hashrate)) : <Skel w={90} h={24} />} sub="estimated, last block" />
        </Figures>
      </div>

      <Section title="Where the nodes are" lead="City-level positions only, slightly offset. Node IP addresses are never shown.">
        {unpublished ? (
          <GlobePanel nodes={[]} variant="page" unpublished />
        ) : nodes.status === 'error' ? (
          <StateBox kind="error" title="The node list could not be loaded." action={<RetryButton onClick={nodes.reload} />} />
        ) : (
          <GlobePanel nodes={list} variant="page" initialCity={cityParam} />
        )}
      </Section>

      <Section title="Versions" lead="What the nodes run, from the agent string each node reports.">
        {list || versions.data ? (
          <div className={s.vGrid}>
            <Versions nodes={list} counts={versions.data} kind="dlt" />
            <Versions nodes={list} counts={versions.data} kind="s2" />
          </div>
        ) : unpublished && versions.status !== 'loading' ? (
          <StateBox kind="empty" title="Node versions aren't available yet." />
        ) : (
          <Skel h={120} />
        )}
      </Section>

      <Section
        title="Block signing"
        lead="Every block is signed by DLT nodes that proved work; it needs 75% of the recent average signature count."
        aside={<DocLink href={links.docs.consensus}>Ixiac consensus</DocLink>}
      >
        <Figures cols={4}>
          <Fig mark="signers" k="Signatures, last block" v={b ? int(b.sigCount) : '…'} sub={`up to ${int(1000)} signers per block`} />
          <Fig mark="signers" k="Required signatures" v={b ? int(b.sigRequired) : '…'} />
          <Fig mark="difficulty" k="Signer difficulty, last block" v={b ? compact(Number(b.totalSignerDifficulty), 3) : '…'} sub={b ? `required ${compact(Number(b.requiredSignerDifficulty), 3)}` : undefined} />
          <Fig mark="ixi" k="Signing reward" v={status ? `${int(Number(status.signingReward))} IXI` : '…'} sub="per block, shared by its signers" />
        </Figures>
        <div style={{ marginTop: 32 }}>
          <SigningChart />
        </div>
        <p className={s.more}>
          <Link href="/stats?range=30d#g-blocks" className="ix-link">
            Signing over time
          </Link>
        </p>
      </Section>

      {!unpublished && (
        <Section
          id="nodes"
          title={rows ? `All nodes (${int(rows.length)})` : 'All nodes'}
          aside={
            <div className={s.tools}>
              <Segmented<Kind>
                label="Node type"
                size="sm"
                value={kind}
                onChange={(v) => {
                  setKind(v);
                  setPage(0);
                }}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'dlt', label: 'DLT' },
                  { value: 's2', label: 'S2' },
                ]}
              />
              <label className="ix-sr" htmlFor="nf">
                Filter by city, country or version
              </label>
              <input
                id="nf"
                className={s.filterInput}
                placeholder="City, country or version"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          }
        >
          {rows && rows.length === 0 ? (
            <StateBox kind="empty" title="No nodes match." action={<button className="ix-btn ix-btn--sm" onClick={() => (setText(''), setKind('all'))}>Clear filters</button>} />
          ) : (
            <>
              <div className={p.tableWrap}>
                <table className={p.table} data-cards>
                  <caption className="ix-sr">Nodes</caption>
                  <thead>
                    <tr>
                      <th scope="col">Node</th>
                      {th('kind', 'Type')}
                      {th('city', 'City')}
                      {th('country', 'Country')}
                      {th('version', 'Version')}
                      {th('uptime', 'Uptime', true)}
                      {th('lastSeen', 'Last seen', true)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      ? rows.slice(page * PAGE, (page + 1) * PAGE).map((n) => (
                          <tr key={n.id}>
                            <td className="ix-mono" data-a="sub" data-last>{n.id}</td>
                            <td data-a="sub">
                              <span className={s.kind}>
                                <i className={n.kind === 'dlt' ? s.kDlt : s.kS2} aria-hidden />
                                {n.kind === 'dlt' ? 'DLT' : 'S2'}
                              </span>
                            </td>
                            <td data-a="t1">{n.city}</td>
                            <td className={p.muted} data-a="sub">{n.country}</td>
                            <td data-a="sub">
                              <span className={s.kind}>
                                <i className="ix-status" data-s={n.version === latestVersion[n.kind] ? 'good' : 'warning'} aria-hidden />
                                <span className="ix-mono">{n.version}</span>
                                {n.version !== latestVersion[n.kind] && <span className="ix-sr"> (older version)</span>}
                              </span>
                            </td>
                            <td className={p.num} data-a="sub" data-p="up">{duration(n.uptime)}</td>
                            <td className={`${p.num} ${p.muted}`} data-a="t2">
                              {now != null ? (
                                <span className={s.seen}>
                                  <i className="ix-status" data-s={now - n.lastSeen < 300 ? 'good' : now - n.lastSeen < 3600 ? 'warning' : 'critical'} aria-hidden />
                                  {ago(n.lastSeen, now)}
                                </span>
                              ) : (
                                ''
                              )}
                            </td>
                          </tr>
                        ))
                      : Array.from({ length: 10 }, (_, i) => (
                          <tr key={i}>
                            {[60, 40, 90, 90, 80, 70, 60].map((w, j) => (
                              <td key={j}>
                                <Skel w={w} h={13} />
                              </td>
                            ))}
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              {rows && <Pager page={page} total={rows.length} pageSize={PAGE} onPage={setPage} label="Node pages" />}
            </>
          )}
          <p className={s.privacy}>
            How locations work: {source.kind === 'mock' ? 'in this demo, nodes are placed in generated cities. ' : ''}With real data, the explorer server
            resolves each node&apos;s IP to a city with a local copy of a geo database. IPs never leave the server.{' '}
            <a href="https://db-ip.com" className="ix-link" target="_blank" rel="noopener noreferrer">
              IP geolocation by DB-IP
            </a>
            .
          </p>
        </Section>
      )}
    </div>
  );
}
