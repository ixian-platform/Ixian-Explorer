import { LAND_MASK, LAND_MASK_STEP } from './landMaskData';

export const MASK_W = 360 / LAND_MASK_STEP; // 720
export const MASK_H = 180 / LAND_MASK_STEP; // 360

let grid: Uint8Array | null = null;

/** Decoded land grid, row-major, north to south. Decoded once, lazily. */
export function landGrid(): Uint8Array {
  if (grid) return grid;
  const g = new Uint8Array(MASK_W * MASK_H);
  const rows = LAND_MASK.split('|');
  for (let j = 0; j < rows.length; j++) {
    let i = 0;
    let land = false;
    for (const r of rows[j].split('.')) {
      const n = parseInt(r, 36);
      if (land) g.fill(1, j * MASK_W + i, j * MASK_W + i + n);
      i += n;
      land = !land;
    }
  }
  grid = g;
  return g;
}

/** True when the 0.5° cell containing (lat, lon) is land. */
export function isLand(lat: number, lon: number): boolean {
  const g = landGrid();
  const j = Math.min(MASK_H - 1, Math.max(0, Math.floor((90 - lat) / LAND_MASK_STEP)));
  let x = ((lon + 180) % 360 + 360) % 360;
  const i = Math.min(MASK_W - 1, Math.floor(x / LAND_MASK_STEP));
  return g[j * MASK_W + i] === 1;
}

/**
 * Evenly spread land points (Fibonacci sphere, filtered by the mask), for the
 * globe's dot-matrix continents and the flat fallback map. Positions are
 * rounded to 2 decimals so server and browser agree.
 */
export function landPoints(count: number): { lat: number; lon: number }[] {
  const out: { lat: number; lon: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < count; k++) {
    const y = 1 - (k / (count - 1)) * 2;
    const lat = (Math.asin(y) * 180) / Math.PI;
    let lon = ((k * golden * 180) / Math.PI) % 360;
    if (lon > 180) lon -= 360;
    if (lat < -60) continue; // Antarctica reads as noise at this scale
    if (isLand(lat, lon)) out.push({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
  }
  return out;
}
