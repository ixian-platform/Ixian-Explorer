'use client';

import { useId } from 'react';

/**
 * A small single-series trend line with a 10% wash and an end dot.
 * `label` is the accessible summary (sparklines have no axes to read).
 */
export default function Sparkline({
  values,
  label,
  width = 160,
  height = 40,
  live = false,
  color = 'var(--ix-ink-1)',
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
  /** end dot in the live colour (only for live, demo-labelled data) */
  live?: boolean;
  /** series colour (metric token) */
  color?: string;
}) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return <svg width={width} height={height} role="img" aria-label={label} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const pts = values.map((v, i) => [r2((i / (values.length - 1)) * (width - pad * 2) + pad), r2(height - pad - ((v - min) / span) * (height - pad * 2))]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');
  const area = `${line}L${pts[pts.length - 1][0]} ${height}L${pts[0][0]} ${height}Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={live ? 'var(--ix-live)' : color} stroke="var(--ix-bg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
