import type { VesselProfile } from '@/types';

// SIMULATION PROFILE: representative values for prototype physics, not
// naval-architecture-certified performance figures for a real hull.
export const VESSEL_PROFILES: VesselProfile[] = [
  {
    id: 'container-panamax',
    type: 'container',
    name: 'Container Ship',
    length_m: 300,
    beam_m: 40,
    draft_m: 14,
    cruisingSpeedKn: 18,
    maxSpeedKn: 24,
    baseFuelRateTPerHr: 4.0,
    waveSensitivity: 0.45,
    windSensitivity: 0.4,
    currentSensitivity: 0.5,
    fuelEfficiencyLabel: 'High efficiency',
  },
  {
    id: 'tanker-suezmax',
    type: 'tanker',
    name: 'Tanker',
    length_m: 250,
    beam_m: 44,
    draft_m: 15,
    cruisingSpeedKn: 14,
    maxSpeedKn: 16,
    baseFuelRateTPerHr: 3.5,
    waveSensitivity: 0.55,
    windSensitivity: 0.5,
    currentSensitivity: 0.55,
    fuelEfficiencyLabel: 'Standard',
  },
  {
    id: 'bulk-capesize',
    type: 'bulk-carrier',
    name: 'Bulk Carrier',
    length_m: 230,
    beam_m: 32,
    draft_m: 13,
    cruisingSpeedKn: 13,
    maxSpeedKn: 15,
    baseFuelRateTPerHr: 2.6,
    waveSensitivity: 0.6,
    windSensitivity: 0.55,
    currentSensitivity: 0.5,
    fuelEfficiencyLabel: 'Standard',
  },
  {
    id: 'passenger-cruise',
    type: 'passenger',
    name: 'Passenger Vessel',
    length_m: 290,
    beam_m: 35,
    draft_m: 8,
    cruisingSpeedKn: 22,
    maxSpeedKn: 26,
    baseFuelRateTPerHr: 5.5,
    waveSensitivity: 0.35,
    windSensitivity: 0.35,
    currentSensitivity: 0.4,
    fuelEfficiencyLabel: 'Fuel intensive',
  },
  {
    id: 'general-cargo',
    type: 'general-cargo',
    name: 'General Cargo Vessel',
    length_m: 150,
    beam_m: 23,
    draft_m: 9,
    cruisingSpeedKn: 15,
    maxSpeedKn: 18,
    baseFuelRateTPerHr: 1.8,
    waveSensitivity: 0.5,
    windSensitivity: 0.45,
    currentSensitivity: 0.45,
    fuelEfficiencyLabel: 'Standard',
  },
];

export const vesselById = (id: string): VesselProfile => {
  const v = VESSEL_PROFILES.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown vessel id: ${id}`);
  return v;
};
