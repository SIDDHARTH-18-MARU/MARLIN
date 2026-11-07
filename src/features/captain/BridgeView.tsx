/**
 * /captain/bridge
 *
 * The 3D navigation environment with the bridge instrument strip beneath it.
 * The scene reads vessel state from the simulation store; it never originates
 * heading or speed itself.
 */

import { lazy, Suspense, useMemo } from 'react';
import clsx from 'clsx';
import { SceneBoundary } from '@/components/SceneBoundary';
import { webglAvailable } from '@/components/map/webglAvailable';
import { Button, EmptyState, GlassPanel, Readout, RiskTag } from '@/components/ui/Glass';
import { useSimulationStore } from '@/stores/simulationStore';
import { getEnvironmentAt } from '@/engine/environment';
import { haversineKm } from '@/engine/geo';
import { formatSimClock, riskBand } from './bridgeTypes';
import { depthAtMinute, nextWaypoint, trafficAtMinute } from './bridgeScenario';
import { RouteUpdateCard } from './RouteUpdateCard';
import { useBridgeState } from './bridgeAdapter';

const KM_PER_NM = 1.852;
const BridgeScene = lazy(() => import('@/three/BridgeScene').then(module => ({ default: module.BridgeScene })));

function SceneFallback({
  heading,
  speed,
  onRetry,
}: {
  heading: number;
  speed: number;
  onRetry: () => void;
}) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-deep">
      <span className="label">3D navigation view unavailable</span>
      <div className="mono text-5xl text-signal">
        {String(Math.round(heading)).padStart(3, '0')}°
      </div>
      <div className="mono text-lg text-mist">{speed.toFixed(1)} kn</div>
      <p className="text-xs text-mist max-w-[36ch] text-center">
        Graphics are unavailable on this display. Simulated navigation readouts remain available.
      </p>
      <Button variant="primary" onClick={onRetry}>
        Retry 3D view
      </Button>
    </div>
  );
}

export function BridgeView() {
  const bridge = useBridgeState();
  const simTimeMs = useSimulationStore((s) => s.simTimeMs);

  const minute = bridge.minute;
  // Traffic is recomputed as the clock runs; rebuilding the array every frame
  // remounts the 3D children that consume it, which shows up as flicker.
  // Recompute on a coarse step instead — vessels still move, without churning
  // React identity.
  const coarseMinute = Math.round(minute / 2) * 2;
  const traffic = useMemo(() => trafficAtMinute(coarseMinute), [coarseMinute]);

  if (!bridge.hasVoyage || !bridge.activeRoute) {
    return (
      <div className="h-full p-2">
        <GlassPanel className="h-full">
          <EmptyState message="No active voyage. Plan and start a voyage from the Control Room to bring the bridge online." />
        </GlassPanel>
      </div>
    );
  }

  const route = bridge.activeRoute;
  const alternate = bridge.alternateRoute ?? route;

  const env = getEnvironmentAt(
    bridge.shipPosition.lat,
    bridge.shipPosition.lon,
    simTimeMs,
    bridge.activeStorms,
  );

  const speed = bridge.shipSpeedKn;
  const heading = bridge.shipHeadingDeg;
  const depth = depthAtMinute(minute);
  const wp = nextWaypoint(route, minute);

  // The environment model already reports a continuous 0-1 storm intensity, so
  // the sky and sea deteriorate gradually rather than switching at a threshold.
  const storminess = Math.max(0, Math.min(1, env.stormIntensity));
  const stormActive = bridge.activeStorms.length > 0;

  const destination = route.waypoints.at(-1)!;
  const toGoNm =
    haversineKm(bridge.shipPosition, {
      lat: destination.position.latitude,
      lon: destination.position.longitude,
    }) / KM_PER_NM;
  const approaching = toGoNm <= 34;

  const closest = traffic.length
    ? traffic.reduce((a, b) => (a.cpaNm < b.cpaNm ? a : b))
    : null;

  return (
    <div className="h-full flex flex-col gap-2 p-2 min-h-0 overflow-y-auto">
      {/* 3D navigation view — the hero element of this screen */}
      <div className="relative min-h-60 flex-1 rounded-lg overflow-hidden border border-steel/60">
        {webglAvailable() ? (
          <SceneBoundary
            fallback={(retry) => (
              <SceneFallback heading={heading} speed={speed} onRetry={retry} />
            )}
          >
            <Suspense fallback={<p role="status" className="p-4 text-sm text-mist">Loading local bridge view…</p>}>
              <BridgeScene
              activeRoute={route}
              alternateRoute={alternate}
              minute={minute}
              heading={heading}
              traffic={traffic}
              waveHeight={env.waveHeightM}
              stormActive={stormActive}
              storminess={storminess}
              cloudCoverPct={Math.round(storminess * 100)}
              speed={speed}
              // While a reroute awaits the captain's decision, the proposed
              // track lights amber instead of sitting dimmed alongside the
              // active one.
              alternateFocused={bridge.decisionPending !== null}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <SceneFallback
            heading={heading}
            speed={speed}
            onRetry={() => window.location.reload()}
          />
        )}

        {/* Own-ship badge, overlaid on the scene */}
        <div className="absolute top-3 left-3 glass rounded px-3 py-2 pointer-events-none">
          <div className="label">Own vessel</div>
          <div className="mono text-sm text-chalk">
            {bridge.vessel.name} · {bridge.vessel.type}
          </div>
          <div className="mono text-[11px] text-mist mt-0.5">
            {bridge.shipPosition.lat.toFixed(3)}°N{' '}
            {bridge.shipPosition.lon.toFixed(3)}°E
          </div>
        </div>

        {/* Pending reroute surfaces directly over the bridge view */}
        <div className="absolute right-3 top-18 w-[calc(100%-1.5rem)] max-w-[280px] pointer-events-auto md:top-3">
          <RouteUpdateCard compact />
        </div>

        {/* Sea state, bottom-left of the scene */}
        <div className="absolute bottom-3 left-3 glass rounded px-3 py-2 pointer-events-none">
          <div className="label">Sea state</div>
          <div className="mono text-sm text-chalk">
            {env.waveHeightM.toFixed(1)} m · {Math.round(env.windSpeedKn)} kn
          </div>
        </div>
      </div>

      {/* Bridge instruments */}
      <GlassPanel className="shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          <Readout label="Speed" value={speed.toFixed(1)} unit="kn" />
          <Readout
            label="Heading"
            value={String(Math.round(heading)).padStart(3, '0')}
            unit="°"
          />
          <Readout label="Depth" value={depth} unit="m" />
          <Readout label="ETA" value={formatSimClock(route.etaMinutes)} />
          <div className="flex flex-col gap-0.5">
            <span className="label">Next waypoint</span>
            <span className="mono text-base leading-tight text-chalk">{wp.name}</span>
            <span className="mono text-[11px] text-mist">
              {formatSimClock(wp.etaMinutes)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="label">Nearest contact</span>
            <span className="mono text-base leading-tight text-chalk">
              {closest ? `${closest.cpaNm.toFixed(1)} NM` : '—'}
            </span>
            <span className="mono text-[11px] text-mist truncate">
              {closest?.name ?? 'No contacts'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="label">To destination</span>
            <span
              className={clsx(
                'mono text-base leading-tight',
                approaching ? 'text-signal' : 'text-chalk',
              )}
            >
              {toGoNm.toFixed(1)} NM
            </span>
            <span className="mono text-[11px] text-mist truncate">
              {approaching ? 'APPROACHING PORT' : bridge.destination.name.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-steel/40">
          <span className="label">Route</span>
          <span className="mono text-xs text-chalk">
            {route.kind.toUpperCase()} · {route.distanceNm} NM
          </span>
          <span className="label ml-2">Risk</span>
          <RiskTag band={riskBand(route.riskScore)} />
        </div>
      </GlassPanel>
    </div>
  );
}
