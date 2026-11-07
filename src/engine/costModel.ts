import type { EnvironmentSample, RouteMetrics, RouteRiskBreakdown, RoutingPreferences, VesselProfile } from '@/types';

const KN_TO_KMH = 1.852;

/**
 * SIMPLIFIED MODEL FOR PROTOTYPE — not a validated naval-architecture
 * performance model. V_effective = V_base + V_current_component - P_wind - P_wave.
 */
export function effectiveSpeedKn(vessel: VesselProfile, env: EnvironmentSample, courseDeg: number): number {
  const angle = ((env.currentDirDeg - courseDeg) * Math.PI) / 180;
  const currentComponentKn = env.currentSpeedKn * Math.cos(angle) * vessel.currentSensitivity;

  const windPenaltyKn = (env.windSpeedKn / 10) * vessel.windSensitivity * 1.1;
  const wavePenaltyKn = env.waveHeightM * vessel.waveSensitivity * 1.9;

  const vEff = vessel.cruisingSpeedKn + currentComponentKn - windPenaltyKn - wavePenaltyKn;
  return Math.min(vessel.maxSpeedKn, Math.max(vessel.cruisingSpeedKn * 0.28, vEff));
}

export function knToKmh(kn: number): number {
  return kn * KN_TO_KMH;
}

/** MODELLED FUEL ESTIMATE. Fuel = BaseFuelRate x TravelTime x EnvironmentalFactor. */
export function environmentalFuelFactor(vessel: VesselProfile, env: EnvironmentSample): number {
  return (
    1 +
    vessel.windSensitivity * (env.windSpeedKn / 25) +
    vessel.waveSensitivity * (env.waveHeightM / 3) +
    env.stormIntensity * 0.6
  );
}

const RISK_WEIGHTS = { weather: 0.35, wave: 0.25, current: 0.15, security: 0.25 };

/** RISK SCORE: 0-100 modeled decision-support indicator — not an accident probability. */
export function totalRiskAt(vessel: VesselProfile, env: EnvironmentSample, securityRisk: number): RouteRiskBreakdown {
  const rWeather = env.weatherRisk;
  const rWave = Math.min(100, env.waveHeightM * 20 * (0.5 + vessel.waveSensitivity));
  const rCurrent = Math.min(100, env.currentSpeedKn * 15 * (0.5 + vessel.currentSensitivity));
  const rSecurity = securityRisk;

  const total =
    RISK_WEIGHTS.weather * rWeather +
    RISK_WEIGHTS.wave * rWave +
    RISK_WEIGHTS.current * rCurrent +
    RISK_WEIGHTS.security * rSecurity;

  const totalRounded = round1(Math.min(100, total));
  return {
    weather: round1(rWeather),
    wave: round1(rWave),
    current: round1(rCurrent),
    security: round1(rSecurity),
    total: totalRounded,
    peak: totalRounded, // single-point evaluation: peak == total here
  };
}

/** Normalized weighted cost used to rank/score candidate routes for a given operator preference set. */
export function weightedScore(
  metrics: Pick<RouteMetrics, 'durationHr' | 'fuelTonnes' | 'risk'>,
  preferences: RoutingPreferences,
  bounds: { minDuration: number; maxDuration: number; minFuel: number; maxFuel: number; minRisk: number; maxRisk: number },
): number {
  const tNorm = normalize(metrics.durationHr, bounds.minDuration, bounds.maxDuration);
  const fNorm = normalize(metrics.fuelTonnes, bounds.minFuel, bounds.maxFuel);
  const rNorm = normalize(metrics.risk.total, bounds.minRisk, bounds.maxRisk);

  const wSum = preferences.time + preferences.fuel + preferences.safety || 1;
  const wTime = preferences.time / wSum;
  const wFuel = preferences.fuel / wSum;
  const wRisk = preferences.safety / wSum;

  return wTime * tNorm + wFuel * fNorm + wRisk * rNorm;
}

export function normalize(v: number, min: number, max: number): number {
  if (max - min < 1e-9) return 0;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
