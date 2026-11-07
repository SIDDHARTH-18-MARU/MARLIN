/**
 * Shared data contracts — Document 23.
 *
 * FROZEN CONTRACT. These types are imported by both the captain interface
 * (this branch) and the control-room interface (other branches). Changing a
 * field here breaks every consumer simultaneously, so changes must be agreed
 * across the team rather than made unilaterally.
 */

export type VesselType =
  | "patrol"
  | "cargo"
  | "passenger"
  | "naval"
  | "emergency"
  | "civilian";

export type VesselStatus =
  | "docked"
  | "underway"
  | "warning"
  | "emergency"
  | "offline";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface Vessel {
  id: string;
  name: string;
  type: VesselType;
  position: GeoPosition;
  /** Degrees, 0–359, clockwise from true north. */
  heading: number;
  /** Knots. */
  speed: number;
  destination?: string;
  eta?: string;
  /** Percentage remaining, 0–100. */
  fuel?: number;
  /** 0–100. Higher is riskier. */
  riskScore?: number;
  routeId?: string;
  status: VesselStatus;
}

export interface Waypoint {
  id: string;
  name: string;
  position: GeoPosition;
  /** Minutes from route start at which this waypoint is reached. */
  etaMinutes: number;
}

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

/** Which objective this route optimises for — Document 08. */
export type RouteKind = "fastest" | "safest" | "efficient" | "recommended" | "trade-off";

export interface Route {
  id: string;
  vesselId: string;
  kind: RouteKind;
  waypoints: Waypoint[];
  distanceNm: number;
  etaMinutes: number;
  /** Percentage of capacity consumed, 0–100. */
  fuelEstimate: number;
  /** 0–100. Higher is riskier. */
  riskScore: number;
  /** Exposure metrics, each 0–100. Drive the "Why This Route?" panel. */
  weatherExposure: number;
  trafficExposure: number;
  restrictionExposure: number;
  recommendationReason: string;
  /** Bullet justifications shown in the explainability panel — Document 09. */
  reasons: string[];
}

export type AlertSeverity = "INFO" | "ADVISORY" | "WARNING" | "CRITICAL";

export type AlertCategory =
  | "WEATHER"
  | "TRAFFIC"
  | "COLLISION"
  | "RESTRICTED_ZONE"
  | "ROUTE_DEVIATION"
  | "EMERGENCY"
  | "SYSTEM";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  /** Which vessel this concerns. Undefined means fleet-wide. */
  vesselId?: string;
  /** Simulation minutes-from-start at which the alert fired. */
  raisedAtMinute: number;
  /** How exposed the current route is, where applicable. */
  exposure?: RiskBand;
  recommendedAction?: string;
  acknowledged: boolean;
}

export type CommunicationDirection = "control-to-captain" | "captain-to-control";

export type CommunicationKind =
  | "ROUTE_UPDATE"
  | "MESSAGE"
  | "ACKNOWLEDGEMENT"
  | "MISSION_UPDATE";

export interface Communication {
  id: string;
  direction: CommunicationDirection;
  kind: CommunicationKind;
  body: string;
  sentAtMinute: number;
  /** Set on ROUTE_UPDATE messages — the route being proposed. */
  proposedRouteId?: string;
  /** Human-readable justification, e.g. "Severe weather detected". */
  reason?: string;
  /** Signed minutes; positive means the new route is slower. */
  etaDeltaMinutes?: number;
  risk?: RiskBand;
}

/** Local conditions around a vessel — Document 18. */
export interface EnvironmentState {
  /** Sea surface temperature, °C. */
  seaTemperatureC: number;
  /** Significant wave height, metres. */
  waveHeightM: number;
  windSpeedKn: number;
  /** Compass point, e.g. "NE". */
  windDirection: string;
  visibilityKm: number;
  cloudCoverPct: number;
  currentSpeedKn: number;
  currentDirection: string;
  /** Free-text summary, e.g. "Deteriorating — storm cell approaching". */
  summary: string;
}

/** Another vessel in the captain's vicinity — Document 18. */
export interface TrafficContact {
  id: string;
  name: string;
  type: VesselType;
  position: GeoPosition;
  heading: number;
  speed: number;
  /** Range from own vessel, nautical miles. */
  rangeNm: number;
  /** Closest point of approach, nautical miles. */
  cpaNm: number;
}

export type ScenarioId =
  | "NORMAL"
  | "HEAVY_TRAFFIC"
  | "SEVERE_WEATHER"
  | "RESTRICTED_ZONE"
  | "EMERGENCY"
  | "DYNAMIC_EVENT"
  | "CONFLICT";

export interface SimulationState {
  /** Minutes elapsed from the mission window start. */
  currentMinute: number;
  startMinute: number;
  endMinute: number;
  running: boolean;
  /** Playback multiplier, e.g. 1, 2, 8. */
  speedMultiplier: number;
  scenario: ScenarioId;
}

export function riskBand(score: number): RiskBand {
  if (score < 34) return "LOW";
  if (score < 67) return "MEDIUM";
  return "HIGH";
}

/** Format simulation minutes as a wall clock, with the window starting 08:00. */
export function formatSimClock(minute: number): string {
  const total = 8 * 60 + Math.floor(minute);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
