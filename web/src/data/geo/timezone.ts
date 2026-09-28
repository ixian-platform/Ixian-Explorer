/**
 * "Follows IP" without an IP: the globe opens facing the visitor's region,
 * estimated from the browser's time zone. No network call, no lookup.
 */
const ZONES: Record<string, [number, number]> = {
  // [lat, lon] of each zone's reference city
  'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.3, -6.3], 'Europe/Lisbon': [38.7, -9.1],
  'Europe/Paris': [48.9, 2.4], 'Europe/Berlin': [52.5, 13.4], 'Europe/Ljubljana': [46.1, 14.5],
  'Europe/Madrid': [40.4, -3.7], 'Europe/Rome': [41.9, 12.5], 'Europe/Amsterdam': [52.4, 4.9],
  'Europe/Stockholm': [59.3, 18.1], 'Europe/Helsinki': [60.2, 24.9], 'Europe/Warsaw': [52.2, 21],
  'Europe/Athens': [38, 23.7], 'Europe/Istanbul': [41, 29], 'Europe/Moscow': [55.8, 37.6],
  'Europe/Kyiv': [50.5, 30.5], 'Europe/Kiev': [50.5, 30.5],
  'America/New_York': [40.7, -74], 'America/Chicago': [41.9, -87.6], 'America/Denver': [39.7, -105],
  'America/Phoenix': [33.4, -112.1], 'America/Los_Angeles': [34.1, -118.2], 'America/Anchorage': [61.2, -149.9],
  'America/Toronto': [43.7, -79.4], 'America/Vancouver': [49.3, -123.1], 'America/Mexico_City': [19.4, -99.1],
  'America/Bogota': [4.7, -74.1], 'America/Lima': [-12, -77], 'America/Sao_Paulo': [-23.6, -46.6],
  'America/Argentina/Buenos_Aires': [-34.6, -58.4], 'America/Santiago': [-33.4, -70.6],
  'Pacific/Honolulu': [21.3, -157.9], 'Pacific/Auckland': [-36.8, 174.8],
  'Asia/Tokyo': [35.7, 139.7], 'Asia/Seoul': [37.6, 127], 'Asia/Shanghai': [31.2, 121.5],
  'Asia/Hong_Kong': [22.3, 114.2], 'Asia/Taipei': [25, 121.6], 'Asia/Singapore': [1.4, 103.8],
  'Asia/Bangkok': [13.8, 100.5], 'Asia/Jakarta': [-6.2, 106.8], 'Asia/Manila': [14.6, 121],
  'Asia/Kolkata': [22.6, 88.4], 'Asia/Calcutta': [22.6, 88.4], 'Asia/Dubai': [25.2, 55.3],
  'Asia/Karachi': [24.9, 67], 'Asia/Tehran': [35.7, 51.4], 'Asia/Jerusalem': [31.8, 35.2],
  'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145], 'Australia/Perth': [-31.95, 115.9],
  'Africa/Johannesburg': [-26.2, 28], 'Africa/Lagos': [6.5, 3.4], 'Africa/Cairo': [30, 31.2],
  'Africa/Nairobi': [-1.3, 36.8], 'Africa/Casablanca': [33.6, -7.6],
};

const REGION: Record<string, [number, number]> = {
  Europe: [48, 12], America: [38, -90], Asia: [28, 100], Australia: [-28, 140],
  Africa: [5, 20], Pacific: [-10, 170], Atlantic: [30, -30], Indian: [-10, 75], Antarctica: [-20, 0],
};

export interface Facing {
  lat: number;
  lon: number;
  zone: string | null;
}

/** Where the globe should face first. Europe is the default (most nodes). */
export function visitorFacing(): Facing {
  let zone: string | null = null;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    zone = null;
  }
  if (zone && ZONES[zone]) return { lat: ZONES[zone][0], lon: ZONES[zone][1], zone };
  const region = zone?.split('/')[0];
  if (region && REGION[region]) {
    // refine longitude from the UTC offset
    const off = -new Date().getTimezoneOffset() / 60;
    const [lat, lon] = REGION[region];
    const byOffset = off * 15;
    return { lat, lon: Math.abs(byOffset - lon) < 40 ? byOffset : lon, zone };
  }
  const off = -new Date().getTimezoneOffset() / 60;
  return { lat: 30, lon: off * 15, zone };
}
