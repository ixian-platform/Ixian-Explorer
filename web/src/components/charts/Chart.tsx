'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SeriesPoint } from '@/data/types';
import { shortDate, shortDateTime, hhmm, utc } from '@/lib/format';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { BucketCell, BlockValue, bucketHref } from './drill';
import s from './Chart.module.css';

/**
 * One chart, one measure (never two y-axes). Line or column form, an optional
 * min-max band, an optional reference line and one annotated marker. A
 * crosshair snaps to the nearest bucket; the same readout follows keyboard
 * focus (arrow keys). Every chart has a table twin.
 */
export interface ChartProps {
  title: string;
  /** one sentence under the title: what is plotted and how it is bucketed */
  subtitle?: ReactNode;
  points: SeriesPoint[] | null;
  /** bucket width in seconds (drives time labels) */
  step: number;
  kind?: 'line' | 'bar';
  format: (v: number) => string;
  /** compact tick labels */
  tick?: (v: number) => string;
  unit?: string;
  band?: boolean;
  zero?: boolean;
  reference?: { value: number; label: string } | null;
  marker?: { t: number; label: string; href?: string } | null;
  /** end dot in the live colour (demo-labelled data) */
  live?: boolean;
  height?: number;
  headline?: ReactNode;
  footer?: ReactNode;
  loadingFrame?: boolean;
  error?: ReactNode;
  valueLabel?: string;
  /** keep one extreme bucket from flattening the rest: cap the axis and mark the clipped marks */
  capOutliers?: boolean;
  /** series colour: a metric token such as var(--ix-m-tx) (theme.css) */
  color?: string;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    max = min + 1;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks };
}

function timeLabel(t: number, step: number) {
  if (step < 3600) return hhmm(t);
  if (step < 21600) return shortDateTime(t);
  return shortDate(t);
}

export default function Chart({
  title,
  subtitle,
  points,
  step,
  kind = 'line',
  format,
  tick,
  band = false,
  zero = false,
  reference,
  marker,
  live = false,
  height = 220,
  headline,
  footer,
  loadingFrame = false,
  error,
  valueLabel = 'Value',
  capOutliers = false,
  color = 'var(--ix-ink-1)',
}: ChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const router = useRouter();
  const [table, setTable] = useState(false);
  const id = useId();
  const gid = id.replace(/:/g, '');

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const pad = { l: 8, r: 58, t: 14, b: 26 };
  const H = height;
  const iw = w - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const geo = useMemo(() => {
    if (!points || points.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    let maxV = -Infinity;
    for (const p of points) {
      const lo = band && p.lo != null ? p.lo : p.v;
      const hi = band && p.hi != null ? p.hi : p.v;
      if (lo < min) min = lo;
      if (hi > max) max = hi;
      if (p.v > maxV) maxV = p.v;
    }
    // a band's extremes (one 10-minute block in a bucket) must not flatten the line: the band is clipped
    // at three times the highest average, and the table and hover still give the real value
    let bandTop = Infinity;
    if (band && maxV > 0 && max > maxV * 3) {
      bandTop = maxV * 3;
      max = bandTop;
    }
    if (reference) {
      min = Math.min(min, reference.value);
      max = Math.max(max, reference.value);
    }
    let cap: number | null = null;
    if (capOutliers && points.length > 8) {
      const sorted = points.map((p) => p.v).sort((a, b) => a - b);
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      if (p90 > 0 && max > p90 * 6) {
        cap = p90 * 2.2;
        max = cap;
      }
    }
    if (zero || kind === 'bar') min = Math.min(0, min);
    if (max === min) {
      max += Math.abs(max) * 0.01 || 1;
      min -= Math.abs(min) * 0.01 || 0;
    }
    const pad2 = (max - min) * 0.08;
    // never below zero when nothing is negative
    const nt = niceTicks(zero || kind === 'bar' ? min : min >= 0 ? Math.max(0, min - pad2) : min - pad2, max + pad2, 4);
    const n = points.length;
    const bw = iw / n;
    const x = (i: number) => r2(kind === 'bar' ? pad.l + bw * (i + 0.5) : pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw));
    const top = cap != null ? cap : nt.hi;
    const yRaw = (v: number) => r2(pad.t + ih - ((v - nt.lo) / (nt.hi - nt.lo)) * ih);
    const y = (v: number) => (cap != null && v > top ? yRaw(nt.hi) - 6 : yRaw(v));
    const yb = (v: number) => y(Math.min(v, bandTop));
    return { nt, x, y, yb, bw, n, cap };
  }, [points, iw, ih, band, zero, kind, reference, pad.l, pad.t]);

  const markerIndex = useMemo(() => {
    if (!marker || !points) return -1;
    let best = -1;
    let bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.t - marker.t);
      if (d < bd && marker.t >= p.t && marker.t < p.t + step) {
        bd = d;
        best = i;
      }
    });
    return best;
  }, [marker, points, step]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || !points) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * w;
    let i: number;
    if (kind === 'bar') i = Math.floor((px - pad.l) / geo.bw);
    else i = Math.round(((px - pad.l) / iw) * (geo.n - 1));
    setHover(Math.max(0, Math.min(geo.n - 1, i)));
  };

  const xTicks = useMemo(() => {
    if (!points || !geo) return [];
    const want = w < 480 ? 3 : w < 760 ? 4 : 6;
    const every = Math.max(1, Math.round(points.length / want));
    const out: number[] = [];
    for (let i = 0; i < points.length; i += every) out.push(i);
    return out;
  }, [points, geo, w]);

  const hp = hover != null && points ? points[hover] : null;
  // several neighbouring buckets can be off scale (a stress test): label one of them, the marked one or the highest
  let capLabel = -1;
  if (geo && geo.cap != null && points) {
    if (markerIndex >= 0 && points[markerIndex].v > geo.cap) capLabel = markerIndex;
    else points.forEach((p, i) => {
      if (p.v > geo.cap! && (capLabel < 0 || p.v > points[capLabel].v)) capLabel = i;
    });
  }
  const last = points && points.length ? points[points.length - 1] : null;

  let linePath = '';
  let areaPath = '';
  let bandPath = '';
  if (geo && points && kind === 'line') {
    linePath = points.map((p, i) => `${i ? 'L' : 'M'}${geo.x(i)} ${geo.y(p.v)}`).join('');
    const base = geo.y(geo.nt.lo);
    areaPath = `${linePath}L${geo.x(points.length - 1)} ${base}L${geo.x(0)} ${base}Z`;
    if (band) {
      const up = points.map((p, i) => `${i ? 'L' : 'M'}${geo.x(i)} ${geo.yb(p.hi ?? p.v)}`).join('');
      const down = points
        .slice()
        .reverse()
        .map((p, j) => `L${geo.x(points.length - 1 - j)} ${geo.yb(p.lo ?? p.v)}`)
        .join('');
      bandPath = `${up}${down}Z`;
    }
  }

  return (
    <figure className={s.fig} aria-labelledby={`${id}-t`}>
      <figcaption className={s.head}>
        <div className={s.titles}>
          <h3 id={`${id}-t`} className={s.title}>
            {title}
          </h3>
          {subtitle && <p className={s.sub}>{subtitle}</p>}
        </div>
        <button type="button" className={`ix-btn ix-btn--sm ${s.tableBtn}`} aria-pressed={table} onClick={() => setTable((t) => !t)} disabled={!points?.length}>
          <Icon name={table ? 'chart' : 'table'} size={14} /> {table ? 'Chart' : 'Table'}
        </button>
      </figcaption>
      {headline && <div className={s.headline}>{headline}</div>}

      <div ref={wrap} className={s.plotWrap} data-loading={(loadingFrame && !!points) || undefined}>
        {error ? (
          <div className={s.error} style={{ height: H }}>
            {error}
          </div>
        ) : !points ? (
          <div className={`ix-skel ${s.skel}`} style={{ height: H }} aria-hidden />
        ) : points.length === 0 ? (
          <div className={s.error} style={{ height: H }}>
            No data in this range.
          </div>
        ) : table ? (
          <div className={s.tableWrap} style={{ maxHeight: Math.max(H, 260) }}>
            <table className={s.table}>
              <caption className="ix-sr">{title}</caption>
              <thead>
                <tr>
                  <th scope="col">{step >= 86400 ? 'Day (UTC)' : 'From (UTC)'}</th>
                  <th scope="col">{valueLabel}</th>
                  {band && <th scope="col">Lowest</th>}
                  {band && <th scope="col">Highest</th>}
                </tr>
              </thead>
              <tbody>
                {points
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr key={p.t} data-mark={marker && markerIndex >= 0 && points[markerIndex] === p ? '' : undefined}>
                      <td>
                        <BucketCell p={p} step={step} />
                      </td>
                      <td className="ix-num">{format(p.v)}</td>
                      {band && (
                        <td className="ix-num">
                          <BlockValue v={p.lo} h={p.loH} format={format} />
                        </td>
                      )}
                      {band && (
                        <td className="ix-num">
                          <BlockValue v={p.hi} h={p.hiH} format={format} />
                        </td>
                      )}
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
                aria-label={`${title}. ${last ? `Latest: ${format(last.v)}.` : ''} Use the arrow keys for values, or open the table.`}
                tabIndex={0}
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
                onClick={() => {
                  const href = hp ? bucketHref(hp) : null;
                  if (href) router.push(href);
                }}
                style={hp && bucketHref(hp) ? { cursor: 'pointer' } : undefined}
                onFocus={() => setHover((h) => h ?? (points.length - 1))}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const d = e.key === 'ArrowLeft' ? -1 : 1;
                    setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + d)));
                  } else if (e.key === 'Home') setHover(0);
                  else if (e.key === 'End') setHover(points.length - 1);
                }}
              >
                <defs>
                  <linearGradient id={`w${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={color} stopOpacity="0.22" />
                    <stop offset="1" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* grid + y ticks (right side) */}
                {geo.nt.ticks.filter((t) => geo.cap == null || t <= geo.cap).map((t) => (
                  <g key={t}>
                    <line x1={pad.l} x2={pad.l + iw} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--ix-line)" strokeWidth="1" />
                    <text x={w - pad.r + 8} y={geo.y(t) + 4} className={s.tick}>
                      {(tick ?? format)(t)}
                    </text>
                  </g>
                ))}
                {/* x ticks */}
                {xTicks.map((i) => (
                  <text key={i} x={geo.x(i)} y={H - 6} className={s.tick} textAnchor={i === 0 ? 'start' : 'middle'}>
                    {timeLabel(points[i].t, step)}
                  </text>
                ))}
                {band && bandPath && (
                  <>
                    {/* fades toward the top: the slowest blocks can run past the scale (see the table) */}
                    <linearGradient id={`band${gid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={color} stopOpacity="0.03" />
                      <stop offset="0.6" stopColor={color} stopOpacity="0.14" />
                      <stop offset="1" stopColor={color} stopOpacity="0.2" />
                    </linearGradient>
                    <path d={bandPath} fill={`url(#band${gid})`} />
                  </>
                )}
                {kind === 'line' && (
                  <>
                    <path d={areaPath} fill={`url(#w${gid})`} />
                    <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  </>
                )}
                {kind === 'bar' &&
                  points.map((p, i) => {
                    const bw = Math.max(1, Math.min(24, geo.bw - 2));
                    const y0 = geo.y(Math.max(0, geo.nt.lo));
                    const y1 = geo.y(p.v);
                    const hgt = Math.max(0, y0 - y1);
                    const rr = Math.min(3, bw / 2, hgt);
                    const x0 = geo.x(i) - bw / 2;
                    return (
                      <path
                        key={p.t}
                        d={`M${r2(x0)} ${y0}V${r2(y1 + rr)}Q${r2(x0)} ${r2(y1)} ${r2(x0 + rr)} ${r2(y1)}H${r2(x0 + bw - rr)}Q${r2(x0 + bw)} ${r2(y1)} ${r2(x0 + bw)} ${r2(y1 + rr)}V${y0}Z`}
                        fill={color}
                        opacity={hover == null ? 0.85 : hover === i ? 1 : 0.4}
                      />
                    );
                  })}
                {geo.cap != null &&
                  points.map((p, i) =>
                    p.v > geo.cap! ? (
                      <g key={`c${p.t}`}>
                        <path
                          d={`M${geo.x(i) - 7} ${pad.t + 3}l14 -4M${geo.x(i) - 7} ${pad.t + 7}l14 -4`}
                          stroke="var(--ix-bg)"
                          strokeWidth="2.5"
                        />
                        {i === capLabel && (
                          <text
                            x={geo.x(i) + (geo.x(i) > w * 0.7 ? -10 : 10)}
                            y={pad.t + 12}
                            className={s.markLabel}
                            textAnchor={geo.x(i) > w * 0.7 ? 'end' : 'start'}
                          >
                            {markerIndex === i && marker ? marker.label : `${format(p.v)}, off scale`}
                          </text>
                        )}
                      </g>
                    ) : null
                  )}
                {reference && (
                  <g>
                    <line x1={pad.l} x2={pad.l + iw} y1={geo.y(reference.value)} y2={geo.y(reference.value)} stroke="var(--ix-threshold)" strokeWidth="1.5" strokeDasharray="5 4" />
                    <text x={pad.l + 4} y={geo.y(reference.value) - 6} className={s.refLabel}>
                      {reference.label}
                    </text>
                  </g>
                )}
                {marker && markerIndex >= 0 && !(geo.cap != null && points[markerIndex].v > geo.cap) && (
                  <g>
                    <line
                      x1={geo.x(markerIndex)}
                      x2={geo.x(markerIndex)}
                      y1={geo.y(points[markerIndex].v)}
                      y2={pad.t}
                      stroke="var(--ix-ink-3)"
                      strokeWidth="1"
                    />
                    <circle cx={geo.x(markerIndex)} cy={geo.y(points[markerIndex].v)} r="4.5" fill="var(--ix-bg)" stroke="var(--ix-text)" strokeWidth="2" />
                    <text
                      x={geo.x(markerIndex) + (geo.x(markerIndex) > w * 0.7 ? -8 : 8)}
                      y={pad.t + 10}
                      className={s.markLabel}
                      textAnchor={geo.x(markerIndex) > w * 0.7 ? 'end' : 'start'}
                    >
                      {marker.label}
                    </text>
                  </g>
                )}
                {kind === 'line' && last && live && (
                  <circle cx={geo.x(points.length - 1)} cy={geo.y(last.v)} r="4" fill="none" stroke="var(--ix-live)" strokeWidth="1.5" className={s.ping} />
                )}
                {kind === 'line' && last && (
                  <circle
                    cx={geo.x(points.length - 1)}
                    cy={geo.y(last.v)}
                    r="4"
                    fill={color}
                    stroke="var(--ix-bg)"
                    strokeWidth="2"
                  />
                )}
                {hp && hover != null && (
                  <g pointerEvents="none">
                    <line x1={geo.x(hover)} x2={geo.x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--ix-ink-3)" strokeWidth="1" />
                    {kind === 'line' && (
                      <circle cx={geo.x(hover)} cy={geo.y(hp.v)} r="4.5" fill={color} stroke="var(--ix-bg)" strokeWidth="2" />
                    )}
                  </g>
                )}
              </svg>
              {hp && hover != null && (
                <div
                  className={s.tip}
                  style={{
                    left: Math.min(w - 190, Math.max(0, geo.x(hover) + 12 - (geo.x(hover) > w - 200 ? 214 : 0))),
                    top: 4,
                  }}
                  aria-hidden
                >
                  <p className={s.tipV}>
                    <i className={s.tipSw} style={{ background: color }} aria-hidden />
                    {format(hp.v)}
                  </p>
                  {band && hp.lo != null && (
                    <p className={s.tipK}>
                      range {format(hp.lo)} to {format(hp.hi ?? hp.v)}
                    </p>
                  )}
                  <p className={s.tipK}>{step >= 86400 ? utc(hp.t).slice(0, 10) : `${utc(hp.t).slice(0, 16)} UTC`}</p>
                  {bucketHref(hp) && <p className={s.tipHint}>Click to open these blocks</p>}
                </div>
              )}
              <p className="ix-sr" aria-live="polite">
                {hp ? `${timeLabel(hp.t, step)}: ${format(hp.v)}` : ''}
              </p>
            </>
          )
        )}
      </div>
      {footer && <div className={s.footer}>{footer}</div>}
    </figure>
  );
}
