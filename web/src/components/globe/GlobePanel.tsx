'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeInfo } from '@/data/types';
import { visitorFacing } from '@/data/geo/timezone';
import { useLive, useNow, useReducedMotion } from '@/lib/hooks';
import { duration, ago } from '@/lib/format';
import { Segmented } from '@/components/ui/Primitives';
import { DemoTag } from '@/components/ui/Demo';
import Icon from '@/components/Icon';
import { groupCities, type CityGroup } from './cities';
import FlatMap from './FlatMap';
import type { GlobeColors, GlobeScene } from './scene';
import { cssVar, resolvedTheme, useTheme } from '@/lib/theme';
import s from './Globe.module.css';

type Filter = 'all' | 'dlt' | 's2';
const F: Record<Filter, 0 | 1 | 2> = { all: 0, dlt: 1, s2: 2 };

/**
 * The network globe with its controls: filter, legend, city card and an
 * accessible city list. Falls back to a flat map without WebGL, and to a
 * still globe with reduced motion.
 */
export default function GlobePanel({
  nodes,
  variant = 'hero',
  initialCity,
  error = false,
  onRetry,
  unpublished = false,
}: {
  nodes: NodeInfo[] | null;
  variant?: 'hero' | 'page';
  initialCity?: string | null;
  error?: boolean;
  onRetry?: () => void;
  /** the server does not publish node locations yet: an empty globe, a quiet note, no controls */
  unpublished?: boolean;
}) {
  const reduced = useReducedMotion();
  const theme = useTheme();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GlobeScene | null>(null);
  const [gl, setGl] = useState<null | boolean>(null);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<{ i: number; x: number; y: number } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [interacted, setInteracted] = useState(false);

  const cities = useMemo(() => (nodes ? groupCities(nodes) : []), [nodes]);
  const cityRef = useRef<CityGroup[]>([]);
  cityRef.current = cities;

  // detect WebGL once, on the client
  useEffect(() => {
    import('./scene').then((m) => setGl(m.hasWebGL()));
  }, []);

  // create the scene
  useEffect(() => {
    if (!gl || !canvas.current) return;
    let alive = true;
    let sc: GlobeScene | null = null;
    import('./scene').then(({ GlobeScene }) => {
      if (!alive || !canvas.current) return;
      sc = new GlobeScene({
        canvas: canvas.current,
        reducedMotion: reduced,
        facing: visitorFacing(),
        onHover: (i, x, y) => setHover(i == null ? null : { i, x, y }),
        onSelect: (i, x, y) => setPicked(i == null ? null : { i, x, y }),
        onInteract: () => setInteracted(true),
        colors: globeColors(),
      });
      scene.current = sc;
      const el = stage.current!;
      const ro = new ResizeObserver(() => sc?.resize(el.clientWidth, el.clientHeight));
      ro.observe(el);
      sc.resize(el.clientWidth, el.clientHeight);
      // run only while visible
      let inView = true;
      const sync = () => (inView && document.visibilityState === 'visible' && !reduced ? sc?.start() : sc?.stop());
      const io = new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        sync();
      });
      io.observe(el);
      document.addEventListener('visibilitychange', sync);
      sync();
      setReady(true);
      cleanup = () => {
        ro.disconnect();
        io.disconnect();
        document.removeEventListener('visibilitychange', sync);
      };
    });
    let cleanup = () => {};
    return () => {
      alive = false;
      cleanup();
      sc?.dispose();
      scene.current = null;
      setReady(false);
    };
  }, [gl, reduced]);

  // theme changes recolour the globe in place
  useEffect(() => {
    scene.current?.setColors(globeColors());
  }, [theme, ready]);

  // data into the scene
  useEffect(() => {
    if (!ready || !scene.current) return;
    const idx = new Map(cities.map((c, i) => [c.key, i]));
    scene.current.setData(
      cities.flatMap((c) =>
        c.nodes.map((n) => ({ lat: n.lat, lon: n.lon, kind: n.kind === 'dlt' ? (0 as const) : (1 as const), city: idx.get(c.key)! }))
      ),
      cities.map((c) => ({ lat: c.lat, lon: c.lon, count: c.nodes.length, dlt: c.dlt, s2: c.s2 }))
    );
  }, [ready, cities]);

  useEffect(() => {
    scene.current?.setFilter(F[filter]);
  }, [filter, ready]);

  const active = picked?.i ?? hover?.i ?? null;
  useEffect(() => {
    scene.current?.setHighlight(active);
  }, [active, ready]);

  // open a city passed in the URL (network page)
  useEffect(() => {
    if (!initialCity || !cities.length) return;
    const i = cities.findIndex((c) => c.key === initialCity || c.city === initialCity);
    if (i >= 0) focusCity(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCity, cities.length, ready]);

  // traffic
  const lastTx = useRef(0);
  useLive((e) => {
    const sc = scene.current;
    if (!sc || reduced) return;
    if (e.type === 'block') sc.block(e.block.id);
    else {
      const t = performance.now();
      if (t - lastTx.current < 380) return; // keep the sky readable
      lastTx.current = t;
      let h = 0;
      for (let i = 0; i < e.tx.id.length; i++) h = (h * 31 + e.tx.id.charCodeAt(i)) >>> 0;
      sc.tx(h);
    }
  });

  function focusCity(i: number) {
    setInteracted(true);
    const sc = scene.current;
    if (sc) {
      sc.focusCity(i);
      // place the card once the globe has turned
      window.setTimeout(() => {
        const p = sc.cityScreen(i);
        const el = stage.current;
        setPicked({ i, x: p?.x ?? (el ? el.clientWidth / 2 : 0), y: p?.y ?? (el ? el.clientHeight / 2 : 0) });
      }, reduced ? 0 : 700);
    } else {
      setPicked({ i, x: 0, y: 0 });
    }
  }

  const card = active != null ? cities[active] : null;
  const pos = picked ?? hover;
  const dltTotal = nodes?.filter((n) => n.kind === 'dlt').length ?? 0;
  const s2Total = nodes?.filter((n) => n.kind === 's2').length ?? 0;

  return (
    <div className={s.panel} data-variant={variant}>
      <div
        ref={stage}
        className={s.stage}
        data-ready={(ready && !!nodes) || gl === false || undefined}
        role="img"
        aria-label={
          unpublished
            ? 'Globe of the Ixian network. Node locations are not published yet.'
            : nodes
            ? `Globe of the Ixian network: ${dltTotal} DLT nodes and ${s2Total} S2 nodes in ${cities.length} cities. Use the city list to explore it with a keyboard or screen reader.`
            : 'Globe of the Ixian network, loading.'
        }
      >
        {gl !== false && (
          <canvas
            ref={canvas}
            className={s.canvas}
            tabIndex={0}
            aria-label="Globe. Arrow keys turn it."
            onKeyDown={(e) => {
              const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
              if (k) {
                e.preventDefault();
                scene.current?.nudge(k[0], k[1]);
                setInteracted(true);
              }
            }}
          />
        )}
        {gl === false && nodes && (
          <FlatMap
            cities={cities}
            filter={F[filter]}
            active={active}
            onHover={(i, x, y) => setHover(i == null ? null : { i, x, y })}
            onSelect={(i, x, y) => setPicked(i == null ? null : { i, x, y })}
          />
        )}
        {(!nodes || (gl !== false && !ready)) && !error && <div className={s.loading} aria-hidden />}
        {error && (
          <div className={s.failed} role="alert">
            <p>Node locations could not be loaded.</p>
            {onRetry && (
              <button type="button" className="ix-btn ix-btn--sm" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        )}

        {card && pos && <CityCard city={card} x={pos.x} y={pos.y} pinned={!!picked} onClose={() => setPicked(null)} stage={stage} />}

        {unpublished && (
          <p className={s.unpublished}>
            <span>Node locations aren&apos;t published yet.</span> The counts and versions are live.
          </p>
        )}

        {!interacted && !reduced && gl && !error && !unpublished && (
          <p className={s.dragHint} aria-hidden>
            Drag to turn · <span className={s.hintMouse}>hover</span>
            <span className={s.hintTouch}>tap</span> a city
          </p>
        )}
      </div>

      {!unpublished && (
        <div className={s.bar}>
          <Segmented<Filter>
            label="Show nodes"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'dlt', label: `DLT${nodes ? ` ${dltTotal}` : ''}` },
              { value: 's2', label: `S2${nodes ? ` ${s2Total}` : ''}` },
            ]}
          />
          <ul className={s.legend} aria-label="Legend">
            <li>
              <i className={s.kDlt} aria-hidden /> DLT node
            </li>
            <li>
              <i className={s.kS2} aria-hidden /> S2 node
            </li>
            {!reduced && (
              <>
                <li>
                  <i className={s.kRoute} aria-hidden /> Traffic
                </li>
                <li>
                  <i className={s.kBlock} aria-hidden /> New block
                </li>
              </>
            )}
            <li>
              <DemoTag />
            </li>
          </ul>
          <button type="button" className={`ix-btn ix-btn--sm ${s.listBtn}`} aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)} disabled={!nodes}>
            <Icon name="table" size={14} /> {listOpen ? 'Hide cities' : `Cities${nodes ? ` (${cities.length})` : ''}`}
          </button>
        </div>
      )}

      {listOpen && nodes && (
        <div className={s.list}>
          <p className={s.listNote}>City-level locations only. Node IP addresses are never shown.</p>
          <ul className={s.cityList}>
            {cities.map((c, i) => {
              const shown = filter === 'all' || (filter === 'dlt' ? c.dlt > 0 : c.s2 > 0);
              if (!shown) return null;
              return (
                <li key={c.key}>
                  <button type="button" className={s.cityBtn} aria-pressed={picked?.i === i} onClick={() => focusCity(i)}>
                    <span className={s.cityName}>
                      {c.city}
                      <span className={s.cityCountry}>{c.country}</span>
                    </span>
                    <span className={`${s.cityCounts} ix-num`}>
                      {c.dlt > 0 && (
                        <span>
                          <i className={s.kDlt} aria-hidden /> {c.dlt}
                          <span className="ix-sr"> DLT</span>
                        </span>
                      )}
                      {c.s2 > 0 && (
                        <span>
                          <i className={s.kS2} aria-hidden /> {c.s2}
                          <span className="ix-sr"> S2</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function CityCard({
  city,
  x,
  y,
  pinned,
  onClose,
  stage,
}: {
  city: CityGroup;
  x: number;
  y: number;
  pinned: boolean;
  onClose: () => void;
  stage: React.RefObject<HTMLDivElement | null>;
}) {
  const now = useNow(5000);
  const w = stage.current?.clientWidth ?? 800;
  const h = stage.current?.clientHeight ?? 600;
  const cardW = Math.min(280, w - 24);
  const left = Math.max(12, Math.min(w - cardW - 12, x + 18));
  const top = Math.max(12, Math.min(h - 250, y - 30));
  const shown = city.nodes.slice(0, 6);
  return (
    <div className={s.card} style={{ left, top, width: cardW }} data-pinned={pinned || undefined} role={pinned ? 'dialog' : undefined} aria-label={pinned ? `${city.city} nodes` : undefined}>
      <div className={s.cardHead}>
        <div>
          <p className={s.cardCity}>{city.city}</p>
          <p className={s.cardCountry}>{city.country}</p>
        </div>
        {pinned && (
          <button type="button" className={s.cardClose} onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <p className={`${s.cardCounts} ix-num`}>
        <span>
          <i className={s.kDlt} aria-hidden /> {city.dlt} DLT
        </span>
        <span>
          <i className={s.kS2} aria-hidden /> {city.s2} S2
        </span>
      </p>
      <ul className={s.cardNodes}>
        {shown.map((n) => (
          <li key={n.id}>
            <i className={n.kind === 'dlt' ? s.kDlt : s.kS2} aria-hidden />
            <span className={s.cardVer}>{n.version}</span>
            <span className={s.cardMeta}>
              up {duration(n.uptime)}
              {now != null && <> · {ago(n.lastSeen, now)}</>}
            </span>
          </li>
        ))}
      </ul>
      {city.nodes.length > shown.length && (
        <Link href={`/network?city=${encodeURIComponent(city.key)}#nodes`} className={s.cardMore}>
          All {city.nodes.length} nodes in {city.city} <Icon name="chevron" size={13} />
        </Link>
      )}
    </div>
  );
}

/** The globe's colours from the current theme tokens (theme.css). */
function globeColors(): GlobeColors {
  const n = (name: string, d: number) => {
    const v = parseFloat(cssVar(name));
    return Number.isFinite(v) ? v : d;
  };
  return {
    sphere: cssVar('--ix-globe-sphere'),
    rim: cssVar('--ix-globe-rim'),
    haze: cssVar('--ix-globe-haze'),
    hazeAlpha: n('--ix-globe-haze-alpha', 0.075),
    land: cssVar('--ix-globe-land'),
    landAlpha: n('--ix-globe-land-alpha', 0.8),
    ink: cssVar('--ix-globe-ink'),
    dlt: cssVar('--ix-globe-dlt'),
    s2: cssVar('--ix-globe-s2'),
    flash: cssVar('--ix-globe-flash'),
    route: cssVar('--ix-globe-route'),
    density: n('--ix-globe-density', 0.14),
    light: resolvedTheme() === 'light', // a light sea: traffic is drawn over it, not added
  };
}
