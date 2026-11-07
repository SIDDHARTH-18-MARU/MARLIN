import { lazy, Suspense, useRef, useState } from 'react';
import { useVoyageStore } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { SceneBoundary } from '@/components/SceneBoundary';
import { webglAvailable } from './webglAvailable';
import { RouteSketch } from './RouteSketch';

const CesiumScene = lazy(() => import('./CesiumScene'));

export function CesiumGlobe() {
  const [failed, setFailed] = useState(false);
  const onFailure = useRef(() => setFailed(true)).current;
  const fallback = <GlobeFallback />;
  // The pinned Cesium Material code references OffscreenCanvas at runtime.
  if (failed || typeof OffscreenCanvas === 'undefined' || !webglAvailable()) return fallback;
  return <SceneBoundary fallback={fallback}><Suspense fallback={<GlobeFallback loading />}><CesiumScene onFailure={onFailure} /></Suspense></SceneBoundary>;
}

function GlobeFallback({ loading = false }: { loading?: boolean }) {
  const candidates = useVoyageStore(state => state.routes);
  const status = useVoyageStore(state => state.status);
  const route = useSimulationStore(state => state.routeVersions[state.activeVersionIndex]?.route);
  const position = useSimulationStore(state => state.shipPosition);
  const underway = status === 'underway' || status === 'complete';
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-hidden bg-hull-900 px-3">
      <p role="status" className="pb-2 text-center text-xs text-hull-300">{loading ? 'Loading the local 3D globe…' : '3D globe unavailable. Showing a schematic for this simulation.'}</p>
      <div className="min-h-0 w-full max-w-xl">
        <RouteSketch routes={underway && route ? [route] : candidates ?? []} position={underway ? position : undefined} />
      </div>
    </div>
  );
}
