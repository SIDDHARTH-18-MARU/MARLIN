import { create } from 'zustand';
import type { CameraMode, LatLon, MapLayerState } from '@/types';

interface MapState {
  layers: MapLayerState;
  cameraMode: CameraMode;
  focusRequest: { location: LatLon; nonce: number } | null;
  toggleLayer: (key: keyof MapLayerState) => void;
  setCameraMode: (mode: CameraMode) => void;
  focusOn: (location: LatLon) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  layers: {
    route: true,
    vessel: true,
    weather: true,
    wind: true,
    waves: true,
    current: true,
    risk: true,
    security: false,
    storm: false,
    traffic: false,
    bathymetry: false,
  },
  cameraMode: 'global',
  focusRequest: null,
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  focusOn: (location) => set({ focusRequest: { location, nonce: (get().focusRequest?.nonce ?? 0) + 1 } }),
}));
