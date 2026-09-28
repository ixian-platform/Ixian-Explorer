import type { NodeInfo } from '@/data/types';

export interface CityGroup {
  key: string;
  city: string;
  country: string;
  cc: string;
  lat: number;
  lon: number;
  nodes: NodeInfo[];
  dlt: number;
  s2: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Group nodes by city. Centre = mean of the (already jittered) node positions. */
export function groupCities(nodes: NodeInfo[]): CityGroup[] {
  const m = new Map<string, CityGroup>();
  for (const n of nodes) {
    const key = `${n.city}|${n.countryCode}`;
    let g = m.get(key);
    if (!g) {
      g = { key, city: n.city, country: n.country, cc: n.countryCode, lat: 0, lon: 0, nodes: [], dlt: 0, s2: 0 };
      m.set(key, g);
    }
    g.nodes.push(n);
    if (n.kind === 'dlt') g.dlt++;
    else g.s2++;
  }
  const out = [...m.values()];
  for (const g of out) {
    g.lat = r2(g.nodes.reduce((a, n) => a + n.lat, 0) / g.nodes.length);
    g.lon = r2(g.nodes.reduce((a, n) => a + n.lon, 0) / g.nodes.length);
    g.nodes.sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'dlt' ? -1 : 1));
  }
  return out.sort((a, b) => b.nodes.length - a.nodes.length || a.city.localeCompare(b.city));
}

