import type { VesselType } from '@/types';
import { VESSEL_MODELS } from '@/data/vesselModels';

// The bridge normalises each generated hull to its scene scale.
export function vesselModelFor(type: VesselType) {
  return { path: VESSEL_MODELS[type].path, scale: 1, orientationOffsetDeg: 0 };
}
