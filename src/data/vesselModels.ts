import type { VesselType } from '@/types';
import { assetUrl } from '@/engine/assetUrl';

// All five hulls are project-generated. Scale is illustrative on the globe.
export interface VesselModelEntry {
  path: string;
  scale: number;
  headingOffsetDeg: number; // rotation applied on top of live heading so the bow points along the course
}

const RAW_VESSEL_MODELS: Record<VesselType, VesselModelEntry> = {
  container: { path: '/assets/vessels/container-ship.glb', scale: 900, headingOffsetDeg: 0 },
  tanker: { path: '/assets/vessels/tanker.glb', scale: 900, headingOffsetDeg: 0 },
  'bulk-carrier': { path: '/assets/vessels/bulk-carrier.glb', scale: 900, headingOffsetDeg: 0 },
  passenger: { path: '/assets/vessels/passenger-vessel.glb', scale: 900, headingOffsetDeg: 0 },
  'general-cargo': { path: '/assets/vessels/general-cargo.glb', scale: 700, headingOffsetDeg: 0 },
};

// Paths are resolved against import.meta.env.BASE_URL exactly once, here, so
// every consumer (the Cesium globe, the asset registry) gets a URL that works
// under a subdirectory deployment.
export const VESSEL_MODELS: Record<VesselType, VesselModelEntry> = Object.fromEntries(
  Object.entries(RAW_VESSEL_MODELS).map(([type, entry]) => [
    type,
    { ...entry, path: assetUrl(entry.path) },
  ]),
) as Record<VesselType, VesselModelEntry>;
