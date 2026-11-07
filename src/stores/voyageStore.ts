import { create } from 'zustand';
import type { Port, Route, RoutingPreferences, VesselProfile, VoyageStatus } from '@/types';
import { VESSEL_PROFILES } from '@/data/vessels';
import { portById } from '@/data/ports';
import { calculateRoutes } from '@/services/routeService';

export const DEFAULT_PREFERENCES: RoutingPreferences = {
  safety: 80,
  fuel: 60,
  time: 70,
  riskThreshold: 25,
};
export const DEMO_DEPARTURE_MS = Date.UTC(2026, 7, 17, 8);

export const PRESETS: Record<string, RoutingPreferences> = {
  balanced: { safety: 60, fuel: 60, time: 60, riskThreshold: 40 },
  'safety-first': { safety: 90, fuel: 45, time: 40, riskThreshold: 20 },
  'fuel-efficient': { safety: 55, fuel: 90, time: 40, riskThreshold: 40 },
  fastest: { safety: 40, fuel: 40, time: 90, riskThreshold: 55 },
};

interface VoyageState {
  voyageId: string;
  vessel: VesselProfile;
  origin: Port;
  destination: Port;
  departureMs: number;
  preferences: RoutingPreferences;

  routes: Route[] | null;
  activeRouteId: string | null;
  isCalculating: boolean;
  status: VoyageStatus;

  setVessel: (v: VesselProfile) => void;
  setOrigin: (p: Port) => void;
  setDestination: (p: Port) => void;
  setDeparture: (ms: number) => void;
  setPreferences: (p: Partial<RoutingPreferences>) => void;
  applyPreset: (key: keyof typeof PRESETS) => void;

  generateRoutes: () => Promise<boolean>;
  selectRoute: (id: string) => void;
  activeRoute: () => Route | null;
  beginVoyage: () => void;
  resetPlanning: () => void;
}

// Real current time, rounded up to the next quarter-hour so it reads cleanly in the UI.
function realDefaultDeparture(): number {
  const now = new Date();
  now.setUTCMinutes(Math.ceil(now.getUTCMinutes() / 15) * 15, 0, 0);
  return now.getTime();
}
const defaultDeparture = realDefaultDeparture();
let planRevision = 0;
const invalidatedPlan = {
  routes: null, activeRouteId: null, isCalculating: false, status: 'planning' as const,
};

export const useVoyageStore = create<VoyageState>((set, get) => {
  function editPlan(change: Partial<VoyageState>) {
    planRevision += 1;
    set({ ...invalidatedPlan, ...change });
  }
  return {
  voyageId: `voy-${Date.now()}`,
  vessel: VESSEL_PROFILES[0],
  origin: portById('mumbai'),
  destination: portById('singapore'),
  departureMs: defaultDeparture,
  preferences: DEFAULT_PREFERENCES,

  routes: null,
  activeRouteId: null,
  isCalculating: false,
  status: 'planning',

  setVessel: (v) => editPlan({ vessel: v }),
  setOrigin: (p) => editPlan({ origin: p }),
  setDestination: (p) => editPlan({ destination: p }),
  setDeparture: (ms) => editPlan({ departureMs: ms }),
  setPreferences: (p) => editPlan({ preferences: { ...get().preferences, ...p } }),
  applyPreset: (key) => editPlan({ preferences: PRESETS[key] }),

  generateRoutes: async () => {
    const { vessel, origin, destination, departureMs, preferences } = get();
    const request = ++planRevision;
    set({ isCalculating: true });
    try {
      const routes = await calculateRoutes({
        vessel,
        originPoint: { lat: origin.lat, lon: origin.lon },
        originPortId: origin.id,
        destPortId: destination.id,
        departureMs,
        preferences,
      });
      if (request !== planRevision) return false;
      const recommended = routes.find((r) => r.kind === 'recommended');
      if (!recommended) throw new Error('No candidate routes were generated.');
      set({ routes, activeRouteId: recommended.id, status: 'routes-ready' });
      return true;
    } finally {
      if (request === planRevision) set({ isCalculating: false });
    }
  },

  selectRoute: (id) => set({ activeRouteId: id }),

  activeRoute: () => {
    const { routes, activeRouteId } = get();
    return routes?.find((r) => r.id === activeRouteId) ?? null;
  },

  beginVoyage: () => set({ status: 'underway' }),

  resetPlanning: () => editPlan({ voyageId: `voy-${crypto.randomUUID()}` }),
  };
});
