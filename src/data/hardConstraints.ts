// Coarse landmass exclusion boxes. These exist only to stop the demo route
// generator's lateral perturbation from drawing a "candidate route" segment
// across a continent — they are not a bathymetric or coastline dataset.
// This is the frontend's stand-in for the backend's real navigable/
// non-navigable cell classification (see Methodology > Hard Constraints).

import type { LatLon } from '@/types';

export interface LandBox {
  id: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export const LAND_EXCLUSION_BOXES: LandBox[] = [
  { id: 'indian-subcontinent', minLat: 8, maxLat: 24, minLon: 68, maxLon: 88 },
  { id: 'sri-lanka', minLat: 5.9, maxLat: 9.9, minLon: 79.5, maxLon: 82 },
  { id: 'malay-peninsula', minLat: 1, maxLat: 14, minLon: 98, maxLon: 105 },
  { id: 'sumatra', minLat: -6, maxLat: 6, minLon: 95, maxLon: 106 },
  { id: 'java', minLat: -9, maxLat: -5, minLon: 105, maxLon: 115 },
  { id: 'madagascar', minLat: -26, maxLat: -12, minLon: 43, maxLon: 50.5 },
  { id: 'east-africa', minLat: -35, maxLat: 12, minLon: 12, maxLon: 40 },
  { id: 'arabian-peninsula', minLat: 12, maxLat: 32, minLon: 34, maxLon: 55 },
];

export function isOverLand(lat: number, lon: number): boolean {
  return LAND_EXCLUSION_BOXES.some(
    (b) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon,
  );
}

export function segmentCrossesLand(a: LatLon, b: LatLon): boolean {
  const samples = 5;
  for (let i = 1; i < samples; i++) {
    const f = i / samples;
    if (isOverLand(a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f)) return true;
  }
  return false;
}
