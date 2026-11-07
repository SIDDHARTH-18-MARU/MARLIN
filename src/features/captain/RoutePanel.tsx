/**
 * /captain/route
 *
 * The assigned route in detail: waypoints with progress, the scored metrics,
 * the explainability reasons, and any pending route update.
 */

import clsx from 'clsx';
import { Check, CircleDot, Circle } from 'lucide-react';
import { EmptyState, GlassPanel, Readout, RiskTag } from '@/components/ui/Glass';
import { formatSimClock, riskBand } from './bridgeTypes';
import { nextWaypoint } from './bridgeScenario';
import { RouteUpdateCard } from './RouteUpdateCard';
import { useBridgeState } from './bridgeAdapter';

export function RoutePanel() {
  const bridge = useBridgeState();

  if (!bridge.activeRoute) {
    return (
      <div className="h-full p-2">
        <GlassPanel className="h-full">
          <EmptyState message="No assigned route. Plan a voyage from the Control Room to see it here." />
        </GlassPanel>
      </div>
    );
  }

  const route = bridge.activeRoute;
  const alternate = bridge.alternateRoute;
  const minute = bridge.minute;
  const upcoming = nextWaypoint(route, minute);

  return (
    <div className="h-full overflow-y-auto p-2 grid gap-2 lg:grid-cols-[1.4fr_1fr] items-start">
      <div className="grid gap-2">
        <GlassPanel title={`Assigned route · ${route.kind.toUpperCase()}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Readout label="Distance" value={route.distanceNm} unit="NM" />
            <Readout label="ETA" value={formatSimClock(route.etaMinutes)} />
            <Readout label="Fuel" value={route.fuelEstimate} unit="t" />
            <div className="flex flex-col gap-0.5">
              <span className="label">Risk</span>
              <span className="mono text-2xl leading-none">
                <RiskTag band={riskBand(route.riskScore)} />
              </span>
            </div>
          </div>

          {/* Waypoint progression */}
          <div className="space-y-0">
            <span className="label">Waypoints</span>
            <ol className="mt-2">
              {route.waypoints.map((w, i) => {
                const passed = w.etaMinutes <= minute;
                const isNext = w.id === upcoming.id && !passed;
                return (
                  <li key={w.id} className="flex items-start gap-2.5 relative pb-3">
                    {i < route.waypoints.length - 1 && (
                      <span
                        className={clsx(
                          'absolute left-[7px] top-4 w-px h-full',
                          passed ? 'bg-calm/40' : 'bg-steel',
                        )}
                      />
                    )}
                    <span className="relative z-10 mt-0.5 shrink-0">
                      {passed ? (
                        <Check size={15} className="text-calm" />
                      ) : isNext ? (
                        <CircleDot size={15} className="text-signal" />
                      ) : (
                        <Circle size={15} className="text-steel" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={clsx(
                          'mono text-xs truncate',
                          passed ? 'text-mist' : isNext ? 'text-signal' : 'text-chalk',
                        )}
                      >
                        {w.name}
                        {isNext && (
                          <span className="ml-2 text-[10px] tracking-wider">NEXT</span>
                        )}
                      </div>
                      <div className="mono text-[11px] text-mist">
                        {formatSimClock(w.etaMinutes)} ·{' '}
                        {w.position.latitude.toFixed(2)}°N{' '}
                        {w.position.longitude.toFixed(2)}°E
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </GlassPanel>

        <GlassPanel title="Why this route?">
          <ul className="space-y-1.5">
            {route.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs text-chalk">
                <Check size={13} className="text-calm mt-0.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-steel/40">
            <span className="label">Primary reason</span>
            <p className="mono text-sm text-signal mt-1">{route.recommendationReason}</p>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-2">
        <RouteUpdateCard />

        <GlassPanel title="Exposure">
          <div className="space-y-3">
            {(
              [
                ['Weather', route.weatherExposure],
                ['Traffic', route.trafficExposure],
                ['Restrictions', route.restrictionExposure],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="label">{label}</span>
                  <span className="mono text-[11px] text-mist">{value}%</span>
                </div>
                <div className="h-1 rounded bg-steel/60 overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded transition-all duration-500',
                      value > 66 ? 'bg-alarm' : value > 33 ? 'bg-caution' : 'bg-calm',
                    )}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {alternate && (
          <GlassPanel title={`Proposed · ${alternate.kind.toUpperCase()}`}>
            <div className="grid grid-cols-2 gap-3">
              <Readout label="Distance" value={alternate.distanceNm} unit="NM" />
              <Readout label="ETA" value={formatSimClock(alternate.etaMinutes)} />
            </div>
            <p className="text-[11px] text-mist mt-3">
              {alternate.recommendationReason}
            </p>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
