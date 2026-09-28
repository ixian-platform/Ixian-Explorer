/**
 * Cities the mock network places nodes in: city centres only (never an
 * address), with weights that loosely follow where servers and home
 * connections sit (mostly Europe and North America, then Asia, a few
 * elsewhere). `dlt` and `s2` are relative weights for each node kind; S2 has
 * more home-run nodes, so its weights lean towards residential cities.
 */
export interface City {
  name: string;
  country: string;
  cc: string;
  lat: number;
  lon: number;
  dlt: number;
  s2: number;
}

export const CITIES: City[] = [
  // Europe: hosting hubs
  { name: 'Frankfurt', country: 'Germany', cc: 'DE', lat: 50.11, lon: 8.68, dlt: 12, s2: 4 },
  { name: 'Nuremberg', country: 'Germany', cc: 'DE', lat: 49.45, lon: 11.08, dlt: 8, s2: 2 },
  { name: 'Falkenstein', country: 'Germany', cc: 'DE', lat: 50.48, lon: 12.37, dlt: 6, s2: 1 },
  { name: 'Berlin', country: 'Germany', cc: 'DE', lat: 52.52, lon: 13.4, dlt: 2, s2: 3 },
  { name: 'Munich', country: 'Germany', cc: 'DE', lat: 48.14, lon: 11.58, dlt: 1, s2: 2 },
  { name: 'Helsinki', country: 'Finland', cc: 'FI', lat: 60.17, lon: 24.94, dlt: 7, s2: 2 },
  { name: 'Amsterdam', country: 'Netherlands', cc: 'NL', lat: 52.37, lon: 4.9, dlt: 8, s2: 3 },
  { name: 'Rotterdam', country: 'Netherlands', cc: 'NL', lat: 51.92, lon: 4.48, dlt: 1, s2: 1 },
  { name: 'Paris', country: 'France', cc: 'FR', lat: 48.86, lon: 2.35, dlt: 4, s2: 2 },
  { name: 'Gravelines', country: 'France', cc: 'FR', lat: 50.99, lon: 2.13, dlt: 3, s2: 0 },
  { name: 'Roubaix', country: 'France', cc: 'FR', lat: 50.69, lon: 3.17, dlt: 3, s2: 1 },
  { name: 'London', country: 'United Kingdom', cc: 'GB', lat: 51.51, lon: -0.13, dlt: 5, s2: 3 },
  { name: 'Manchester', country: 'United Kingdom', cc: 'GB', lat: 53.48, lon: -2.24, dlt: 1, s2: 1 },
  { name: 'Ljubljana', country: 'Slovenia', cc: 'SI', lat: 46.06, lon: 14.51, dlt: 4, s2: 4 },
  { name: 'Maribor', country: 'Slovenia', cc: 'SI', lat: 46.55, lon: 15.65, dlt: 1, s2: 2 },
  { name: 'Zagreb', country: 'Croatia', cc: 'HR', lat: 45.81, lon: 15.98, dlt: 1, s2: 1 },
  { name: 'Vienna', country: 'Austria', cc: 'AT', lat: 48.21, lon: 16.37, dlt: 2, s2: 2 },
  { name: 'Zurich', country: 'Switzerland', cc: 'CH', lat: 47.38, lon: 8.54, dlt: 2, s2: 1 },
  { name: 'Milan', country: 'Italy', cc: 'IT', lat: 45.46, lon: 9.19, dlt: 1, s2: 2 },
  { name: 'Madrid', country: 'Spain', cc: 'ES', lat: 40.42, lon: -3.7, dlt: 1, s2: 2 },
  { name: 'Lisbon', country: 'Portugal', cc: 'PT', lat: 38.72, lon: -9.14, dlt: 1, s2: 1 },
  { name: 'Warsaw', country: 'Poland', cc: 'PL', lat: 52.23, lon: 21.01, dlt: 2, s2: 2 },
  { name: 'Prague', country: 'Czechia', cc: 'CZ', lat: 50.08, lon: 14.44, dlt: 1, s2: 1 },
  { name: 'Stockholm', country: 'Sweden', cc: 'SE', lat: 59.33, lon: 18.07, dlt: 2, s2: 1 },
  { name: 'Oslo', country: 'Norway', cc: 'NO', lat: 59.91, lon: 10.75, dlt: 1, s2: 1 },
  { name: 'Copenhagen', country: 'Denmark', cc: 'DK', lat: 55.68, lon: 12.57, dlt: 1, s2: 1 },
  { name: 'Bucharest', country: 'Romania', cc: 'RO', lat: 44.43, lon: 26.1, dlt: 1, s2: 1 },
  { name: 'Belgrade', country: 'Serbia', cc: 'RS', lat: 44.79, lon: 20.45, dlt: 1, s2: 1 },
  { name: 'Kyiv', country: 'Ukraine', cc: 'UA', lat: 50.45, lon: 30.52, dlt: 1, s2: 1 },
  { name: 'Istanbul', country: 'Türkiye', cc: 'TR', lat: 41.01, lon: 28.98, dlt: 1, s2: 1 },
  { name: 'Dublin', country: 'Ireland', cc: 'IE', lat: 53.35, lon: -6.26, dlt: 1, s2: 1 },
  // North America
  { name: 'Ashburn', country: 'United States', cc: 'US', lat: 39.04, lon: -77.49, dlt: 7, s2: 1 },
  { name: 'New York', country: 'United States', cc: 'US', lat: 40.71, lon: -74.01, dlt: 3, s2: 2 },
  { name: 'Chicago', country: 'United States', cc: 'US', lat: 41.88, lon: -87.63, dlt: 2, s2: 1 },
  { name: 'Dallas', country: 'United States', cc: 'US', lat: 32.78, lon: -96.8, dlt: 2, s2: 1 },
  { name: 'Atlanta', country: 'United States', cc: 'US', lat: 33.75, lon: -84.39, dlt: 1, s2: 1 },
  { name: 'Miami', country: 'United States', cc: 'US', lat: 25.76, lon: -80.19, dlt: 1, s2: 1 },
  { name: 'Denver', country: 'United States', cc: 'US', lat: 39.74, lon: -104.99, dlt: 1, s2: 1 },
  { name: 'Los Angeles', country: 'United States', cc: 'US', lat: 34.05, lon: -118.24, dlt: 2, s2: 2 },
  { name: 'San Jose', country: 'United States', cc: 'US', lat: 37.34, lon: -121.89, dlt: 2, s2: 1 },
  { name: 'Seattle', country: 'United States', cc: 'US', lat: 47.61, lon: -122.33, dlt: 1, s2: 1 },
  { name: 'Hillsboro', country: 'United States', cc: 'US', lat: 45.52, lon: -122.99, dlt: 2, s2: 0 },
  { name: 'Toronto', country: 'Canada', cc: 'CA', lat: 43.65, lon: -79.38, dlt: 2, s2: 2 },
  { name: 'Montreal', country: 'Canada', cc: 'CA', lat: 45.5, lon: -73.57, dlt: 2, s2: 1 },
  { name: 'Vancouver', country: 'Canada', cc: 'CA', lat: 49.28, lon: -123.12, dlt: 1, s2: 1 },
  { name: 'Mexico City', country: 'Mexico', cc: 'MX', lat: 19.43, lon: -99.13, dlt: 0, s2: 1 },
  // Asia and Oceania
  { name: 'Singapore', country: 'Singapore', cc: 'SG', lat: 1.35, lon: 103.82, dlt: 4, s2: 2 },
  { name: 'Tokyo', country: 'Japan', cc: 'JP', lat: 35.68, lon: 139.69, dlt: 2, s2: 2 },
  { name: 'Seoul', country: 'South Korea', cc: 'KR', lat: 37.57, lon: 126.98, dlt: 1, s2: 2 },
  { name: 'Hong Kong', country: 'Hong Kong', cc: 'HK', lat: 22.32, lon: 114.17, dlt: 1, s2: 1 },
  { name: 'Mumbai', country: 'India', cc: 'IN', lat: 19.08, lon: 72.88, dlt: 1, s2: 1 },
  { name: 'Bangalore', country: 'India', cc: 'IN', lat: 12.97, lon: 77.59, dlt: 0, s2: 1 },
  { name: 'Taipei', country: 'Taiwan', cc: 'TW', lat: 25.03, lon: 121.57, dlt: 0, s2: 1 },
  { name: 'Jakarta', country: 'Indonesia', cc: 'ID', lat: -6.21, lon: 106.85, dlt: 0, s2: 1 },
  { name: 'Bangkok', country: 'Thailand', cc: 'TH', lat: 13.76, lon: 100.5, dlt: 0, s2: 1 },
  { name: 'Sydney', country: 'Australia', cc: 'AU', lat: -33.87, lon: 151.21, dlt: 1, s2: 1 },
  { name: 'Melbourne', country: 'Australia', cc: 'AU', lat: -37.81, lon: 144.96, dlt: 0, s2: 1 },
  { name: 'Auckland', country: 'New Zealand', cc: 'NZ', lat: -36.85, lon: 174.76, dlt: 0, s2: 1 },
  // Elsewhere
  { name: 'São Paulo', country: 'Brazil', cc: 'BR', lat: -23.55, lon: -46.63, dlt: 1, s2: 1 },
  { name: 'Buenos Aires', country: 'Argentina', cc: 'AR', lat: -34.6, lon: -58.38, dlt: 0, s2: 1 },
  { name: 'Johannesburg', country: 'South Africa', cc: 'ZA', lat: -26.2, lon: 28.05, dlt: 1, s2: 1 },
  { name: 'Lagos', country: 'Nigeria', cc: 'NG', lat: 6.52, lon: 3.38, dlt: 0, s2: 1 },
  { name: 'Nairobi', country: 'Kenya', cc: 'KE', lat: -1.29, lon: 36.82, dlt: 0, s2: 1 },
  { name: 'Dubai', country: 'United Arab Emirates', cc: 'AE', lat: 25.2, lon: 55.27, dlt: 1, s2: 1 },
  { name: 'Tel Aviv', country: 'Israel', cc: 'IL', lat: 32.09, lon: 34.78, dlt: 0, s2: 1 },
];
