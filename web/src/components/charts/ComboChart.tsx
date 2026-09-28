'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SeriesPoint } from '@/data/types';
import { shortDate, shortDateTime, hhmm, utc } from '@/lib/format';
import Icon from '@/components/Icon';
import { Segmented } from '@/components/ui/Primitives';
import { useRouter } from 'next/navigation';
import { BucketCell, BlockValue, bucketHref } from './drill';
import s from './Chart.module.css';

/**
 * Several measures over the same time axis, like the old explorer's block
 * status and block signing charts, without their three y-axes:
 *
 * - Overlay (default): every lane drawn on one plot, each on its own honest scale
 *   (the legend states the ranges, the readout shows real values). Series in
 *   the same lane share a scale, so "signatures vs required" stays comparable.
 *   Every lane keeps an honest axis in both modes: counts from zero,
 *   block time on 0 to 60 s with anything slower clipped and marked, and no
 *   series stretched to fill the height when it barely moves.
 * - Stacked (opt in): one lane per unit, each with its own honest axis,
 *   one shared crosshair and one readout for every series.
 *
 * Series with the same unit share a lane; a "required" series is the same hue,
 * dashed. The legend toggles series; a table twin lists every value.
 */
export interface ComboSeries {
  key: string;
  label: string;
  /** metric token, e.g. var(--ix-m-tx) */
  color: string;
  points: SeriesPoint[] | null;
  format: (v: number) => string;
  lane: string;
  dashed?: boolean;
  kind?: 'line' | 'bar';
  /** draw the bucket's lowest to highest value (points' lo/hi) as a faint band */
  band?: boolean;
}
export interface ComboLane {
  id: string;
  label: string;
  tick?: (v: number) => string;
  /** log axis (for series whose values differ by orders of magnitude) */
  log?: boolean;
  zero?: boolean;
  height?: number;
  reference?: { value: number; label: string } | null;
  /** clip one extreme bucket (the stress test) so it does not flatten the rest */
  cap?: boolean;
  /** the axis always covers at least this range (block time: 0 to 60 s, the 30 s target in the middle) */
  domain?: [number, number];
  /** values above this are drawn clipped at the top, with a marker (a 10-minute block must not flatten the rest) */
  clipAt?: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

function niceTicks(min: number, max: number, count = 3) {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks };
}

function logTicks(min: number, max: number) {
  const lo = Math.floor(Math.log10(Math.max(min, 1e-9)));
  let hi = Math.ceil(Math.log10(Math.max(max, 1e-9)));
  if (hi === lo) hi = lo + 1;
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e++) ticks.push(Math.pow(10, e));
  return { lo, hi, ticks };
}

function timeLabel(t: number, step: number) {
  if (step < 3600) return hhmm(t);
  if (step < 21600) return shortDateTime(t);
  return shortDate(t);
}

type Mode = 'stack' | 'overlay';

export default function ComboChart({
  title,
  subtitle,
  step,
  series,
  lanes,
  footer,
  error,
  loadingFrame = false,
  defaultMode = 'overlay',
}: {
  title: string;
  subtitle?: ReactNode;
  step: number;
  series: ComboSeries[];
  lanes: ComboLane[];
  footer?: ReactNode;
  error?: ReactNode;
  loadingFrame?: boolean;
  defaultMode?: Mode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const router = useRouter();
  const [table, setTable] = useState(false);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const id = useId();
  const gid = id.replace(/:/g, '');

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, [table]);

  const ready = series.every((x) => x.points);
  const n = ready ? Math.min(...series.map((x) => x.points!.length)) : 0;
  const times = ready && n ? series[0].points!.slice(0, n).map((p) => p.t) : [];
  const shown = series.filter((x) => !hidden.has(x.key));
  const activeLanes = lanes.filter((l) => shown.some((x) => x.lane === l.id));
  const overlay = mode === 'overlay' && lanes.length > 1;

  const pad = { l: 8, r: overlay ? 12 : 58, t: 10, b: 26 };
  const gap = 18;
  const laneH = (l: ComboLane) => l.height ?? 110;
  const plotLanes = overlay ? [{ id: '__all', label: '', height: 250 } as ComboLane] : activeLanes;
  const H = pad.t + pad.b + plotLanes.reduce((a, l) => a + laneH(l), 0) + gap * Math.max(0, plotLanes.length - 1);
  const iw = w - pad.l - pad.r;

  /* one scale per lane (series in a lane share it); in overlay the lanes share the plot box */
  const geo = useMemo(() => {
    if (!ready || !n) return null;
    const box = new Map<string, { top: number; h: number }>();
    let y0 = pad.t;
    for (const l of plotLanes) {
      box.set(l.id, { top: y0, h: laneH(l) });
      y0 += laneH(l) + gap;
    }
    const scales = new Map<string, { y: (v: number) => number; ticks: number[]; lane: ComboLane; min: number; max: number; clip: number }>();
    for (const l of activeLanes) {
      const members = shown.filter((x) => x.lane === l.id);
      let min = Infinity;
      let max = -Infinity;
      for (const m of members)
        for (let i = 0; i < n; i++) {
          const pt = m.points![i];
          const lo = m.band && pt.lo != null ? Math.min(pt.v, pt.lo) : pt.v;
          const hi = m.band && pt.hi != null ? Math.max(pt.v, pt.hi) : pt.v;
          if (lo < min) min = lo;
          if (hi > max) max = hi;
        }
      if (l.domain) {
        min = Math.min(min, l.domain[0]);
        max = Math.max(max, l.domain[1]);
      }
      if (l.reference) {
        min = Math.min(min, l.reference.value);
        max = Math.max(max, l.reference.value);
      }
      const b = box.get(overlay ? '__all' : l.id)!;
      const inner = { top: b.top + 6, h: b.h - 10 };
      let y: (v: number) => number;
      let ticks: number[];
      let capv = Infinity;
      if (l.log) {
        const t = logTicks(min, max);
        // the same decades in both modes: overlay does not stretch a series to its own min and max
        const lo = t.lo;
        const hi = t.hi;
        y = (v) => r2(inner.top + inner.h - ((Math.log10(Math.max(v, 1e-9)) - lo) / (hi - lo || 1)) * inner.h);
        ticks = t.ticks;
      } else {
        if (l.clipAt != null && max > l.clipAt) {
          capv = l.clipAt;
          max = capv;
        }
        if (l.cap && n > 8) {
          const vals = members.flatMap((m) => m.points!.slice(0, n).map((p) => p.v)).sort((a, b) => a - b);
          const p90 = vals[Math.floor(vals.length * 0.9)];
          if (p90 > 0 && max > p90 * 6) {
            capv = p90 * 2.2;
            max = capv;
          }
        }
        const zero = l.zero || members.some((m) => m.kind === 'bar');
        if (zero) min = Math.min(0, min);
        if (max === min) max = min + 1;
        const padv = (max - min) * 0.08;
        const t = niceTicks(zero || l.domain ? min : min - padv, l.domain && max === l.domain[1] ? max : max + padv, 3);
        // honest in both modes: counts from zero, fixed domains kept, and no series stretched past its real spread
        const lo = t.lo;
        const hi = t.hi;
        y = (v) => r2(inner.top + inner.h - ((Math.min(v, capv) - lo) / (hi - lo || 1)) * inner.h);
        ticks = t.ticks;
      }
      scales.set(l.id, { y, ticks, lane: l, min: ticks[0], max: ticks[ticks.length - 1], clip: capv });
    }
    const x = (i: number) => r2(pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw));
    return { box, scales, x, bw: iw / n };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, n, series, hidden, mode, w]);

  const xTicks = useMemo(() => {
    if (!n) return [];
    const want = w < 480 ? 3 : w < 760 ? 4 : 6;
    const every = Math.max(1, Math.round(n / want));
    const out: number[] = [];
    for (let i = 0; i < n; i += every) out.push(i);
    return out;
  }, [n, w]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * w;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1)))));
  };

  const toggle = (k: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(k)) next.delete(k);
      else if (series.length - next.size > 1) next.add(k);
      return next;
    });

  const latest = (x: ComboSeries) => (x.points && x.points.length ? x.points[Math.min(n, x.points.length) - 1]?.v : undefined);

  return (
    <figure className={s.fig} aria-labelledby={`${id}-t`}>
      <figcaption className={s.head}>
        <div className={s.titles}>
          <h3 id={`${id}-t`} className={s.title}>
            {title}
          </h3>
          {subtitle && <p className={s.sub}>{subtitle}</p>}
        </div>
        <div className={s.headTools}>
          {lanes.length > 1 && !table && (
            <Segmented<Mode>
              label="Chart layout"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'overlay', label: 'Overlay' },
                { value: 'stack', label: 'Stacked' },
              ]}
            />
          )}
          <button type="button" className={`ix-btn ix-btn--sm ${s.tableBtn}`} aria-pressed={table} onClick={() => setTable((t) => !t)} disabled={!n}>
            <Icon name={table ? 'chart' : 'table'} size={14} /> {table ? 'Chart' : 'Table'}
          </button>
        </div>
      </figcaption>

      {/* legend: identity, latest value, and a switch per series */}
      <ul className={s.legend} aria-label="Series">
        {series.map((x) => {
          const off = hidden.has(x.key);
          const sc = geo?.scales.get(x.lane);
          const v = latest(x);
          return (
            <li key={x.key}>
              <button type="button" className={s.legendBtn} aria-pressed={!off} onClick={() => toggle(x.key)} title={off ? `Show ${x.label}` : `Hide ${x.label}`}>
                <svg width="18" height="10" aria-hidden className={s.legendSw}>
                  {x.kind === 'bar' ? (
                    <rect x="4" y="1" width="10" height="8" rx="2" fill={x.color} />
                  ) : (
                    <line x1="1" x2="17" y1="5" y2="5" stroke={x.color} strokeWidth="2.5" strokeDasharray={x.dashed ? '4 3' : undefined} strokeLinecap="round" />
                  )}
                </svg>
                <span className={s.legendLabel}>{x.label}</span>
                {v != null && <span className={s.legendV}>{x.format(v)}</span>}
                {overlay && sc && !off && (
                  <span className={s.legendRange} title="The scale this series is drawn on">
                    scale {(sc.lane.tick ?? x.format)(sc.min)} to {(sc.lane.tick ?? x.format)(sc.max)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div ref={wrap} className={s.plotWrap} data-loading={(loadingFrame && ready) || undefined}>
        {error ? (
          <div className={s.error} style={{ height: 240 }}>
            {error}
          </div>
        ) : !ready ? (
          <div className={`ix-skel ${s.skel}`} style={{ height: 240 }} aria-hidden />
        ) : n === 0 ? (
          <div className={s.error} style={{ height: 240 }}>
            No data in this range.
          </div>
        ) : table ? (
          <div className={s.tableWrap} style={{ maxHeight: 320 }}>
            <table className={s.table}>
              <caption className="ix-sr">{title}</caption>
              <thead>
                <tr>
                  <th scope="col">{step >= 86400 ? 'Day (UTC)' : 'From (UTC)'}</th>
                  {series.map((x) => (
                    <th key={x.key} scope="col">
                      {x.label}
                    </th>
                  ))}
                  {series
                    .filter((x) => x.band)
                    .map((x) => (
                      <th key={`${x.key}-hi`} scope="col">
                        Slowest block
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {times
                  .map((t, i) => ({ t, i }))
                  .reverse()
                  .map(({ t, i }) => (
                    <tr key={t}>
                      <td>
                        <BucketCell p={series[0].points![i]} step={step} />
                      </td>
                      {series.map((x) => (
                        <td key={x.key} className="ix-num">
                          {x.format(x.points![i].v)}
                        </td>
                      ))}
                      {series
                        .filter((x) => x.band)
                        .map((x) => (
                          <td key={`${x.key}-hi`} className="ix-num">
                            <BlockValue v={x.points![i].hi} h={x.points![i].hiH} format={x.format} />
                          </td>
                        ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          geo && (
            <>
              <svg
                className={s.svg}
                width={w}
                height={H}
                viewBox={`0 0 ${w} ${H}`}
                role="img"
                aria-label={`${title}. ${shown.map((x) => `${x.label} latest ${latest(x) != null ? x.format(latest(x)!) : ''}`).join('; ')}. Use the arrow keys for values, or open the table.`}
                tabIndex={0}
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
                onClick={() => {
                  const href = hover != null && ready ? bucketHref(series[0].points![hover]) : null;
                  if (href) router.push(href);
                }}
                style={hover != null && ready && bucketHref(series[0].points![hover]) ? { cursor: 'pointer' } : undefined}
                onFocus={() => setHover((h) => h ?? n - 1)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const d = e.key === 'ArrowLeft' ? -1 : 1;
                    setHover((h) => Math.max(0, Math.min(n - 1, (h ?? n - 1) + d)));
                  } else if (e.key === 'Home') setHover(0);
                  else if (e.key === 'End') setHover(n - 1);
                }}
              >
                <defs>
                  {series.map((x) => (
                    <linearGradient key={x.key} id={`${gid}${x.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={x.color} stopOpacity="0.2" />
                      <stop offset="1" stopColor={x.color} stopOpacity="0" />
                    </linearGradient>
                  ))}
                </defs>

                {/* lane frames: grid, ticks, lane label */}
                {overlay ? (
                  <g>
                    {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                      const b = geo.box.get('__all')!;
                      const yy = r2(b.top + 6 + (b.h - 10) * f);
                      return <line key={f} x1={pad.l} x2={pad.l + iw} y1={yy} y2={yy} stroke="var(--ix-line)" strokeWidth="1" />;
                    })}
                  </g>
                ) : (
                  activeLanes.map((l) => {
                    const sc = geo.scales.get(l.id)!;
                    const b = geo.box.get(l.id)!;
                    return (
                      <g key={l.id}>
                        {sc.ticks
                          .filter((t) => sc.y(t) >= b.top - 1 && sc.y(t) <= b.top + b.h + 1)
                          .map((t) => (
                            <g key={t}>
                              <line x1={pad.l} x2={pad.l + iw} y1={sc.y(t)} y2={sc.y(t)} stroke="var(--ix-line)" strokeWidth="1" />
                              <text x={w - pad.r + 8} y={sc.y(t) + 4} className={s.tick}>
                                {(l.tick ?? shown.find((x) => x.lane === l.id)!.format)(t)}
                              </text>
                            </g>
                          ))}
                        <text x={pad.l + 2} y={b.top + 4} className={s.laneLabel}>
                          {l.label}
                          {l.log ? ' · log scale' : ''}
                        </text>
                      </g>
                    );
                  })
                )}

                {/* reference lines (targets): dashed neutral */}
                {activeLanes.map((l) => {
                  if (!l.reference) return null;
                  const sc = geo.scales.get(l.id)!;
                  const yy = sc.y(l.reference.value);
                  return (
                    <g key={`r${l.id}`}>
                      <line x1={pad.l} x2={pad.l + iw} y1={yy} y2={yy} stroke="var(--ix-threshold)" strokeWidth="1" strokeDasharray="2 4" />
                      <text x={pad.l + iw - 4} y={yy - 5} textAnchor="end" className={s.refLabel}>
                        {l.reference.label}
                      </text>
                    </g>
                  );
                })}

                {/* bars first, then areas, then lines */}
                {shown
                  .filter((x) => x.kind === 'bar')
                  .map((x) => {
                    const sc = geo.scales.get(x.lane)!;
                    const b = geo.box.get(overlay ? '__all' : x.lane)!;
                    const base = r2(b.top + b.h - 4);
                    const bw = Math.max(1, Math.min(14, geo.bw - 1.5));
                    let d = '';
                    for (let i = 0; i < n; i++) {
                      const yy = Math.min(base, sc.y(x.points![i].v));
                      d += `M${r2(geo.x(i) - bw / 2)} ${base}V${yy}h${r2(bw)}V${base}Z`;
                    }
                    return <path key={x.key} d={d} fill={x.color} opacity={overlay ? 0.35 : 0.75} />;
                  })}
                {/* bands: the fastest to slowest value in each bucket, faint, under the line */}
                {shown
                  .filter((x) => x.band && x.kind !== 'bar')
                  .map((x) => {
                    const sc = geo.scales.get(x.lane)!;
                    const pts = x.points!.slice(0, n);
                    const top = pts.map((p, i) => `${i ? 'L' : 'M'}${geo.x(i)} ${sc.y(p.hi ?? p.v)}`).join('');
                    const bottom = pts
                      .map((p, i) => ({ p, i }))
                      .reverse()
                      .map(({ p, i }) => `L${geo.x(i)} ${sc.y(p.lo ?? p.v)}`)
                      .join('');
                    return <path key={`b${x.key}`} d={`${top}${bottom}Z`} fill={x.color} opacity={0.13} />;
                  })}
                {/* clipped values: a small mark at the top of the lane, with the real value */}
                {shown
                  .filter((x) => x.kind !== 'bar' && Number.isFinite(geo.scales.get(x.lane)!.clip))
                  .map((x) => {
                    const sc = geo.scales.get(x.lane)!;
                    const b = geo.box.get(overlay ? '__all' : x.lane)!;
                    return (
                      <g key={`c${x.key}`}>
                        {x.points!.slice(0, n).map((p, i) => {
                          // only the value itself: a band's slowest block above the scale is just clipped
                          const top = p.v;
                          if (top <= sc.clip) return null;
                          const cx = geo.x(i);
                          const cy = r2(b.top + 1);
                          return (
                            <path key={i} d={`M${cx - 4} ${cy + 6}L${cx} ${cy}L${cx + 4} ${cy + 6}Z`} fill={x.color}>
                              <title>{`${x.label}: up to ${x.format(top)}, above the scale`}</title>
                            </path>
                          );
                        })}
                      </g>
                    );
                  })}
                {shown
                  .filter((x) => x.kind !== 'bar')
                  .map((x, k) => {
                    const sc = geo.scales.get(x.lane)!;
                    const b = geo.box.get(overlay ? '__all' : x.lane)!;
                    const line = x.points!.slice(0, n).map((p, i) => `${i ? 'L' : 'M'}${geo.x(i)} ${sc.y(p.v)}`).join('');
                    const firstInLane = shown.filter((y) => y.lane === x.lane && y.kind !== 'bar' && !y.dashed)[0] === x;
                    return (
                      <g key={x.key}>
                        {!overlay && !x.dashed && firstInLane && (
                          <path d={`${line}L${geo.x(n - 1)} ${r2(b.top + b.h - 4)}L${geo.x(0)} ${r2(b.top + b.h - 4)}Z`} fill={`url(#${gid}${x.key})`} />
                        )}
                        <path
                          d={line}
                          fill="none"
                          stroke={x.color}
                          strokeWidth={x.dashed ? 1.5 : 2}
                          strokeDasharray={x.dashed ? '5 4' : undefined}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          data-k={k}
                        />
                      </g>
                    );
                  })}

                {/* x ticks under the last lane */}
                {xTicks.map((i) => (
                  <text key={i} x={geo.x(i)} y={H - 6} className={s.tick} textAnchor={i === 0 ? 'start' : 'middle'}>
                    {timeLabel(times[i], step)}
                  </text>
                ))}

                {/* shared crosshair */}
                {hover != null && (
                  <g pointerEvents="none">
                    <line x1={geo.x(hover)} x2={geo.x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--ix-ink-3)" strokeWidth="1" />
                    {shown
                      .filter((x) => x.kind !== 'bar')
                      .map((x) => (
                        <circle key={x.key} cx={geo.x(hover)} cy={geo.scales.get(x.lane)!.y(x.points![hover].v)} r="4" fill={x.color} stroke="var(--ix-bg)" strokeWidth="2" />
                      ))}
                  </g>
                )}
              </svg>
              {hover != null && (
                <div
                  className={`${s.tip} ${s.tipWide}`}
                  style={{ left: Math.min(w - 240, Math.max(0, geo.x(hover) + 14 - (geo.x(hover) > w - 260 ? 268 : 0))), top: 4 }}
                  aria-hidden
                >
                  <p className={s.tipK}>{step >= 86400 ? utc(times[hover]).slice(0, 10) : `${utc(times[hover]).slice(0, 16)} UTC`}</p>
                  {shown.map((x) => (
                    <p key={x.key} className={s.tipRow}>
                      <i className={s.tipSw} style={{ background: x.color, opacity: x.dashed ? 0.6 : 1 }} aria-hidden />
                      <span className={s.tipL}>{x.label}</span>
                      <span className={s.tipN}>
                        {x.format(x.points![hover].v)}
                        {x.band && x.points![hover].lo != null && x.points![hover].hi != null && (
                          <span className={s.tipBand}>
                            {' '}
                            ({x.format(x.points![hover].lo!)} to {x.format(x.points![hover].hi!)})
                          </span>
                        )}
                      </span>
                    </p>
                  ))}
                  {bucketHref(series[0].points![hover]) && <p className={s.tipHint}>Click to open these blocks</p>}
                </div>
              )}
              <p className="ix-sr" aria-live="polite">
                {hover != null ? `${timeLabel(times[hover], step)}: ${shown.map((x) => `${x.label} ${x.format(x.points![hover].v)}`).join(', ')}` : ''}
              </p>
            </>
          )
        )}
      </div>
      {footer && <div className={s.footer}>{footer}</div>}
    </figure>
  );
}
