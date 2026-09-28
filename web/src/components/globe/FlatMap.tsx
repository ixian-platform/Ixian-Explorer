'use client';

import { useMemo } from 'react';
import { isLand } from '@/data/geo/landMask';
import type { CityGroup } from './cities';
import s from './Globe.module.css';

const TOP = 75;
const BOTTOM = -58;
const W = 720;
const H = (TOP - BOTTOM) * 2;
const r2 = (x: number) => Math.round(x * 100) / 100;
const px = (lon: number) => r2((lon + 180) * 2);
const py = (lat: number) => r2((TOP - lat) * 2);

let landPath: string | null = null;
function land() {
  if (landPath) return landPath;
  const parts: string[] = [];
  for (let lat = TOP - 1; lat > BOTTOM; lat -= 2) {
    for (let lon = -179; lon < 180; lon += 2) {
      if (isLand(lat, lon)) parts.push(`M${px(lon) - 0.7} ${py(lat)}a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0 -1.4 0`);
    }
  }
  landPath = parts.join('');
  return landPath;
}

/**
 * The no-WebGL fallback: a flat dot map with the same nodes, density and
 * city picking. Equirectangular, cropped to the inhabited latitudes.
 */
export default function FlatMap({
  cities,
  filter,
  active,
  onHover,
  onSelect,
}: {
  cities: CityGroup[];
  filter: 0 | 1 | 2;
  active: number | null;
  onHover: (i: number | null, x: number, y: number) => void;
  onSelect: (i: number | null, x: number, y: number) => void;
}) {
  const d = useMemo(land, []);
  const at = (e: React.PointerEvent | React.MouseEvent) => {
    const r = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect() ?? (e.currentTarget as Element).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return (
    <svg className={s.flat} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect x="0" y="0" width={W} height={H} rx="4" style={{ fill: 'var(--ix-globe-sphere)' }} />
      <path d={d} fill="var(--ix-globe-land)" opacity="0.8" />
      {cities.map((c, i) => {
        const shown = filter === 0 || (filter === 1 ? c.dlt > 0 : c.s2 > 0);
        const n = c.nodes.length;
        return (
          <g
            key={c.key}
            opacity={shown ? 1 : 0.12}
            onPointerEnter={(e) => {
              const p = at(e);
              onHover(i, p.x, p.y);
            }}
            onPointerLeave={() => onHover(null, 0, 0)}
            onClick={(e) => {
              const p = at(e);
              onSelect(i, p.x, p.y);
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={px(c.lon)} cy={py(c.lat)} r={r2(4 + Math.sqrt(n) * 3)} fill="var(--ix-globe-ink)" opacity="0.08" />
            {active === i && (
              <circle cx={px(c.lon)} cy={py(c.lat)} r={r2(6 + Math.sqrt(n) * 3)} fill="none" stroke="var(--ix-globe-ink)" strokeWidth="1" />
            )}
            {c.nodes.map((nd) =>
              nd.kind === 'dlt' ? (
                <circle key={nd.id} cx={px(nd.lon)} cy={py(nd.lat)} r="1.6" fill="var(--ix-globe-dlt)" opacity={filter === 2 ? 0.15 : 1} />
              ) : (
                <circle
                  key={nd.id}
                  cx={px(nd.lon)}
                  cy={py(nd.lat)}
                  r="2"
                  fill="none"
                  stroke="var(--ix-globe-s2)"
                  strokeWidth="0.9"
                  opacity={filter === 1 ? 0.15 : 1}
                />
              )
            )}
            <circle cx={px(c.lon)} cy={py(c.lat)} r="12" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
