import type { Port } from '@/types';

export const PORTS: Port[] = [
  { id: 'mumbai', name: 'Mumbai (JNPT)', country: 'India', lat: 18.94, lon: 72.84 },
  { id: 'kochi', name: 'Kochi', country: 'India', lat: 9.93, lon: 76.26 },
  { id: 'chennai', name: 'Chennai', country: 'India', lat: 13.08, lon: 80.27 },
  { id: 'colombo', name: 'Colombo', country: 'Sri Lanka', lat: 6.93, lon: 79.85 },
  { id: 'male', name: 'Malé', country: 'Maldives', lat: 4.17, lon: 73.51 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', lat: 1.29, lon: 103.85 },
  { id: 'jakarta', name: 'Jakarta (Tanjung Priok)', country: 'Indonesia', lat: -6.1, lon: 106.86 },
  { id: 'durban', name: 'Durban', country: 'South Africa', lat: -29.87, lon: 31.02 },
  { id: 'mombasa', name: 'Mombasa', country: 'Kenya', lat: -4.04, lon: 39.66 },
  { id: 'muscat', name: 'Muscat', country: 'Oman', lat: 23.61, lon: 58.59 },
  { id: 'dubai', name: 'Dubai (Jebel Ali)', country: 'UAE', lat: 24.98, lon: 55.06 },
  { id: 'port-louis', name: 'Port Louis', country: 'Mauritius', lat: -20.16, lon: 57.5 },
];

export const portById = (id: string): Port => {
  const p = PORTS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown port id: ${id}`);
  return p;
};
