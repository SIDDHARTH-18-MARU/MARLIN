// ---------------------------------------------------------------------------
// MARLIN core data contracts.
//
// These types describe the shape of data the mock engine/services produce
// today, and are the contract a real FastAPI backend would fill in later
// (see services/*.ts — every function here is the seam where a fetch() call
// would replace the local computation).
// ---------------------------------------------------------------------------

export type VesselType =
  | 'container'
  | 'tanker'
  | 'bulk-carrier'
  | 'passenger'
  | 'general-cargo';

export interface VesselProfile {
  id: string;
  type: VesselType;
  name: string;
  length_m: number;
  beam_m: number;
  draft_m: number;
  cruisingSpeedKn: number;
  maxSpeedKn: number;
  baseFuelRateTPerHr: number; // tonnes/hr at cruising speed, calm seas
  waveSensitivity: number; // 0-1, higher = more slowed/penalised by waves
  windSensitivity: number; // 0-1
  currentSensitivity: number; // 0-1, higher = more affected (pushed) by current
  fuelEfficiencyLabel: 'High efficiency' | 'Standard' | 'Fuel intensive';
}

export interface Port {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RoutingPreferences {
  safety: number; // 0-100
  fuel: number; // 0-100
  time: number; // 0-100
  riskThreshold: number; // 0-100, hard-ish ceiling used for feasibility flag
}

export type RoutePreset = 'balanced' | 'safety-first' | 'fuel-efficient' | 'fastest';

export type RouteKind = 'recommended' | 'fastest' | 'high-risk';

export interface RouteWaypoint extends LatLon {
  distanceFromStartKm: number;
  cumulativeTimeHr: number;
  etaMs: number;
  effectiveSpeedKn: number;
  riskAtPoint: number;
}

export interface RouteRiskBreakdown {
  weather: number;
  wave: number;
  current: number;
  security: number;
  total: number; // weighted 0-100, blends average + peak exposure along the route
  peak: number; // single worst-point risk encountered along the route
}

export interface ForecastConfidence {
  h0_24: number;
  h24_48: number;
  h48_72: number;
  h72plus: number;
}

export interface RouteMetrics {
  distanceKm: number;
  durationHr: number;
  etaMs: number;
  fuelTonnes: number;
  risk: RouteRiskBreakdown;
  securityExposure: number; // 0-100
  weatherExposure: number; // 0-100
  forecastConfidence: ForecastConfidence;
  withinRiskThreshold: boolean;
}

export interface RouteReasonCode {
  positive: boolean;
  label: string;
}

export interface Route {
  id: string;
  kind: RouteKind;
  label: string;
  color: string;
  waypoints: RouteWaypoint[];
  metrics: RouteMetrics;
  reasons: RouteReasonCode[];
}

export interface RouteVersion {
  version: number;
  route: Route;
  createdAtMs: number; // simulation time at which this version became active
  reason: string; // e.g. "Initial plan", "Weather avoidance", "Security avoidance"
  originAtCreation: LatLon;
}

// --- Environment -----------------------------------------------------------

export interface EnvironmentSample {
  lat: number;
  lon: number;
  timeMs: number;
  windSpeedKn: number;
  windDirDeg: number;
  waveHeightM: number;
  waveDirDeg: number;
  wavePeriodS: number;
  currentSpeedKn: number;
  currentDirDeg: number;
  stormIntensity: number; // 0-1
  weatherRisk: number; // 0-100
}

export type SecurityLevel = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface SecurityZone {
  id: string;
  name: string;
  scenarioType: string;
  level: SecurityLevel;
  center: LatLon;
  radiusKm: number;
  activeFromMs: number;
  activeUntilMs: number;
  description: string;
}

export interface StormCell {
  id: string;
  center: LatLon;
  radiusKm: number;
  intensity: number; // 0-1
  headingDeg: number;
  speedKn: number;
  activeFromMs: number;
  activeUntilMs: number;
}

// --- Voyage lifecycle --------------------------------------------------------

export type VoyageStatus =
  | 'planning'
  | 'routes-ready'
  | 'underway'
  | 'paused'
  | 'complete';

export type VoyageEventType =
  | 'VOYAGE_STARTED'
  | 'WEATHER_CHANGE'
  | 'STORM_DETECTED'
  | 'SECURITY_ALERT'
  | 'RISK_THRESHOLD_EXCEEDED'
  | 'ROUTE_RECALCULATION'
  | 'ROUTE_CHANGED'
  | 'ETA_CHANGED'
  | 'FUEL_ESTIMATE_CHANGED'
  | 'DESTINATION_REACHED';

export type EventSeverity = 'INFO' | 'ADVISORY' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export interface VoyageEvent {
  id: string;
  voyageId: string;
  timestampMs: number;
  location: LatLon;
  type: VoyageEventType;
  severity: EventSeverity;
  description: string;
  impact?: string;
  actionTaken?: string;
  beforeState?: Record<string, number>;
  afterState?: Record<string, number>;
  routeVersion?: number;
}

export interface TelemetrySample {
  timestampMs: number;
  position: LatLon;
  headingDeg: number;
  speedKn: number;
  distanceTravelledKm: number;
  distanceRemainingKm: number;
  fuelUsedTonnes: number;
  eta: number;
  risk: number;
  riskBreakdown: RouteRiskBreakdown;
  securityExposure: number;
  routeVersion: number;
}

export interface VoyagePlan {
  vessel: VesselProfile;
  origin: Port;
  destination: Port;
  departureMs: number;
  preferences: RoutingPreferences;
}

export interface PlannedVsActual {
  plannedDistanceKm: number;
  actualDistanceKm: number;
  plannedEtaMs: number;
  actualEtaMs: number;
  plannedFuelTonnes: number;
  actualFuelTonnes: number;
  plannedRouteChanges: number;
  actualRouteChanges: number;
}

export interface CounterfactualResult {
  adoptedDetours: number;
  actual: { risk: number; etaDeltaHr: number; fuelDeltaPct: number };
  noReroute: { risk: number; etaDeltaHr: number; fuelDeltaPct: number };
  narrative: string;
}

export interface VoyageReport {
  voyageId: string;
  vessel: VesselProfile;
  origin: Port;
  destination: Port;
  departureMs: number;
  arrivalMs: number;
  durationHr: number;
  plannedVsActual: PlannedVsActual;
  routeChanges: number;
  maxRisk: number;
  averageRisk: number;
  finalRisk: number;
  weatherEvents: number;
  securityEvents: number;
  riskReductionFromRerouting: number;
  majorDeviations: string[];
  counterfactual: CounterfactualResult;
  routeVersions: RouteVersion[];
  events: VoyageEvent[];
  telemetryHistory: TelemetrySample[];
}

export interface Voyage {
  id: string;
  plan: VoyagePlan;
  status: VoyageStatus;
  routeVersions: RouteVersion[];
  events: VoyageEvent[];
  telemetryHistory: TelemetrySample[];
  createdAtMs: number;
}

export type CameraMode = 'global' | 'follow' | 'chase' | 'tactical' | 'free';

export interface MapLayerState {
  route: boolean;
  vessel: boolean;
  weather: boolean;
  wind: boolean;
  waves: boolean;
  current: boolean;
  risk: boolean;
  security: boolean;
  storm: boolean;
  traffic: boolean;
  bathymetry: boolean;
}
