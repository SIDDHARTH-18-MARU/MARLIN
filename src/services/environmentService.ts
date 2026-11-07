import type { EnvironmentSample, SecurityZone, StormCell } from '@/types';
import { getEnvironmentAt, getSecurityRiskAt } from '@/engine/environment';

// Future backend seam: GET /api/v1/environment?lat=&lon=&time=
export async function fetchEnvironmentAt(
  lat: number,
  lon: number,
  timeMs: number,
  activeStorms: StormCell[] = [],
): Promise<EnvironmentSample> {
  return getEnvironmentAt(lat, lon, timeMs, activeStorms);
}

export async function fetchSecurityRiskAt(
  lat: number,
  lon: number,
  timeMs: number,
  zones: SecurityZone[],
): Promise<number> {
  return getSecurityRiskAt(lat, lon, timeMs, zones);
}
