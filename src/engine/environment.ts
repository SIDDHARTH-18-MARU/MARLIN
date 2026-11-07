import type { EnvironmentSample, LatLon, SecurityZone, StormCell } from '@/types';
import { smoothField } from './prng';
import { destinationPoint, haversineKm } from './geo';

const GLOBAL_FIELD_SEED = 42;

/**
 * getEnvironmentAt(lat, lon, time) — SIMULATED ENVIRONMENT.
 *
 * Deterministic, continuous, and time-varying so departure time genuinely
 * changes route outcomes, but it is a smooth analytic field (sum of sine
 * waves + storm-cell perturbation), not an ingested forecast. A real
 * deployment replaces this function's body with a call to a weather/ocean
 * data provider — every other module only depends on this signature.
 */
export function getEnvironmentAt(
  lat: number,
  lon: number,
  timeMs: number,
  activeStorms: StormCell[] = [],
): EnvironmentSample {
  const dayFrac = (timeMs / (1000 * 60 * 60 * 24)) % 1;
  const t = dayFrac * Math.PI * 2;

  // Latitude uses a tighter divisor than longitude: MARLIN's route candidates
  // differ mostly in latitude (perpendicular offsets around a mostly
  // east-west corridor), so the field needs meaningful north-south texture
  // over a 1-3 degree band for the three candidates to be distinguishable.
  // ENGINEERING RECOMMENDATION — tuned for the prototype's corridor geometry.
  const base = smoothField(lon / 4, lat / 1.6, t, GLOBAL_FIELD_SEED);
  const base2 = smoothField(lon / 7, lat / 2.4, t * 0.6, GLOBAL_FIELD_SEED + 91);

  let windSpeedKn = 8 + Math.abs(base) * 14 + Math.abs(base2) * 6;
  let waveHeightM = 0.6 + Math.abs(base) * 1.8 + Math.abs(base2) * 0.9;
  const currentSpeedKn = 0.4 + Math.abs(base2) * 1.6;

  const windDirDeg = (smoothField(lon / 20, lat / 20, t * 0.3, GLOBAL_FIELD_SEED + 5) * 180 + 360) % 360;
  const currentDirDeg = (smoothField(lon / 25, lat / 25, t * 0.2, GLOBAL_FIELD_SEED + 17) * 180 + 360) % 360;

  let stormIntensity = 0;
  for (const storm of activeStorms) {
    const hoursElapsed = (timeMs - storm.activeFromMs) / 3_600_000;
    const currentCenter =
      hoursElapsed > 0 ? destinationPoint(storm.center, storm.headingDeg, storm.speedKn * hoursElapsed) : storm.center;
    const distKm = haversineKm({ lat, lon }, currentCenter);
    if (distKm < storm.radiusKm && timeMs >= storm.activeFromMs && timeMs <= storm.activeUntilMs) {
      const proximity = 1 - distKm / storm.radiusKm;
      stormIntensity = Math.max(stormIntensity, storm.intensity * proximity);
    }
  }

  windSpeedKn += stormIntensity * 35;
  waveHeightM += stormIntensity * 4.5;

  const wavePeriodS = 6 + waveHeightM * 1.3;
  const waveDirDeg = (windDirDeg + 15) % 360;

  const weatherRisk = Math.min(
    100,
    windSpeedKn * 1.1 + waveHeightM * 14 + stormIntensity * 45,
  );

  return {
    lat,
    lon,
    timeMs,
    windSpeedKn: round1(windSpeedKn),
    windDirDeg: round1(windDirDeg),
    waveHeightM: round1(waveHeightM),
    waveDirDeg: round1(waveDirDeg),
    wavePeriodS: round1(wavePeriodS),
    currentSpeedKn: round1(currentSpeedKn),
    currentDirDeg: round1(currentDirDeg),
    stormIntensity: round2(stormIntensity),
    weatherRisk: round1(weatherRisk),
  };
}

export function getSecurityRiskAt(lat: number, lon: number, timeMs: number, zones: SecurityZone[]): number {
  let risk = 0;
  const levelWeight: Record<string, number> = { NORMAL: 5, ELEVATED: 35, HIGH: 65, CRITICAL: 90 };
  for (const z of zones) {
    if (timeMs < z.activeFromMs || timeMs > z.activeUntilMs) continue;
    const distKm = haversineKm({ lat, lon }, z.center);
    if (distKm < z.radiusKm) {
      const proximity = 1 - distKm / z.radiusKm;
      risk = Math.max(risk, levelWeight[z.level] * proximity);
    }
  }
  return round1(risk);
}

export function activeStormCenterAt(storm: StormCell, timeMs: number): LatLon {
  const hoursElapsed = Math.max(0, (timeMs - storm.activeFromMs) / 3_600_000);
  return destinationPoint(storm.center, storm.headingDeg, storm.speedKn * hoursElapsed);
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}
