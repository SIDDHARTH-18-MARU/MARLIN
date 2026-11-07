import type {
  CounterfactualResult,
  RouteVersion,
  TelemetrySample,
  Voyage,
  VoyageEvent,
  VoyageReport,
} from '@/types';

export interface CounterfactualLogEntry {
  reason: string;
  riskWithReroute: number;
  riskWithoutReroute: number;
  etaDeltaHrWithReroute: number;
  etaDeltaHrWithoutReroute: number;
  fuelDeltaPctWithReroute: number;
  fuelDeltaPctWithoutReroute: number;
}

function buildCounterfactual(log: CounterfactualLogEntry[]): CounterfactualResult {
  if (log.length === 0) {
    return {
      adoptedDetours: 0,
      actual: { risk: 0, etaDeltaHr: 0, fuelDeltaPct: 0 },
      noReroute: { risk: 0, etaDeltaHr: 0, fuelDeltaPct: 0 },
      narrative:
        'No detour was adopted during this voyage. There are no approved route changes to compare.',
    };
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const actual = {
    risk: round1(avg(log.map((l) => l.riskWithReroute))),
    etaDeltaHr: round1(avg(log.map((l) => l.etaDeltaHrWithReroute))),
    fuelDeltaPct: round1(avg(log.map((l) => l.fuelDeltaPctWithReroute))),
  };
  const noReroute = {
    risk: round1(avg(log.map((l) => l.riskWithoutReroute))),
    etaDeltaHr: round1(avg(log.map((l) => l.etaDeltaHrWithoutReroute))),
    fuelDeltaPct: round1(avg(log.map((l) => l.fuelDeltaPctWithoutReroute))),
  };

  const narrative =
    actual.risk < noReroute.risk
      ? `SIMULATED COUNTERFACTUAL: adaptive routing accepted roughly ${Math.max(0, round1(actual.etaDeltaHr - noReroute.etaDeltaHr))}h of additional travel time to reduce modeled risk from ${noReroute.risk} to ${actual.risk}.`
      : `SIMULATED COUNTERFACTUAL: modeled outcomes were similar whether or not the recommended reroutes were adopted for this voyage.`;

  return { adoptedDetours: log.length, actual, noReroute, narrative };
}

export interface BuildReportParams {
  voyage: Voyage;
  arrivalMs: number;
  actualDistanceKm: number;
  actualFuelTonnes: number;
  counterfactualLog: CounterfactualLogEntry[];
  telemetryHistory: TelemetrySample[];
  events: VoyageEvent[];
  routeVersions: RouteVersion[];
}

// Future backend seam: GET /api/v1/voyages/{id}/report
export async function generateVoyageReport(params: BuildReportParams): Promise<VoyageReport> {
  const { voyage, arrivalMs, actualDistanceKm, actualFuelTonnes, counterfactualLog, telemetryHistory, events, routeVersions } =
    params;

  const plannedRoute = routeVersions[0]?.route;
  const risks = telemetryHistory.map((t) => t.risk);
  const maxRisk = risks.length ? Math.max(...risks) : 0;
  const averageRisk = risks.length ? round1(risks.reduce((a, b) => a + b, 0) / risks.length) : 0;
  const finalRisk = risks.length ? risks[risks.length - 1] : 0;

  const weatherEvents = events.filter((e) => e.type === 'STORM_DETECTED' || e.type === 'WEATHER_CHANGE').length;
  const securityEvents = events.filter((e) => e.type === 'SECURITY_ALERT').length;

  const riskReductionFromRerouting = counterfactualLog.length
    ? round1(
        counterfactualLog.reduce((sum, l) => sum + (l.riskWithoutReroute - l.riskWithReroute), 0) /
          counterfactualLog.length,
      )
    : 0;

  const majorDeviations = routeVersions
    .slice(1)
    .map((v) => `Route v${v.version}: ${v.reason} (distance ${round1(v.route.metrics.distanceKm)} km, risk ${v.route.metrics.risk.total})`);

  return {
    voyageId: voyage.id,
    vessel: voyage.plan.vessel,
    origin: voyage.plan.origin,
    destination: voyage.plan.destination,
    departureMs: voyage.plan.departureMs,
    arrivalMs,
    durationHr: round1((arrivalMs - voyage.plan.departureMs) / 3_600_000),
    plannedVsActual: {
      plannedDistanceKm: plannedRoute?.metrics.distanceKm ?? 0,
      actualDistanceKm: round1(actualDistanceKm),
      plannedEtaMs: plannedRoute?.metrics.etaMs ?? arrivalMs,
      actualEtaMs: arrivalMs,
      plannedFuelTonnes: plannedRoute?.metrics.fuelTonnes ?? 0,
      actualFuelTonnes: round1(actualFuelTonnes),
      plannedRouteChanges: 0,
      actualRouteChanges: routeVersions.length - 1,
    },
    routeChanges: routeVersions.length - 1,
    maxRisk,
    averageRisk,
    finalRisk,
    weatherEvents,
    securityEvents,
    riskReductionFromRerouting,
    majorDeviations,
    counterfactual: buildCounterfactual(counterfactualLog),
    routeVersions,
    events,
    telemetryHistory,
  };
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
