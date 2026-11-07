/**
 * The seam between the Captain bridge and the operations-center stores.
 *
 * The bridge was authored against its own store pair (`useMarlinStore` +
 * `state/store`) and its own domain shapes (minute-based clock, 0-100 route
 * scores, GeoPosition waypoints). marlin-frontend runs the real routing engine
 * on epoch-millisecond time, kilometres, and a risk breakdown.
 *
 * Rather than fork the data model, everything the bridge needs is derived here
 * from the existing voyage/simulation stores. There is exactly one source of
 * truth — the Control Room and the Bridge are two views of the same voyage, so
 * approving a reroute in either is immediately visible in the other.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVoyageStore } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Route as EngineRoute } from '@/types';
import type { Route as BridgeRoute, RouteKind as BridgeRouteKind } from './bridgeTypes';
import { MISSION_END_MINUTE, MISSION_START_MINUTE } from './bridgeScenario';

/**
 * The bridge's clock is a 0-360 "mission minute"; the engine's is epoch ms
 * between departure and ETA. The bridge displays this as voyage progress.
 */
export function useMissionClock() {
  const departureMs = useVoyageStore((s) => s.departureMs);
  const simTimeMs = useSimulationStore((s) => s.simTimeMs);
  const routeVersions = useSimulationStore((s) => s.routeVersions);

  const endMs = routeVersions.at(-1)?.route.metrics.etaMs ?? departureMs + 3_600_000;
  const span = Math.max(1, endMs - departureMs);
  const minute = Math.round(
    MISSION_START_MINUTE +
      ((Math.min(endMs, Math.max(departureMs, simTimeMs)) - departureMs) / span) *
        (MISSION_END_MINUTE - MISSION_START_MINUTE),
  );

  return { minute, departureMs, endMs, span };
}

function bridgeKind(kind: EngineRoute['kind']): BridgeRouteKind {
  if (kind === 'fastest') return 'fastest';
  if (kind === 'high-risk') return 'trade-off';
  return 'recommended';
}

/**
 * Project an engine Route onto the bridge's Route shape: km -> NM, the risk
 * breakdown flattened to the 0-100 scores the bridge panels render, and
 * waypoint ETAs expressed as mission minutes.
 *
 * Waypoint ETAs are derived from distance-along-route rather than the engine's
 * absolute `etaMs`, so a reroute mid-voyage (whose waypoints carry later
 * timestamps) still lays out across the same 0-360 mission scale.
 */
export function toBridgeRoute(
  route: EngineRoute,
  vesselId: string,
  clock?: { departureMs: number; span: number },
): BridgeRoute {
  const KM_PER_NM = 1.852;
  const totalKm = Math.max(1, route.metrics.distanceKm);
  const missionSpan = MISSION_END_MINUTE - MISSION_START_MINUTE;

  // Arrival on the mission scale. A proposed reroute arrives later than the
  // plan, so it must not be pinned to the end of the scale — otherwise every
  // route reads the same ETA and the trade-off the card is asking the captain
  // to weigh is invisible.
  const etaMinutes = clock
    ? Math.round(((route.metrics.etaMs - clock.departureMs) / Math.max(1, clock.span)) * missionSpan)
    : MISSION_END_MINUTE;

  return {
    id: route.id,
    vesselId,
    kind: bridgeKind(route.kind),
    waypoints: route.waypoints.map((w, index) => ({
      id: `${route.id}-wp-${index}`,
      name:
        index === 0
          ? 'Departure'
          : index === route.waypoints.length - 1
            ? 'Destination'
            : `WP ${String(index).padStart(2, '0')}`,
      position: { latitude: w.lat, longitude: w.lon },
      etaMinutes: clock
        ? Math.round(((w.etaMs - clock.departureMs) / clock.span) * missionSpan)
        : Math.round((w.distanceFromStartKm / totalKm) * missionSpan),
    })),
    distanceNm: Math.round(route.metrics.distanceKm / KM_PER_NM),
    etaMinutes,
    // Absolute tonnes, not a percentage: a real corridor burns well over the
    // few hundred tonnes that any fixed percentage scale would saturate at.
    fuelEstimate: Math.round(route.metrics.fuelTonnes),
    riskScore: Math.round(route.metrics.risk.total),
    weatherExposure: Math.round(route.metrics.weatherExposure),
    trafficExposure: Math.round(
      (route.metrics.weatherExposure + route.metrics.securityExposure) / 2,
    ),
    restrictionExposure: Math.round(route.metrics.securityExposure),
    recommendationReason: route.reasons[0]?.label ?? route.label,
    reasons: route.reasons.map((r) => r.label),
  };
}

/**
 * Everything the bridge screens read, derived from the live voyage. Selectors
 * are shallow-compared so the WebGL scene is not remounted every tick.
 */
export function useBridgeState() {
  const voyage = useVoyageStore(
    useShallow((s) => ({
      vessel: s.vessel,
      origin: s.origin,
      destination: s.destination,
      status: s.status,
    })),
  );

  const sim = useSimulationStore(
    useShallow((s) => ({
      routeVersions: s.routeVersions,
      activeVersionIndex: s.activeVersionIndex,
      decisionPending: s.decisionPending,
      isPlaying: s.isPlaying,
      speedMultiplier: s.speedMultiplier,
      shipPosition: s.shipPosition,
      shipHeadingDeg: s.shipHeadingDeg,
      shipSpeedKn: s.shipSpeedKn,
      progressFraction: s.progressFraction,
      events: s.events,
      activeStorms: s.activeStorms,
      activeSecurityZones: s.activeSecurityZones,
    })),
  );

  const { minute, departureMs, span } = useMissionClock();

  const active = voyage.status === 'underway' || voyage.status === 'complete';
  const activeEngineRoute = active ? sim.routeVersions[sim.activeVersionIndex]?.route ?? null : null;
  const proposedEngineRoute = active ? sim.decisionPending?.newRoute ?? null : null;

  const activeRoute = useMemo(
    () =>
      activeEngineRoute
        ? toBridgeRoute(activeEngineRoute, voyage.vessel.id, { departureMs, span })
        : null,
    [activeEngineRoute, voyage.vessel.id, departureMs, span],
  );

  const alternateRoute = useMemo(
    () =>
      proposedEngineRoute
        ? toBridgeRoute(proposedEngineRoute, voyage.vessel.id, { departureMs, span })
        : null,
    [proposedEngineRoute, voyage.vessel.id, departureMs, span],
  );

  return {
    ...voyage,
    ...sim,
    minute,
    departureMs,
    span,
    activeEngineRoute,
    activeRoute,
    alternateRoute,
    hasVoyage: activeEngineRoute !== null,
  };
}

/**
 * Voyage events surfaced as bridge alerts. The engine already grades severity,
 * so this is a rename rather than a re-classification.
 *
 * `acknowledged` comes from the shared simulation store rather than local panel
 * state, so an alert the Captain clears is cleared for the Control Room too.
 */
export function useBridgeAlerts() {
  const events = useSimulationStore((s) => s.events);
  const acknowledgedEventIds = useSimulationStore((s) => s.acknowledgedEventIds);
  const { departureMs, span } = useMissionClock();

  return useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        severity: e.severity === 'SUCCESS' ? ('INFO' as const) : e.severity,
        title: e.type.replace(/_/g, ' '),
        description: e.description,
        raisedAtMinute: Math.round(
          ((e.timestampMs - departureMs) / Math.max(1, span)) *
            (MISSION_END_MINUTE - MISSION_START_MINUTE),
        ),
        impact: e.impact,
        actionTaken: e.actionTaken,
        acknowledged: acknowledgedEventIds.includes(e.id),
      })),
    [events, acknowledgedEventIds, departureMs, span],
  );
}

/**
 * The shared Control Room <-> Bridge conversation, projected onto the bridge's
 * mission-minute scale. Both interfaces append through
 * `useSimulationStore.sendMessage`, so there is one conversation record.
 */
export function useBridgeMessages() {
  const messages = useSimulationStore((s) => s.messages);
  const { departureMs, span } = useMissionClock();

  return useMemo(
    () =>
      messages.map((m) => ({
        ...m,
        sentAtMinute: Math.round(
          ((m.sentAtMs - departureMs) / Math.max(1, span)) *
            (MISSION_END_MINUTE - MISSION_START_MINUTE),
        ),
      })),
    [messages, departureMs, span],
  );
}
