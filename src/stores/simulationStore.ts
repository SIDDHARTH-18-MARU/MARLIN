import { create } from 'zustand';
import type {
  LatLon,
  Route,
  RouteVersion,
  SecurityZone,
  StormCell,
  TelemetrySample,
  VoyageEvent,
  VoyageEventType,
  VoyageReport,
} from '@/types';
import { useVoyageStore } from './voyageStore';
import { evaluatePath } from '@/engine/routingEngine';
import { activeStormCenterAt, getEnvironmentAt, getSecurityRiskAt } from '@/engine/environment';
import { totalRiskAt } from '@/engine/costModel';
import { bearingDeg, densifyPath, detourAroundCircle, greatCircleInterpolate, haversineKm } from '@/engine/geo';
import { STORM_TEMPLATES, SECURITY_ZONE_TEMPLATES } from '@/data/hazards';
import { segmentCrossesLand } from '@/data/hardConstraints';
import { generateVoyageReport, type CounterfactualLogEntry } from '@/services/reportService';
import { useHistoryStore } from './historyStore';
import { seededRandom } from '@/engine/prng';

/**
 * A message in the shared Control Room <-> Captain Bridge conversation.
 *
 * Timestamped in epoch milliseconds — the same clock the routing engine and
 * simulation use — so both interfaces can render it on their own scale (the
 * bridge converts to mission minutes in bridgeAdapter).
 */
export interface BridgeMessage {
  id: string;
  direction: 'control-to-captain' | 'captain-to-control';
  kind: string;
  body: string;
  sentAtMs: number;
}

const SIM_MS_PER_REAL_MS_AT_1X = 1200; // 1x = 20 simulated minutes per real second
const TELEMETRY_INTERVAL_MS = 30 * 60 * 1000; // record every 30 simulated minutes
const STORM_LOOKAHEAD_KM = 450;
const HAZARD_DURATION_MS = 72 * 3_600_000;
export const MAX_HAZARDS_PER_TYPE = 4;
export const MAX_MESSAGE_LENGTH = 280;

let eventCounter = 0;
let messageCounter = 0;
function nextEventId() {
  eventCounter += 1;
  return `evt-${eventCounter}`;
}

interface DecisionPending {
  reason: string;
  triggeredBy: 'weather' | 'security';
  oldRisk: number;
  oldEtaMs: number;
  oldFuelTonnes: number;
  newRoute: Route;
  hazardLocation: LatLon;
}

interface SimulationState {
  simTimeMs: number;
  isPlaying: boolean;
  speedMultiplier: number;

  routeVersions: RouteVersion[];
  activeVersionIndex: number;
  versionDistanceOffsetKm: number;
  versionFuelOffsetTonnes: number;

  shipPosition: LatLon;
  shipHeadingDeg: number;
  shipSpeedKn: number;
  progressFraction: number;

  telemetryHistory: TelemetrySample[];
  nextRecordAtMs: number;
  events: VoyageEvent[];

  /**
   * Event ids the Captain has acknowledged from the bridge. Held here rather
   * than in the alert panel's local state so the Control Room sees the same
   * acknowledgement — one voyage, two faces.
   */
  acknowledgedEventIds: string[];
  /**
   * The shared Control Room <-> Bridge conversation. Both interfaces append to
   * and read from this single record.
   */
  messages: BridgeMessage[];

  activeStorms: StormCell[];
  activeSecurityZones: SecurityZone[];
  decisionPending: DecisionPending | null;
  isRecalculating: boolean;
  counterfactualLog: CounterfactualLogEntry[];

  // Deterministic (per-voyage-seeded, not random-per-tick) checkpoints along
  // the route's progress where MARLIN autonomously monitors for a hazard —
  // this is what makes conditions change organically during the voyage
  // instead of only ever via the manual "Simulate..." buttons.
  weatherCheckpointFraction: number;
  securityCheckpointFraction: number;
  autoWeatherFired: boolean;
  autoSecurityFired: boolean;

  report: VoyageReport | null;

  initFromActiveRoute: () => void;
  play: () => void;
  pause: () => void;
  setSpeed: (x: number) => void;
  resetSimulation: () => void;
  clearVoyage: () => void;
  tick: (deltaRealMs: number) => void;

  triggerWeatherEvent: () => Promise<void>;
  triggerSecurityEvent: () => Promise<void>;
  approveReroute: () => void;
  keepCurrentRoute: () => void;

  /** Captain acknowledges an alert; visible to the Control Room immediately. */
  acknowledgeEvent: (eventId: string) => void;
  /** Append to the shared Control Room <-> Bridge conversation. */
  sendMessage: (
    direction: BridgeMessage['direction'],
    kind: string,
    body: string,
  ) => void;
}

function currentRoute(s: Pick<SimulationState, 'routeVersions' | 'activeVersionIndex'>): Route | null {
  return s.routeVersions[s.activeVersionIndex]?.route ?? null;
}

function interpolateOnRoute(route: Route, timeMs: number) {
  const wps = route.waypoints;
  if (timeMs <= wps[0].etaMs) {
    return { position: { lat: wps[0].lat, lon: wps[0].lon }, heading: 0, speedKn: wps[0].effectiveSpeedKn, distanceFromStartKm: 0, done: false };
  }
  const last = wps[wps.length - 1];
  if (timeMs >= last.etaMs) {
    return { position: { lat: last.lat, lon: last.lon }, heading: 0, speedKn: last.effectiveSpeedKn, distanceFromStartKm: last.distanceFromStartKm, done: true };
  }
  let i = 0;
  while (i < wps.length - 1 && wps[i + 1].etaMs < timeMs) i++;
  const a = wps[i];
  const b = wps[i + 1];
  const span = b.etaMs - a.etaMs || 1;
  const f = (timeMs - a.etaMs) / span;
  const position = greatCircleInterpolate(a, b, f);
  const heading = bearingDeg(a, b);
  const speedKn = a.effectiveSpeedKn;
  const distanceFromStartKm = a.distanceFromStartKm + (b.distanceFromStartKm - a.distanceFromStartKm) * f;
  return { position, heading, speedKn, distanceFromStartKm, done: false };
}

function remainingPolyline(route: Route, fromDistanceKm: number, fromPoint: LatLon): LatLon[] {
  const ahead = route.waypoints.filter((w) => w.distanceFromStartKm >= fromDistanceKm).map((w) => ({ lat: w.lat, lon: w.lon }));
  return [fromPoint, ...ahead];
}

function nearestTemplate<T extends { center: LatLon }>(point: LatLon, templates: T[]): T {
  let best = templates[0];
  let bestDist = Infinity;
  for (const t of templates) {
    const d = haversineKm(point, t.center);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

function logEvent(
  get: () => SimulationState,
  set: (partial: Partial<SimulationState>) => void,
  type: VoyageEventType,
  severity: VoyageEvent['severity'],
  description: string,
  location: LatLon,
  extra: Partial<VoyageEvent> = {},
) {
  const voyageId = useVoyageStore.getState().voyageId;
  const evt: VoyageEvent = {
    id: nextEventId(),
    voyageId,
    timestampMs: get().simTimeMs,
    location,
    type,
    severity,
    description,
    ...extra,
  };
  set({ events: [...get().events, evt] });
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  simTimeMs: 0,
  isPlaying: false,
  speedMultiplier: 5,

  routeVersions: [],
  activeVersionIndex: 0,
  versionDistanceOffsetKm: 0,
  versionFuelOffsetTonnes: 0,

  shipPosition: { lat: 0, lon: 0 },
  shipHeadingDeg: 0,
  shipSpeedKn: 0,
  progressFraction: 0,

  telemetryHistory: [],
  nextRecordAtMs: 0,
  events: [],
  acknowledgedEventIds: [],
  messages: [],

  activeStorms: [],
  activeSecurityZones: [],
  decisionPending: null,
  isRecalculating: false,
  counterfactualLog: [],

  weatherCheckpointFraction: 0.3,
  securityCheckpointFraction: 0.65,
  autoWeatherFired: false,
  autoSecurityFired: false,

  report: null,

  initFromActiveRoute: () => {
    const voyage = useVoyageStore.getState();
    const route = voyage.activeRoute();
    if (!route) return;

    const rng = seededRandom(JSON.stringify([
      voyage.vessel.id, voyage.origin.id, voyage.destination.id, voyage.departureMs,
      voyage.preferences.safety, voyage.preferences.fuel, voyage.preferences.time,
      voyage.preferences.riskThreshold, route.kind,
    ]));
    const weatherCheckpointFraction = 0.15 + rng() * 0.25; // 15%–40% of the way there
    const securityCheckpointFraction = 0.55 + rng() * 0.3; // 55%–85% of the way there
    const version: RouteVersion = {
      version: 1,
      route,
      createdAtMs: voyage.departureMs,
      reason: 'Initial plan',
      originAtCreation: { lat: voyage.origin.lat, lon: voyage.origin.lon },
    };
    const originEnv = getEnvironmentAt(voyage.origin.lat, voyage.origin.lon, voyage.departureMs, []);
    const originSecRisk = getSecurityRiskAt(voyage.origin.lat, voyage.origin.lon, voyage.departureMs, []);
    const initialRiskBreakdown = totalRiskAt(voyage.vessel, originEnv, originSecRisk);

    set({
      simTimeMs: voyage.departureMs,
      isPlaying: false,
      routeVersions: [version],
      activeVersionIndex: 0,
      versionDistanceOffsetKm: 0,
      versionFuelOffsetTonnes: 0,
      shipPosition: { lat: voyage.origin.lat, lon: voyage.origin.lon },
      shipHeadingDeg: 0,
      shipSpeedKn: voyage.vessel.cruisingSpeedKn,
      progressFraction: 0,
      telemetryHistory: [
        {
          timestampMs: voyage.departureMs,
          position: { lat: voyage.origin.lat, lon: voyage.origin.lon },
          headingDeg: 0,
          speedKn: voyage.vessel.cruisingSpeedKn,
          distanceTravelledKm: 0,
          distanceRemainingKm: route.metrics.distanceKm,
          fuelUsedTonnes: 0,
          eta: route.metrics.etaMs,
          risk: initialRiskBreakdown.total,
          riskBreakdown: initialRiskBreakdown,
          securityExposure: round1(originSecRisk),
          routeVersion: 1,
        },
      ],
      nextRecordAtMs: voyage.departureMs + TELEMETRY_INTERVAL_MS,
      events: [],
      // A new voyage starts with a clean alert and conversation record.
      acknowledgedEventIds: [],
      messages: [],
      activeStorms: [],
      activeSecurityZones: [],
      decisionPending: null,
      isRecalculating: false,
      counterfactualLog: [],
      weatherCheckpointFraction,
      securityCheckpointFraction,
      autoWeatherFired: false,
      autoSecurityFired: false,
      report: null,
    });
    logEvent(get, set, 'VOYAGE_STARTED', 'INFO', `Voyage started: ${voyage.origin.name} to ${voyage.destination.name}.`, {
      lat: voyage.origin.lat,
      lon: voyage.origin.lon,
    });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setSpeed: (x) => set({ speedMultiplier: x }),

  resetSimulation: () => {
    const voyage = useVoyageStore.getState();
    if (!voyage.activeRoute() || !['underway', 'complete'].includes(voyage.status)) return;
    useVoyageStore.setState({ status: 'underway', voyageId: `voy-${crypto.randomUUID()}` });
    get().initFromActiveRoute();
  },
  clearVoyage: () => set({
    isPlaying: false, routeVersions: [], activeVersionIndex: 0, telemetryHistory: [],
    decisionPending: null, isRecalculating: false, events: [], messages: [],
    acknowledgedEventIds: [], activeStorms: [], activeSecurityZones: [], report: null,
  }),

  acknowledgeEvent: (eventId) => {
    const s = get();
    if (s.acknowledgedEventIds.includes(eventId)) return;
    set({ acknowledgedEventIds: [...s.acknowledgedEventIds, eventId] });
  },

  sendMessage: (direction, kind, body) => {
    const trimmed = body.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) return;
    const s = get();
    set({
      messages: [
        ...s.messages.slice(-99),
        {
          id: `msg-${++messageCounter}`,
          direction,
          kind,
          body: trimmed,
          // Stamped on the simulation clock, not wall time, so the message
          // sits correctly in the voyage timeline on both interfaces.
          sentAtMs: s.simTimeMs,
        },
      ],
    });
  },

  tick: (deltaRealMs) => {
    const s = get();
    if (!s.isPlaying || s.decisionPending || s.isRecalculating ||
      useVoyageStore.getState().status !== 'underway' || !Number.isFinite(deltaRealMs) || deltaRealMs <= 0) return;
    const route = currentRoute(s);
    if (!route) return;

    const deltaSimMs = deltaRealMs * s.speedMultiplier * SIM_MS_PER_REAL_MS_AT_1X;
    const newSimTimeMs = Math.min(route.metrics.etaMs, s.simTimeMs + deltaSimMs);

    const interp = interpolateOnRoute(route, newSimTimeMs);
    const vessel = useVoyageStore.getState().vessel;

    const env = getEnvironmentAt(interp.position.lat, interp.position.lon, newSimTimeMs, s.activeStorms);
    const secRisk = getSecurityRiskAt(interp.position.lat, interp.position.lon, newSimTimeMs, s.activeSecurityZones);
    const liveRiskBreakdown = totalRiskAt(vessel, env, secRisk);

    const distanceTravelledKm = s.versionDistanceOffsetKm + interp.distanceFromStartKm;
    const fuelOnVersion = (interp.distanceFromStartKm / Math.max(1, route.metrics.distanceKm)) * route.metrics.fuelTonnes;
    const fuelUsedTonnes = s.versionFuelOffsetTonnes + fuelOnVersion;

    let patch: Partial<SimulationState> = {
      simTimeMs: newSimTimeMs,
      shipPosition: interp.position,
      shipHeadingDeg: interp.heading,
      shipSpeedKn: interp.done ? 0 : interp.speedKn,
      progressFraction: interp.done ? 1 : Math.min(1, interp.distanceFromStartKm / Math.max(1, route.metrics.distanceKm)),
    };

    if (newSimTimeMs >= s.nextRecordAtMs || interp.done) {
      const totalDistanceAllVersions = s.versionDistanceOffsetKm + route.metrics.distanceKm;
      const sample: TelemetrySample = {
        timestampMs: newSimTimeMs,
        position: interp.position,
        headingDeg: interp.heading,
        speedKn: interp.done ? 0 : interp.speedKn,
        distanceTravelledKm: round1(distanceTravelledKm),
        distanceRemainingKm: round1(Math.max(0, totalDistanceAllVersions - distanceTravelledKm)),
        fuelUsedTonnes: round1(fuelUsedTonnes),
        eta: route.metrics.etaMs,
        risk: liveRiskBreakdown.total,
        riskBreakdown: liveRiskBreakdown,
        securityExposure: round1(secRisk),
        routeVersion: s.routeVersions[s.activeVersionIndex].version,
      };
      patch = { ...patch, telemetryHistory: [...s.telemetryHistory, sample], nextRecordAtMs: s.nextRecordAtMs + TELEMETRY_INTERVAL_MS };
    }

    set(patch);

    if (interp.done) {
      completeVoyageInternal(get, set);
      return;
    }

    // Autonomous monitoring: fire the same detection/reroute flow the
    // manual buttons use, but organically as the voyage reaches each
    // deterministic (seeded, not random) checkpoint — this is what makes
    // conditions change mid-journey without the operator having to click
    // anything.
    const progress = patch.progressFraction ?? s.progressFraction;
    if (!s.autoWeatherFired && progress >= s.weatherCheckpointFraction) {
      set({ autoWeatherFired: true });
      void get().triggerWeatherEvent();
    } else if (!s.autoSecurityFired && progress >= s.securityCheckpointFraction) {
      set({ autoSecurityFired: true });
      void get().triggerSecurityEvent();
    }
  },

  triggerWeatherEvent: async () => {
    const s = get();
    if (s.decisionPending || s.isRecalculating || s.activeStorms.length >= MAX_HAZARDS_PER_TYPE ||
      useVoyageStore.getState().status !== 'underway') return;
    const route = currentRoute(s);
    if (!route) return;

    const remaining = remainingPolyline(route, route.metrics.distanceKm * s.progressFraction, s.shipPosition);
    const lookahead = pointAheadAlong(remaining, STORM_LOOKAHEAD_KM);
    const template = nearestTemplate(lookahead, STORM_TEMPLATES);

    const storm: StormCell = {
      id: `${template.id}-${s.simTimeMs}`,
      center: lookahead, // anchored to the route, not the template's fixed location
      radiusKm: template.radiusKm,
      intensity: template.intensity,
      headingDeg: template.headingDeg,
      speedKn: template.speedKn,
      activeFromMs: s.simTimeMs,
      activeUntilMs: s.simTimeMs + HAZARD_DURATION_MS,
    };

    set({ activeStorms: [...s.activeStorms, storm] });
    logEvent(get, set, 'STORM_DETECTED', 'WARNING', `${template.name} detected ahead on the current route.`, lookahead);

    await recalcAndPropose(get, set, 'weather', `Severe weather — ${template.name}`, lookahead);
  },

  triggerSecurityEvent: async () => {
    const s = get();
    if (s.decisionPending || s.isRecalculating || s.activeSecurityZones.length >= MAX_HAZARDS_PER_TYPE ||
      useVoyageStore.getState().status !== 'underway') return;
    const route = currentRoute(s);
    if (!route) return;

    const remaining = remainingPolyline(route, route.metrics.distanceKm * s.progressFraction, s.shipPosition);
    const lookahead = pointAheadAlong(remaining, STORM_LOOKAHEAD_KM);
    const template = nearestTemplate(lookahead, SECURITY_ZONE_TEMPLATES);

    const zone: SecurityZone = {
      id: `${template.id}-${s.simTimeMs}`,
      name: template.name,
      scenarioType: template.scenarioType,
      level: template.level,
      center: lookahead, // anchored to the route, not the template's fixed location
      radiusKm: template.radiusKm,
      activeFromMs: s.simTimeMs,
      activeUntilMs: s.simTimeMs + HAZARD_DURATION_MS,
      description: template.description,
    };

    set({ activeSecurityZones: [...s.activeSecurityZones, zone] });
    logEvent(get, set, 'SECURITY_ALERT', 'CRITICAL', `${template.name} — ${template.description}`, lookahead);

    await recalcAndPropose(get, set, 'security', `Simulated security scenario — ${template.name}`, lookahead);
  },

  approveReroute: () => {
    const s = get();
    const pending = s.decisionPending;
    if (!pending) return;
    const route = currentRoute(s);
    if (!route) return;

    const plannedRoute = s.routeVersions[0].route;
    set({
      counterfactualLog: [
        ...s.counterfactualLog,
        buildLogEntry(pending, plannedRoute),
      ],
    });

    const newVersion: RouteVersion = {
      version: s.routeVersions.length + 1,
      route: pending.newRoute,
      createdAtMs: s.simTimeMs,
      reason: pending.triggeredBy === 'weather' ? 'Weather avoidance' : 'Security avoidance',
      originAtCreation: s.shipPosition,
    };

    const distanceTravelledKm = s.versionDistanceOffsetKm + route.metrics.distanceKm * s.progressFraction;
    const fuelUsedTonnes =
      s.versionFuelOffsetTonnes + (route.metrics.distanceKm * s.progressFraction / Math.max(1, route.metrics.distanceKm)) * route.metrics.fuelTonnes;

    const etaDeltaHr = round1((pending.newRoute.metrics.etaMs - pending.oldEtaMs) / 3_600_000);
    const fuelDeltaPct = round1(((pending.newRoute.metrics.fuelTonnes - pending.oldFuelTonnes) / Math.max(0.1, pending.oldFuelTonnes)) * 100);

    logEvent(
      get,
      set,
      'ROUTE_CHANGED',
      'SUCCESS',
      `Route version ${newVersion.version} activated (${newVersion.reason}).`,
      s.shipPosition,
      {
        impact: `Risk ${round1(pending.oldRisk)} -> ${pending.newRoute.metrics.risk.peak}, ETA ${etaDeltaHr >= 0 ? '+' : ''}${etaDeltaHr}h, Fuel ${fuelDeltaPct >= 0 ? '+' : ''}${fuelDeltaPct}%`,
        actionTaken: 'Operator approved recommended reroute.',
        beforeState: { risk: pending.oldRisk },
        afterState: { risk: pending.newRoute.metrics.risk.peak },
        routeVersion: newVersion.version,
      },
    );

    set({
      routeVersions: [...s.routeVersions, newVersion],
      activeVersionIndex: s.routeVersions.length,
      progressFraction: 0,
      versionDistanceOffsetKm: round1(distanceTravelledKm),
      versionFuelOffsetTonnes: round1(fuelUsedTonnes),
      nextRecordAtMs: s.simTimeMs,
      decisionPending: null,
    });
  },

  keepCurrentRoute: () => {
    const s = get();
    const pending = s.decisionPending;
    if (!pending) return;

    logEvent(
      get,
      set,
      'ROUTE_RECALCULATION',
      'ADVISORY',
      'Operator retained the current route despite the elevated-risk recommendation.',
      s.shipPosition,
      { actionTaken: 'Operator kept current route.' },
    );

    set({ decisionPending: null });
  },
}));

function pointAheadAlong(points: LatLon[], targetKm: number): LatLon {
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversineKm(points[i - 1], points[i]);
    if (acc + seg >= targetKm) {
      const f = (targetKm - acc) / (seg || 1);
      return greatCircleInterpolate(points[i - 1], points[i], Math.min(1, Math.max(0, f)));
    }
    acc += seg;
  }
  return points[points.length - 1];
}

function buildLogEntry(pending: DecisionPending, plannedRoute: Route): CounterfactualLogEntry {
  const plannedEta = plannedRoute.metrics.etaMs;
  const plannedFuel = plannedRoute.metrics.fuelTonnes;
  return {
    reason: pending.reason,
    riskWithReroute: pending.newRoute.metrics.risk.peak,
    riskWithoutReroute: pending.oldRisk,
    etaDeltaHrWithReroute: round1((pending.newRoute.metrics.etaMs - plannedEta) / 3_600_000),
    etaDeltaHrWithoutReroute: round1((pending.oldEtaMs - plannedEta) / 3_600_000),
    fuelDeltaPctWithReroute: round1(((pending.newRoute.metrics.fuelTonnes - plannedFuel) / Math.max(0.1, plannedFuel)) * 100),
    fuelDeltaPctWithoutReroute: round1(((pending.oldFuelTonnes - plannedFuel) / Math.max(0.1, plannedFuel)) * 100),
  };
}

async function recalcAndPropose(
  get: () => SimulationState,
  set: (partial: Partial<SimulationState>) => void,
  triggeredBy: 'weather' | 'security',
  reason: string,
  hazardLocation: LatLon,
) {
  const s = get();
  const route = currentRoute(s);
  if (!route) return;
  const voyage = useVoyageStore.getState();

  // Densify once and reuse the exact same geometry for both the "current
  // route" baseline and the reroute search below — evaluating them on
  // different point samplings (raw waypoints vs. a re-densified path) can
  // disagree on peak risk and make "Recommended" look worse than "Current",
  // which must never happen.
  const remaining = remainingPolyline(route, route.metrics.distanceKm * s.progressFraction, s.shipPosition);
  const baseDense = densifyPath(remaining, 90);

  const oldPathMetrics = evaluatePath(
    baseDense,
    voyage.vessel,
    s.simTimeMs,
    voyage.preferences,
    s.activeStorms,
    s.activeSecurityZones,
  ).metrics;

  const riskRoseSignificantly = oldPathMetrics.risk.peak > route.metrics.risk.peak + 8;
  const riskExceedsThreshold = oldPathMetrics.risk.peak > voyage.preferences.riskThreshold + 15;
  if (riskRoseSignificantly || riskExceedsThreshold) {
    logEvent(
      get,
      set,
      'RISK_THRESHOLD_EXCEEDED',
      'CRITICAL',
      riskExceedsThreshold ? 'Modeled peak risk exceeds the threshold with tolerance.' : 'Modeled peak risk rose on the current route.',
      hazardLocation,
      { beforeState: { risk: route.metrics.risk.peak }, afterState: { risk: oldPathMetrics.risk.peak } },
    );
  }

  set({ isRecalculating: true });
  logEvent(get, set, 'ROUTE_RECALCULATION', 'INFO', 'Recalculating route from current position...', s.shipPosition);

  // Search restarts from the vessel's current position, not the origin.
  // Route around every active hazard by construction — this guarantees the
  // recommended reroute clears the hazard that triggered it, rather than
  // relying on a soft heuristic to happen to find a way around. Try a
  // couple of clearance margins and keep whichever genuinely scores lower —
  // a wide detour can occasionally swing through another rough patch of the
  // (independent) weather field, so "cleared the named hazard" alone isn't
  // sufficient; the candidate also has to actually evaluate better.
  const candidateMargins = [55, 130, 240];
  const candidateDirections: Array<'short' | 'long'> = ['short', 'long'];
  let bestSim = { metrics: oldPathMetrics, waypoints: [] as Route['waypoints'] };
  const baselineEdges = new Map(baseDense.slice(1).map((point, i) => [baseDense[i], point]));
  const activeStorms = s.activeStorms.filter(storm => storm.activeUntilMs > s.simTimeMs);
  const activeZones = s.activeSecurityZones.filter(zone => zone.activeUntilMs > s.simTimeMs);
  for (const direction of candidateDirections) {
    for (const margin of candidateMargins) {
      let candidate = baseDense;
      for (const storm of activeStorms) {
        candidate = detourAroundCircle(candidate, activeStormCenterAt(storm, s.simTimeMs), storm.radiusKm, margin, direction === 'long' ? 18 : 9, direction);
      }
      for (const zone of activeZones) {
        candidate = detourAroundCircle(candidate, zone.center, zone.radiusKm, margin, direction === 'long' ? 18 : 9, direction);
      }
      // Keep existing corridor segments, including port approaches. Check newly
      // introduced detour segments against the same coarse exclusion boxes.
      if (candidate === baseDense || candidate.some((point, i) => {
        const prev = candidate[i - 1];
        return prev && baselineEdges.get(prev) !== point && segmentCrossesLand(prev, point);
      })) continue;
      const sim = evaluatePath(densifyPath(candidate, 90), voyage.vessel, s.simTimeMs, voyage.preferences, activeStorms, activeZones);
      if (sim.metrics.risk.peak < bestSim.metrics.risk.peak) {
        bestSim = sim;
      }
    }
  }
  if (!bestSim.waypoints.length) {
    set({ isRecalculating: false });
    logEvent(get, set, 'ROUTE_RECALCULATION', 'ADVISORY', 'No lower-risk detour found. The assigned route remains active.', s.shipPosition);
    return;
  }
  const newSim = bestSim;
  const recommended: Route = {
    id: `route-recommended-${s.simTimeMs}`,
    kind: 'recommended',
    label: 'Recommended',
    color: '#33cc7a',
    waypoints: newSim.waypoints,
    metrics: newSim.metrics,
    reasons: [
      { positive: true, label: 'Detour lowered modeled peak risk' },
      {
        positive: newSim.metrics.risk.peak < oldPathMetrics.risk.peak,
        label: `Modeled risk ${oldPathMetrics.risk.peak.toFixed(0)} -> ${newSim.metrics.risk.peak.toFixed(0)}`,
      },
    ],
  };

  set({
    isRecalculating: false,
    decisionPending: {
      reason,
      triggeredBy,
      oldRisk: oldPathMetrics.risk.peak,
      oldEtaMs: oldPathMetrics.etaMs,
      oldFuelTonnes: oldPathMetrics.fuelTonnes,
      newRoute: recommended,
      hazardLocation,
    },
  });
}

function completeVoyageInternal(get: () => SimulationState, set: (partial: Partial<SimulationState>) => void) {
  const s = get();
  if (s.report) return; // already completed
  const voyage = useVoyageStore.getState();
  const route = currentRoute(s);
  if (!route) return;

  const arrivalMs = route.metrics.etaMs;
  const actualDistanceKm = s.versionDistanceOffsetKm + route.metrics.distanceKm;
  const actualFuelTonnes = s.versionFuelOffsetTonnes + route.metrics.fuelTonnes;
  set({ isPlaying: false });

  logEvent(get, set, 'DESTINATION_REACHED', 'SUCCESS', `Arrived at ${voyage.destination.name}.`, {
    lat: voyage.destination.lat,
    lon: voyage.destination.lon,
  });

  const voyageObj = {
    id: voyage.voyageId,
    plan: {
      vessel: voyage.vessel,
      origin: voyage.origin,
      destination: voyage.destination,
      departureMs: voyage.departureMs,
      preferences: voyage.preferences,
    },
    status: 'complete' as const,
    routeVersions: get().routeVersions,
    events: get().events,
    telemetryHistory: get().telemetryHistory,
    createdAtMs: voyage.departureMs,
  };

  generateVoyageReport({
    voyage: voyageObj,
    arrivalMs,
    actualDistanceKm,
    actualFuelTonnes,
    counterfactualLog: get().counterfactualLog,
    telemetryHistory: get().telemetryHistory,
    events: get().events,
    routeVersions: get().routeVersions,
  }).then((report) => {
    if (useVoyageStore.getState().voyageId !== voyage.voyageId) return;
    set({ report, isPlaying: false });
    useHistoryStore.getState().addReport(report);
    useVoyageStore.setState({ status: 'complete' });
  });
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
