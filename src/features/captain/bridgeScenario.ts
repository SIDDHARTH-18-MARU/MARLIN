/**
 * Deterministic mock data — master prompt, MOCK DATA section.
 *
 * No Math.random() anywhere. Every value is either a constant or a pure
 * function of simulation minute, so scrubbing time back and forth always
 * reproduces the same world and the demo cannot flicker.
 */

import type {
  Alert,
  Communication,
  EnvironmentState,
  Route,
  TrafficContact,
  Vessel,
  Waypoint,
} from "./bridgeTypes";

/** Mission window: 08:00 → 14:00, expressed as minutes from start. */
export const MISSION_START_MINUTE = 0;
export const MISSION_END_MINUTE = 360;

/** The simulation minute at which the weather event fires — Document 10. */
export const EVENT_MINUTE = 138;

export const OWN_VESSEL_ID = "v-07";

/** Great-circle-ish interpolation is unnecessary at this scale; linear is fine. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function makeWaypoints(
  prefix: string,
  coords: Array<[number, number, string]>,
  totalMinutes: number,
): Waypoint[] {
  const last = coords.length - 1;
  return coords.map(([longitude, latitude, name], i) => ({
    id: `${prefix}-wp-${i}`,
    name,
    position: { latitude, longitude },
    etaMinutes: Math.round((i / last) * totalMinutes),
  }));
}

/**
 * Route A — the originally assigned coastal track. Fast, but it runs straight
 * through the sea area where the storm cell develops at EVENT_MINUTE.
 */
export const ROUTE_A: Route = {
  id: "r-a",
  vesselId: OWN_VESSEL_ID,
  kind: "fastest",
  waypoints: makeWaypoints(
    "r-a",
    [
      [72.83, 18.94, "Mumbai Roads"],
      [72.35, 17.9, "Ratnagiri Offshore"],
      [72.05, 16.6, "Malvan Deep"],
      [73.6, 15.42, "Mormugao Approach"],
    ],
    276,
  ),
  distanceNm: 184,
  etaMinutes: 276,
  fuelEstimate: 41,
  riskScore: 72,
  weatherExposure: 78,
  trafficExposure: 54,
  restrictionExposure: 20,
  recommendationReason: "SHORTEST TRANSIT TIME",
  reasons: [
    "Shortest distance at 184 NM",
    "Earliest arrival under calm conditions",
    "Higher exposure to developing weather",
  ],
};

/**
 * Route B — the safer seaward diversion. Longer and slower, but it clears the
 * storm cell and the traffic separation scheme. Becomes the recommendation
 * once conditions deteriorate.
 */
export const ROUTE_B: Route = {
  id: "r-b",
  vesselId: OWN_VESSEL_ID,
  kind: "safest",
  waypoints: makeWaypoints(
    "r-b",
    [
      [72.83, 18.94, "Mumbai Roads"],
      [72.1, 17.95, "Western Standoff"],
      [71.6, 16.7, "Deep Water Transit"],
      [72.4, 15.75, "Southern Approach"],
      [73.6, 15.42, "Mormugao Approach"],
    ],
    294,
  ),
  distanceNm: 201,
  etaMinutes: 294,
  fuelEstimate: 44,
  riskScore: 24,
  weatherExposure: 21,
  trafficExposure: 22,
  restrictionExposure: 0,
  recommendationReason: "LOWER OVERALL OPERATIONAL RISK",
  reasons: [
    "32% lower collision exposure",
    "Avoids restricted maritime zone",
    "Lower wave exposure",
    "Favourable current",
    "Acceptable ETA (+18 min)",
  ],
};

export const ROUTES: Route[] = [ROUTE_A, ROUTE_B];

export function routeById(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}

/**
 * Position along a route at a given simulation minute, by walking the waypoint
 * legs. Pure function of minute — the core of determinism.
 */
export function positionAlongRoute(route: Route, minute: number) {
  const wps = route.waypoints;
  const t = clamp01(minute / route.etaMinutes);
  const travelled = t * route.etaMinutes;

  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    if (travelled <= b.etaMinutes || i === wps.length - 2) {
      const span = b.etaMinutes - a.etaMinutes || 1;
      const legT = clamp01((travelled - a.etaMinutes) / span);
      const latitude = lerp(a.position.latitude, b.position.latitude, legT);
      const longitude = lerp(a.position.longitude, b.position.longitude, legT);
      const heading = bearing(
        a.position.latitude,
        a.position.longitude,
        b.position.latitude,
        b.position.longitude,
      );
      return { latitude, longitude, heading, legIndex: i, legT };
    }
  }

  const last = wps[wps.length - 1];
  return {
    latitude: last.position.latitude,
    longitude: last.position.longitude,
    heading: 180,
    legIndex: wps.length - 1,
    legT: 1,
  };
}

/** Initial bearing from one lat/long to another, in degrees. */
export function bearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Next waypoint the vessel has not yet reached. */
export function nextWaypoint(route: Route, minute: number): Waypoint {
  return (
    route.waypoints.find((w) => w.etaMinutes > minute) ??
    route.waypoints[route.waypoints.length - 1]
  );
}

export const OWN_VESSEL: Vessel = {
  id: OWN_VESSEL_ID,
  name: "MV Sagar Setu",
  type: "cargo",
  position: { latitude: 18.94, longitude: 72.83 },
  heading: 197,
  speed: 18.4,
  destination: "Mormugao",
  fuel: 64,
  riskScore: 22,
  routeId: ROUTE_A.id,
  status: "underway",
};

/**
 * Speed varies mildly with sea state so the instruments are not static, but
 * deterministically — a smooth function of minute, not a random walk.
 */
export function speedAtMinute(minute: number): number {
  const base = 18.4;
  const swell = Math.sin(minute / 47) * 0.6;
  const stormDrag = minute >= EVENT_MINUTE ? -1.7 : 0;
  return Math.round((base + swell + stormDrag) * 10) / 10;
}

export function depthAtMinute(minute: number): number {
  return Math.round(48 + Math.sin(minute / 31) * 12 + minute * 0.06);
}

/**
 * Environment degrades as the storm develops — Document 10's timeline made
 * continuous, so the captain's environment screen visibly worsens.
 */
export function environmentAtMinute(minute: number): EnvironmentState {
  const ramp = clamp01((minute - (EVENT_MINUTE - 30)) / 45);
  return {
    seaTemperatureC: Math.round((28.4 - ramp * 1.2) * 10) / 10,
    waveHeightM: Math.round((1.4 + ramp * 2.6) * 10) / 10,
    windSpeedKn: Math.round(11 + ramp * 21),
    windDirection: ramp > 0.4 ? "WSW" : "NE",
    visibilityKm: Math.round((9.6 - ramp * 6.4) * 10) / 10,
    cloudCoverPct: Math.round(28 + ramp * 61),
    currentSpeedKn: Math.round((1.1 + ramp * 0.8) * 10) / 10,
    currentDirection: "S",
    summary:
      ramp > 0.65
        ? "Deteriorating — storm cell active on original track"
        : ramp > 0.15
          ? "Worsening — wave height and wind rising"
          : "Settled — light swell, good visibility",
  };
}

/** Nearby traffic. Ranges close and open again as own vessel transits. */
export function trafficAtMinute(minute: number): TrafficContact[] {
  const base: Array<[string, string, TrafficContact["type"], number, number]> = [
    ["t-1", "MV Kandla Star", "cargo", 6.2, 2.4],
    ["t-2", "Coastal Pride", "passenger", 9.8, 5.1],
    ["t-3", "Fishing Fleet Alpha", "civilian", 3.4, 0.9],
    ["t-4", "MT Gulf Horizon", "cargo", 12.6, 8.3],
  ];
  const crowding = minute >= EVENT_MINUTE ? 0.55 : 1;
  return base.map(([id, name, type, rangeNm, cpaNm], i) => {
    const drift = Math.sin((minute + i * 37) / 40) * 1.8;
    const range = Math.max(0.6, Math.round((rangeNm + drift) * crowding * 10) / 10);
    return {
      id,
      name,
      type,
      position: {
        latitude: 17.6 - i * 0.35 + Math.sin(minute / 55 + i) * 0.12,
        longitude: 72.4 + i * 0.28 + Math.cos(minute / 61 + i) * 0.12,
      },
      heading: Math.round((40 + i * 63 + minute * 0.05) % 360),
      speed: Math.round((9 + i * 2.3) * 10) / 10,
      rangeNm: range,
      cpaNm: Math.max(0.3, Math.round((cpaNm * crowding + drift * 0.3) * 10) / 10),
    };
  });
}

/** Alerts fire at fixed minutes, mirroring the Document 10 timeline. */
export const SCRIPTED_ALERTS: Alert[] = [
  {
    id: "a-1",
    severity: "INFO",
    category: "SYSTEM",
    title: "ROUTE ASSIGNED",
    description: "Control room assigned the recommended Mumbai–Singapore route.",
    vesselId: OWN_VESSEL_ID,
    raisedAtMinute: 2,
    acknowledged: true,
  },
  {
    id: "a-2",
    severity: "ADVISORY",
    category: "TRAFFIC",
    title: "TRAFFIC DENSITY",
    description: "Elevated fishing activity reported 12 NM ahead on present track.",
    vesselId: OWN_VESSEL_ID,
    raisedAtMinute: 74,
    exposure: "MEDIUM",
    recommendedAction: "Maintain lookout; reduce speed if visibility drops.",
    acknowledged: false,
  },
  {
    id: "a-3",
    severity: "WARNING",
    category: "WEATHER",
    title: "WEATHER WARNING",
    description: "Storm cell detected 23 NM ahead. Wave height rising.",
    vesselId: OWN_VESSEL_ID,
    raisedAtMinute: EVENT_MINUTE,
    exposure: "HIGH",
    recommendedAction: "Review alternate route.",
    acknowledged: false,
  },
  {
    id: "a-4",
    severity: "CRITICAL",
    category: "ROUTE_DEVIATION",
    title: "ROUTE RISK CRITICAL",
    description:
      "The active route is now HIGH RISK. Continued transit is not recommended.",
    vesselId: OWN_VESSEL_ID,
    raisedAtMinute: EVENT_MINUTE + 6,
    exposure: "HIGH",
    recommendedAction: "Review and acknowledge the Control Room diversion.",
    acknowledged: false,
  },
];

export function alertsAtMinute(minute: number): Alert[] {
  return SCRIPTED_ALERTS.filter((a) => a.raisedAtMinute <= minute).sort(
    (a, b) => b.raisedAtMinute - a.raisedAtMinute,
  );
}

/** Control-room ↔ captain traffic — Documents 18, 19. */
export const SCRIPTED_COMMS: Communication[] = [
  {
    id: "c-1",
    direction: "control-to-captain",
    kind: "MISSION_UPDATE",
    body: "Voyage VOY-001 active. Proceed Mumbai to Singapore on the assigned route.",
    sentAtMinute: 2,
  },
  {
    id: "c-2",
    direction: "captain-to-control",
    kind: "ACKNOWLEDGEMENT",
    body: "Voyage received. Underway on assigned route.",
    sentAtMinute: 5,
  },
  {
    id: "c-3",
    direction: "control-to-captain",
    kind: "MESSAGE",
    body: "Advisory: fishing fleet reported on your track. Maintain lookout.",
    sentAtMinute: 75,
  },
  {
    id: "c-4",
    direction: "control-to-captain",
    kind: "ROUTE_UPDATE",
    body: "Recommended route update due to severe weather.",
    sentAtMinute: EVENT_MINUTE + 8,
    proposedRouteId: ROUTE_B.id,
    reason: "Severe weather detected",
    etaDeltaMinutes: 18,
    risk: "LOW",
  },
];

export function commsAtMinute(minute: number): Communication[] {
  return SCRIPTED_COMMS.filter((c) => c.sentAtMinute <= minute);
}

/** The pending route-update proposal, if one is live and unacknowledged. */
export function pendingRouteUpdate(minute: number): Communication | undefined {
  return SCRIPTED_COMMS.find(
    (c) => c.kind === "ROUTE_UPDATE" && c.sentAtMinute <= minute,
  );
}
