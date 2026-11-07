import type {
  LatLon,
  Route,
  RouteKind,
  RouteMetrics,
  RouteWaypoint,
  RoutingPreferences,
  SecurityZone,
  StormCell,
  VesselProfile,
} from '@/types';
import { corridorPath } from '@/data/corridorGraph';
import { segmentCrossesLand } from '@/data/hardConstraints';
import { STORM_TEMPLATES, SECURITY_ZONE_TEMPLATES } from '@/data/hazards';
import { activeStormCenterAt, getEnvironmentAt, getSecurityRiskAt } from './environment';
import { effectiveSpeedKn, environmentalFuelFactor, totalRiskAt } from './costModel';
import { bearingDeg, courseAt, densifyPath, haversineKm, offsetPerpendicular } from './geo';
import { explainRoute } from './explain';

const KN_TO_KMH = 1.852;
const PATH_RESOLUTION = 140; // waypoints per candidate route — finer sampling keeps offsets from skipping over thin coastlines

export interface RouteGenParams {
  vessel: VesselProfile;
  originPoint: LatLon;
  originPortId?: string;
  destPortId: string;
  departureMs: number;
  preferences: RoutingPreferences;
  activeStorms?: StormCell[];
  activeSecurityZones?: SecurityZone[];
  /** Provide when regenerating mid-voyage: the remaining corridor control points from the ship's current position onward. */
  basePolylineOverride?: LatLon[];
}

const STATIC_FORECAST_CONFIDENCE = { h0_24: 95, h24_48: 88, h48_72: 80, h72plus: 65 };

function buildControlPoints(params: RouteGenParams): LatLon[] {
  const control = params.basePolylineOverride
    ? [...params.basePolylineOverride]
    : corridorPath(params.originPortId!, params.destPortId);
  if (control.length < 2) throw new Error('A route requires at least two waypoints.');
  control[0] = params.originPoint;
  return control;
}

function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < values.length) {
        sum += values[idx];
        n++;
      }
    }
    return sum / n;
  });
}

type OffsetMode = 'avoid' | 'neutral' | 'through';

// Known hazard-prone corridor chokepoints (see data/hazards.ts), used as a
// geographic anchor for candidate shaping regardless of whether a hazard is
// currently active. The Recommended candidate leans away from the nearest
// anchor; the High-Risk Alternative leans toward it — this is what keeps the
// three candidates reliably distinguishable even in a calm baseline
// environment. ENGINEERING SIMPLIFICATION — see Methodology > Route Generation.
const HAZARD_ANCHORS: LatLon[] = [...STORM_TEMPLATES.map((t) => t.center), ...SECURITY_ZONE_TEMPLATES.map((z) => z.center)];
const ANCHOR_INFLUENCE_KM = 1100;

function nearestAnchorDistanceKm(p: LatLon, extra: LatLon[] = []): number {
  let best = Infinity;
  for (const a of HAZARD_ANCHORS) best = Math.min(best, haversineKm(p, a));
  for (const a of extra) best = Math.min(best, haversineKm(p, a));
  return best;
}

function computeOffsetProfile(
  base: LatLon[],
  mode: OffsetMode,
  vessel: VesselProfile,
  departureMs: number,
  storms: StormCell[],
  zones: SecurityZone[],
): number[] {
  const maxAvoidKm = 190;
  const sampleKm = 100;
  const baseFloorKm = 45;

  let cumDist = 0;
  const cumDistances: number[] = [0];
  for (let i = 1; i < base.length; i++) {
    cumDist += haversineKm(base[i - 1], base[i]);
    cumDistances.push(cumDist);
  }
  const totalDist = cumDistances[cumDistances.length - 1] || 1;

  const raw = base.map((p, i) => {
    if (i === 0 || i === base.length - 1) return 0;

    const course = courseAt(base, i);
    const roughEtaMs = departureMs + (cumDistances[i] / (vessel.cruisingSpeedKn * KN_TO_KMH)) * 3_600_000;

    // Slow, organic large-scale wiggle shared by every candidate so the
    // corridor never looks perfectly straight. Same sign for every mode —
    // it is not the thing that separates the candidates from each other.
    const fracAlong = cumDistances[i] / totalDist;
    const wiggle = Math.sin(fracAlong * Math.PI * 1.6 + 0.7);
    const wiggleTerm = wiggle * baseFloorKm;

    if (mode === 'neutral') return wiggleTerm * 0.35; // fastest: hugs the base corridor

    // Geographic anchor bias: which perpendicular side is closer to the
    // nearest hazard-prone chokepoint (data/hazards.ts) OR a currently
    // active storm/security zone? Active hazards are anchored to this exact
    // route (see triggerWeatherEvent/triggerSecurityEvent), so they always
    // sit right on top of the corridor and dominate the shaping — this is
    // what actually separates Recommended from High-Risk Alternative, and
    // what drives the reroute away from a newly detected hazard.
    const liveAnchors: LatLon[] = [
      ...storms.map((st) => activeStormCenterAt(st, roughEtaMs)),
      ...zones.map((z) => z.center),
    ];
    const distToAnchor = nearestAnchorDistanceKm(p, liveAnchors);
    const anchorInfluence = Math.max(0, 1 - distToAnchor / ANCHOR_INFLUENCE_KM) ** 0.55;
    let anchorDir = 0;
    if (anchorInfluence > 0) {
      const left = offsetPerpendicular(p, course, -sampleKm);
      const right = offsetPerpendicular(p, course, sampleKm);
      anchorDir = nearestAnchorDistanceKm(left, liveAnchors) < nearestAnchorDistanceKm(right, liveAnchors) ? -1 : 1; // toward the closer side
    }
    const anchorTerm = anchorDir * maxAvoidKm * anchorInfluence;

    // Live risk field also nudges the candidates apart, even away from a
    // named anchor, using the actual environment/security model.
    const env = getEnvironmentAt(p.lat, p.lon, roughEtaMs, storms);
    const sec = getSecurityRiskAt(p.lat, p.lon, roughEtaMs, zones);
    const fieldRiskNorm = Math.min(1, totalRiskAt(vessel, env, sec).total / 55);

    if (mode === 'through') {
      return wiggleTerm + anchorTerm + fieldRiskNorm * 70;
    }
    return wiggleTerm - anchorTerm - fieldRiskNorm * 70; // avoid (recommended)
  });

  return movingAverage(raw, 5);
}

function coordsFromOffsets(base: LatLon[], offsets: number[]): LatLon[] {
  return base.map((p, i) => {
    if (Math.abs(offsets[i]) < 0.5) return p;
    const course = courseAt(base, i);
    return offsetPerpendicular(p, course, offsets[i]);
  });
}

/**
 * Apply a lateral offset profile to the base corridor, checking samples
 * against coarse land boxes. Individually clamping each offset point isn't
 * enough — two adjacent points can each sit in open water while the segment
 * between them still clips a thin landmass (a peninsula tip, a narrow
 * strait). Instead of hard-snapping just the offending point(s) back to the
 * base corridor (which draws a visible kink/spike in the route), pull the
 * offset smoothly toward zero over a window around the crossing and re-run
 * the moving-average smoothing pass, so the correction blends into the
 * surrounding curve.
 */
function applyOffsets(base: LatLon[], offsets: number[]): LatLon[] {
  let working = [...offsets];

  for (let pass = 0; pass < 4; pass++) {
    const coords = coordsFromOffsets(base, working);
    let anyCrossing = false;
    const window = 6;

    for (let i = 1; i < coords.length; i++) {
      if (!segmentCrossesLand(coords[i - 1], coords[i])) continue;
      anyCrossing = true;
      for (let k = -window; k <= window; k++) {
        const idx = i + k;
        if (idx < 0 || idx >= working.length) continue;
        const falloff = 1 - Math.abs(k) / (window + 1); // 1 at the crossing, 0 at the window edge
        working[idx] *= 1 - falloff; // pull toward zero, more strongly near the crossing
      }
    }

    if (!anyCrossing) return coords;
    working = movingAverage(working, 5);
  }

  // A genuinely narrow strait can survive the smoothing passes — resolve
  // whatever's left with a final, LOCAL fix: zero out only the specific
  // offending points (not the whole path) and accept that result, rather
  // than discarding the entire route's offset and losing its distinctness
  // from the other two candidates.
  let coords = coordsFromOffsets(base, working);
  for (let i = 1; i < coords.length; i++) {
    if (!segmentCrossesLand(coords[i - 1], coords[i])) continue;
    working[i - 1] = 0;
    working[i] = 0;
  }
  coords = coordsFromOffsets(base, working);
  return coords;
}

export interface SimResult {
  waypoints: RouteWaypoint[];
  metrics: RouteMetrics;
}

/** Time-stepped evaluation of a fixed candidate geometry: position -> time -> environment -> speed -> next time. */
export function evaluatePath(
  path: LatLon[],
  vessel: VesselProfile,
  departureMs: number,
  preferences: RoutingPreferences,
  storms: StormCell[],
  zones: SecurityZone[],
): SimResult {
  const waypoints: RouteWaypoint[] = [];
  let timeMs = departureMs;
  let distanceKm = 0;
  let fuelTonnes = 0;

  let sumWeather = 0;
  let sumWave = 0;
  let sumCurrent = 0;
  let sumSecurity = 0;
  let sumTotal = 0;
  let maxTotal = 0;
  let maxWeather = 0;
  let maxWave = 0;
  let maxCurrent = 0;
  let maxSecurity = 0;

  waypoints.push({
    lat: path[0].lat,
    lon: path[0].lon,
    distanceFromStartKm: 0,
    cumulativeTimeHr: 0,
    etaMs: timeMs,
    effectiveSpeedKn: vessel.cruisingSpeedKn,
    riskAtPoint: 0,
  });

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const point = path[i];
    const course = bearingDeg(prev, point);
    const segDistKm = haversineKm(prev, point);

    const env = getEnvironmentAt(prev.lat, prev.lon, timeMs, storms);
    const vEff = effectiveSpeedKn(vessel, env, course);
    const segTimeHr = segDistKm / (vEff * KN_TO_KMH);
    const fuelFactor = environmentalFuelFactor(vessel, env);
    const segFuel = vessel.baseFuelRateTPerHr * segTimeHr * fuelFactor;

    timeMs += segTimeHr * 3_600_000;
    distanceKm += segDistKm;
    fuelTonnes += segFuel;

    const secRisk = getSecurityRiskAt(point.lat, point.lon, timeMs, zones);
    const risk = totalRiskAt(vessel, env, secRisk);

    sumWeather += risk.weather;
    sumWave += risk.wave;
    sumCurrent += risk.current;
    sumSecurity += risk.security;
    sumTotal += risk.total;
    maxTotal = Math.max(maxTotal, risk.total);
    maxWeather = Math.max(maxWeather, risk.weather);
    maxWave = Math.max(maxWave, risk.wave);
    maxCurrent = Math.max(maxCurrent, risk.current);
    maxSecurity = Math.max(maxSecurity, risk.security);

    waypoints.push({
      lat: point.lat,
      lon: point.lon,
      distanceFromStartKm: distanceKm,
      cumulativeTimeHr: (timeMs - departureMs) / 3_600_000,
      etaMs: timeMs,
      effectiveSpeedKn: round1(vEff),
      riskAtPoint: risk.total,
    });
  }

  // Route-level risk blends average exposure with peak exposure: a brief
  // transit through a severe-risk pocket matters operationally even if the
  // whole-voyage average looks moderate. ENGINEERING RECOMMENDATION.
  const n = path.length - 1;
  const blend = (avg: number, max: number) => avg * 0.35 + max * 0.65;
  const risk = {
    weather: round1(blend(sumWeather / n, maxWeather)),
    wave: round1(blend(sumWave / n, maxWave)),
    current: round1(blend(sumCurrent / n, maxCurrent)),
    security: round1(blend(sumSecurity / n, maxSecurity)),
    total: round1(blend(sumTotal / n, maxTotal)),
    peak: round1(maxTotal),
  };

  const metrics: RouteMetrics = {
    distanceKm: round1(distanceKm),
    durationHr: round1((timeMs - departureMs) / 3_600_000),
    etaMs: timeMs,
    fuelTonnes: round1(fuelTonnes),
    risk,
    securityExposure: risk.security,
    weatherExposure: risk.weather,
    forecastConfidence: STATIC_FORECAST_CONFIDENCE,
    withinRiskThreshold: maxTotal <= preferences.riskThreshold + 15, // small tolerance vs a hard trip-wire
  };

  return { waypoints, metrics };
}

const ROLE_META: Record<RouteKind, { label: string; color: string }> = {
  recommended: { label: 'Recommended', color: '#33cc7a' },
  fastest: { label: 'Fastest Alternative', color: '#3aa0ff' },
  'high-risk': { label: 'Trade-off Alternative', color: '#ff4d4f' },
};

function buildCandidate(
  kind: RouteKind,
  path: LatLon[],
  params: RouteGenParams,
  idSuffix: string,
): Route {
  const { vessel, departureMs, preferences, activeStorms = [], activeSecurityZones = [] } = params;
  const { waypoints, metrics } = evaluatePath(path, vessel, departureMs, preferences, activeStorms, activeSecurityZones);
  const meta = ROLE_META[kind];
  return {
    id: `route-${kind}-${idSuffix}`,
    kind,
    label: meta.label,
    color: meta.color,
    waypoints,
    metrics,
    reasons: [],
  };
}

function relabel(route: Route, kind: RouteKind, idSuffix: string): Route {
  const meta = ROLE_META[kind];
  return { ...route, kind, label: meta.label, color: meta.color, id: `route-${kind}-${idSuffix}` };
}

export function generateRouteCandidates(params: RouteGenParams): Route[] {
  const { safety, fuel, time, riskThreshold } = params.preferences;
  if (!Number.isFinite(new Date(params.departureMs).getTime()) ||
    [safety, fuel, time, riskThreshold].some(value => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error('Enter a valid UTC departure and routing preferences between 0 and 100.');
  }
  const control = buildControlPoints(params);
  const base = densifyPath(control, PATH_RESOLUTION);
  base[0] = params.originPoint;

  const storms = params.activeStorms ?? [];
  const zones = params.activeSecurityZones ?? [];

  const avoidOffsets = computeOffsetProfile(base, 'avoid', params.vessel, params.departureMs, storms, zones);
  const neutralOffsets = computeOffsetProfile(base, 'neutral', params.vessel, params.departureMs, storms, zones);
  const throughOffsets = computeOffsetProfile(base, 'through', params.vessel, params.departureMs, storms, zones);

  const idSuffix = `${Math.round(params.departureMs / 60000)}`;

  const candidates = [avoidOffsets, neutralOffsets, throughOffsets].map((offsets, i) =>
    buildCandidate('recommended', applyOffsets(base, offsets), params, `${idSuffix}-${i}`));
  const maxFuel = Math.max(1, ...candidates.map(r => r.metrics.fuelTonnes));
  const maxTime = Math.max(1, ...candidates.map(r => r.metrics.etaMs - params.departureMs));
  const cost = ({ metrics }: Route) =>
    (safety || (!fuel && !time ? 1 : 0)) * metrics.risk.total / 100 +
    fuel * metrics.fuelTonnes / maxFuel +
    time * (metrics.etaMs - params.departureMs) / maxTime;
  const ranked = candidates.toSorted((a, b) =>
    Number(b.metrics.withinRiskThreshold) - Number(a.metrics.withinRiskThreshold) ||
    cost(a) - cost(b) || a.metrics.risk.peak - b.metrics.risk.peak);
  const alternatives = ranked.slice(1).sort((a, b) => a.metrics.etaMs - b.metrics.etaMs);
  const routes = [
    relabel(ranked[0], 'recommended', idSuffix),
    relabel(alternatives[0], 'fastest', idSuffix),
    relabel(alternatives[1], 'high-risk', idSuffix),
  ];
  for (const r of routes) {
    r.reasons = explainRoute(r, routes, params.preferences);
  }
  return routes;
}

/** Down-sample a dense polyline to `n` control points, always keeping first/last. */
export function downsamplePath(points: LatLon[], n: number): LatLon[] {
  if (points.length <= n) return points;
  const out: LatLon[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (points.length - 1));
    out.push(points[idx]);
  }
  return out;
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
