import type { VesselType } from '@/types';
import { VESSEL_MODELS } from './vesselModels';

// The registry credits only the assets included in this private build.
export type AssetSource = 'self' | 'sketchfab';
export type AssetLicence = 'SELF_CREATED' | 'STORE' | 'CC0' | 'CC-BY';

export interface AssetEntry {
  id: string;
  name: string;
  vesselType: VesselType;
  source: AssetSource;
  licence: AssetLicence;
  attribution: string;
  modelPath: string;
  format: 'glb';
  notes: string;
}

/** Licences that may ship without further review. */
const PERMITTED_LICENCES: AssetLicence[] = ['SELF_CREATED', 'CC0', 'CC-BY'];

/** Entries whose licence has not been cleared for release. */
export function unverifiedAssets(): AssetEntry[] {
  return ASSET_REGISTRY.filter((a) => !PERMITTED_LICENCES.includes(a.licence));
}

export const ASSET_REGISTRY: AssetEntry[] = [
  {
    id: 'container-ship-hull',
    name: 'Container Ship Hull',
    vesselType: 'container',
    source: 'self',
    licence: 'SELF_CREATED',
    attribution: 'Generated in-project from box primitives — no third-party asset.',
    modelPath: VESSEL_MODELS.container.path,
    format: 'glb',
    notes: 'Deck-stacked container silhouette; bridge aft.',
  },
  {
    id: 'tanker-hull',
    name: 'Tanker Hull',
    vesselType: 'tanker',
    source: 'self',
    licence: 'SELF_CREATED',
    attribution: 'Generated in-project from box primitives.',
    modelPath: VESSEL_MODELS.tanker.path,
    format: 'glb',
    notes: 'Procedural tanker profile.',
  },
  {
    id: 'bulk-carrier-hull',
    name: 'Bulk Carrier Hull',
    vesselType: 'bulk-carrier',
    source: 'self',
    licence: 'SELF_CREATED',
    attribution: 'Generated in-project from box primitives — no third-party asset.',
    modelPath: VESSEL_MODELS['bulk-carrier'].path,
    format: 'glb',
    notes: 'Hatch-covered cargo holds, bridge aft.',
  },
  {
    id: 'passenger-vessel-hull',
    name: 'Passenger Vessel Hull',
    vesselType: 'passenger',
    source: 'self',
    licence: 'SELF_CREATED',
    attribution: 'Generated in-project from box primitives.',
    modelPath: VESSEL_MODELS.passenger.path,
    format: 'glb',
    notes: 'Procedural passenger profile.',
  },
  {
    id: 'general-cargo-hull',
    name: 'General Cargo Vessel Hull',
    vesselType: 'general-cargo',
    source: 'self',
    licence: 'SELF_CREATED',
    attribution: 'Generated in-project from box primitives — no third-party asset.',
    modelPath: VESSEL_MODELS['general-cargo'].path,
    format: 'glb',
    notes: 'Compact single-hold hull for the smallest vessel class.',
  },
];
