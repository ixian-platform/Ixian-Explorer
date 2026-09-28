'use client';

import { useEffect, useRef, useState } from 'react';
import type { RewardStep } from '@/data/emission';
import { compact, int } from '@/lib/format';
import s from './Chart.module.css';

/**
 * A reward schedule over block height: a step line, a "now" marker, and a
 * readout that follows the pointer or the arrow keys. Its table twin is the
 * schedule table next to it.
 */
export default function StepChart({
  title,
  steps,
  now,
  xMax,
  valueAt,
  height = 200,
  ended,
}: {
  title: string;
  steps: RewardStep[];
  now: number | null;
  xMax: number;
  /** reward in IXI at a height (for the readout) */
  valueAt: (h: number) => number | null;
  height?: number;
  /** the schedule stopped paying at this height */
  ended?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hx, setHx] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const pad = { l: 8, r: 52, t: 16, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const vals: number[] = [];
  for (const st of steps) {
    if (st.reward != null) vals.push(st.reward);
  }
  // sample the curve so linear ramps draw correctly
  const N = 240;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const h = Math.max(1, Math.round((i / N) * xMax));
    const v = valueAt(h);
    if (v != null) {
      pts.push([h, v]);
      vals.push(v);
    }
  }
  // add exact step edges
  for (const st of steps) {
    for (const h of [st.from, st.to]) {
      if (h != null && h <= xMax) {
        const v = valueAt(h);
        if (v != null) pts.push([h, v]);
      }
    }
  }
  pts.sort((a, b) => a[0] - b[0]);
  const maxV = Math.max(...vals, 1) * 1.1;
  const x = (h: number) => Math.round((pad.l + (h / xMax) * iw) * 100) / 100;
  const y = (v: number) => Math.round((pad.t + ih - (v / maxV) * ih) * 100) / 100;
  let d = '';
  let prev: [number, number] | null = null;
  for (const pt of pts) {
    if (!prev) d += `M${x(pt[0])} ${y(pt[1])}`;
    else if (pt[1] !== prev[1] && steps.some((st) => st.from === pt[0])) d += `H${x(pt[0])}V${y(pt[1])}`;
    else d += `L${x(pt[0])} ${y(pt[1])}`;
    prev = pt;
  }
  const ticks = [0, maxV / 2.2, maxV / 1.1].map((v) => Math.round(v));
  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * xMax));
  const hv = hx != null ? valueAt(hx) : null;
  const setFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * w;
    setHx(Math.max(1, Math.min(xMax, Math.round(((px - pad.l) / iw) * xMax))));
  };
  return (
    <div ref={wrap} className={s.plotWrap}>
      <svg
        className={s.svg}
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`${title}. ${now != null ? `Now at block ${int(now)}: ${valueAt(now) ?? 0} IXI.` : ''} The schedule table lists every step.`}
        tabIndex={0}
        onPointerMove={setFromEvent}
        onPointerLeave={() => setHx(null)}
        onFocus={() => setHx(now ?? 1)}
        onBlur={() => setHx(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const dd = (e.key === 'ArrowLeft' ? -1 : 1) * Math.round(xMax / 100);
            setHx((h) => Math.max(1, Math.min(xMax, (h ?? now ?? 1) + dd)));
          }
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="var(--ix-line)" strokeWidth="1" />
            <text x={w - pad.r + 8} y={y(t) + 4} className={s.tick}>
              {compact(t)}
            </text>
          </g>
        ))}
        {xt.map((h, i) => (
          <text key={h} x={x(h)} y={height - 6} className={s.tick} textAnchor={i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}>
            {h === 0 ? '0' : compact(h)}
          </text>
        ))}
        {ended != null && ended < xMax && (
          <rect x={x(ended)} y={pad.t} width={Math.max(0, x(xMax) - x(ended))} height={ih} fill="var(--ix-text)" opacity="0.03" />
        )}
        <path d={d} fill="none" stroke="var(--ix-m-ixi)" strokeWidth="2" strokeLinejoin="round" />
        {now != null && now <= xMax && (
          <g>
            <line x1={x(now)} x2={x(now)} y1={pad.t} y2={pad.t + ih} stroke="var(--ix-ink-3)" strokeWidth="1" />
            <circle cx={x(now)} cy={y(valueAt(now) ?? 0)} r="4.5" fill="var(--ix-live)" stroke="var(--ix-bg)" strokeWidth="2" />
            <text x={x(now) + (x(now) > w * 0.7 ? -8 : 8)} y={pad.t + 10} className={s.markLabel} textAnchor={x(now) > w * 0.7 ? 'end' : 'start'}>
              Now · {int(now)}
            </text>
          </g>
        )}
        {hx != null && (
          <line x1={x(hx)} x2={x(hx)} y1={pad.t} y2={pad.t + ih} stroke="var(--ix-ink-4)" strokeWidth="1" pointerEvents="none" />
        )}
      </svg>
      {hx != null && (
        <div className={s.tip} style={{ left: Math.min(w - 190, Math.max(0, x(hx) + 12 - (x(hx) > w - 200 ? 214 : 0))), top: 4 }} aria-hidden>
          <p className={s.tipV}>{hv != null ? `${hv.toLocaleString('en', { maximumFractionDigits: 2 })} IXI` : 'Share of supply'}</p>
          <p className={s.tipK}>block {int(hx)}</p>
        </div>
      )}
      <p className="ix-sr" aria-live="polite">
        {hx != null ? `Block ${int(hx)}: ${hv ?? 'share of supply'} IXI` : ''}
      </p>
    </div>
  );
}
