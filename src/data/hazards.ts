import type { LatLon, SecurityLevel } from '@/types';

// Template pools the engine instantiates from when an operator triggers a
// demo event, or when a candidate route's baseline risk evaluation needs a
// plausible hazard to weigh against. Coordinates sit near real chokepoints
// on the MARLIN corridor graph so triggered events plausibly intersect an
// active route.

export interface StormTemplate {
  id: string;
  name: string;
  center: LatLon;
  radiusKm: number;
  intensity: number;
  headingDeg: number;
  speedKn: number;
}

export const STORM_TEMPLATES: StormTemplate[] = [
  {
    id: 'storm-arabian-sea',
    name: 'Arabian Sea Depression',
    center: { lat: 14.5, lon: 68.5 },
    radiusKm: 260,
    intensity: 0.8,
    headingDeg: 60,
    speedKn: 9,
  },
  {
    id: 'storm-bay-of-bengal',
    name: 'Bay of Bengal Low',
    center: { lat: 7.5, lon: 83.5 },
    radiusKm: 300,
    intensity: 0.85,
    headingDeg: 310,
    speedKn: 11,
  },
  {
    id: 'storm-malacca-approach',
    name: 'Andaman Sea Squall Line',
    center: { lat: 6.5, lon: 94.5 },
    radiusKm: 220,
    intensity: 0.7,
    headingDeg: 200,
    speedKn: 8,
  },
  {
    id: 'storm-mozambique',
    name: 'Mozambique Channel System',
    center: { lat: -12.0, lon: 41.5 },
    radiusKm: 280,
    intensity: 0.75,
    headingDeg: 150,
    speedKn: 10,
  },
];

export interface SecurityZoneTemplate {
  id: string;
  name: string;
  scenarioType: string;
  level: SecurityLevel;
  center: LatLon;
  radiusKm: number;
  description: string;
}

export const SECURITY_ZONE_TEMPLATES: SecurityZoneTemplate[] = [
  {
    id: 'sz-nine-degree',
    name: 'Nine Degree Channel Advisory',
    scenarioType: 'Simulated restricted-corridor scenario',
    level: 'HIGH',
    center: { lat: 7.5, lon: 76.5 },
    radiusKm: 220,
    description: 'Simulated elevated-risk advisory affecting the Nine Degree Channel corridor.',
  },
  {
    id: 'sz-malacca-west',
    name: 'Andaman Sea Advisory',
    scenarioType: 'Simulated restricted-corridor scenario',
    level: 'ELEVATED',
    center: { lat: 5.5, lon: 95.5 },
    radiusKm: 200,
    description: 'Simulated advisory covering the western Malacca Strait approach.',
  },
  {
    id: 'sz-somali-basin',
    name: 'Somali Basin Advisory',
    scenarioType: 'Simulated restricted-corridor scenario',
    level: 'CRITICAL',
    center: { lat: 3.5, lon: 55.0 },
    radiusKm: 320,
    description: 'Simulated critical scenario affecting open-ocean transit of the Somali Basin.',
  },
  {
    id: 'sz-mozambique',
    name: 'Mozambique Channel Advisory',
    scenarioType: 'Simulated restricted-corridor scenario',
    level: 'HIGH',
    center: { lat: -11.0, lon: 42.0 },
    radiusKm: 240,
    description: 'Simulated advisory affecting the Mozambique Channel transit corridor.',
  },
];
