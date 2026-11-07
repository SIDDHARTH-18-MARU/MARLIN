/**
 * /captain/environment
 *
 * Local conditions around the vessel, plus nearby traffic. Values come from the
 * same environment model the routing engine scores against, so this screen
 * visibly deteriorates as a storm develops on the route.
 */

import clsx from 'clsx';
import { EmptyState, GlassPanel, Readout } from '@/components/ui/Glass';
import { useSimulationStore } from '@/stores/simulationStore';
import { getEnvironmentAt } from '@/engine/environment';
import { trafficAtMinute } from './bridgeScenario';
import { useBridgeState } from './bridgeAdapter';

function compass(deg: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(((deg % 360) / 22.5)) % 16];
}

export function EnvironmentPanel() {
  const bridge = useBridgeState();
  const simTimeMs = useSimulationStore((s) => s.simTimeMs);

  if (!bridge.hasVoyage) {
    return (
      <div className="h-full p-2">
        <GlassPanel className="h-full">
          <EmptyState message="No active voyage. Environment readings follow the vessel once a voyage is underway." />
        </GlassPanel>
      </div>
    );
  }

  const env = getEnvironmentAt(
    bridge.shipPosition.lat,
    bridge.shipPosition.lon,
    simTimeMs,
    bridge.activeStorms,
  );
  const traffic = trafficAtMinute(bridge.minute);

  const waveTone = env.waveHeightM > 3 ? 'alarm' : env.waveHeightM > 2 ? 'caution' : 'calm';
  const windTone = env.windSpeedKn > 25 ? 'alarm' : env.windSpeedKn > 16 ? 'caution' : 'calm';

  const summary =
    env.waveHeightM > 3.5
      ? 'Heavy seas. Expect reduced speed and increased motion.'
      : env.waveHeightM > 2
        ? 'Moderate seas. Monitor conditions on the route ahead.'
        : 'Conditions within normal operating limits.';

  return (
    <div className="h-full overflow-y-auto p-2 grid gap-2 lg:grid-cols-2 items-start">
      <div className="grid gap-2">
        <GlassPanel title="Local conditions">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Readout
              label="Wave height"
              value={env.waveHeightM.toFixed(1)}
              unit="m"
              tone={waveTone}
            />
            <Readout
              label="Wind"
              value={Math.round(env.windSpeedKn)}
              unit={`kn ${compass(env.windDirDeg)}`}
              tone={windTone}
            />
            <Readout label="Wave period" value={env.wavePeriodS.toFixed(1)} unit="s" />
            <Readout
              label="Current"
              value={env.currentSpeedKn.toFixed(1)}
              unit={`kn ${compass(env.currentDirDeg)}`}
            />
            <Readout
              label="Storm intensity"
              value={Math.round(env.stormIntensity * 100)}
              unit="%"
              tone={env.stormIntensity > 0.5 ? 'alarm' : 'default'}
            />
            <Readout
              label="Weather risk"
              value={Math.round(env.weatherRisk)}
              unit="/100"
              tone={env.weatherRisk > 60 ? 'alarm' : env.weatherRisk > 30 ? 'caution' : 'calm'}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-steel/40">
            <span className="label">Assessment</span>
            <p
              className={clsx(
                'mono text-xs mt-1',
                env.waveHeightM > 3 ? 'text-alarm' : 'text-chalk',
              )}
            >
              {summary}
            </p>
          </div>
        </GlassPanel>

        <GlassPanel title="Active hazards">
          {bridge.activeStorms.length === 0 && bridge.activeSecurityZones.length === 0 ? (
            <p className="text-xs text-mist">
              No active weather or security hazards on the current route.
            </p>
          ) : (
            <ul className="space-y-2">
              {bridge.activeStorms.map((s) => (
                <li key={s.id} className="rounded border border-alarm/40 bg-alarm/5 p-2.5">
                  <div className="mono text-xs text-alarm">STORM CELL</div>
                  <div className="mono text-[11px] text-mist mt-1">
                    {s.center.lat.toFixed(2)}°N {s.center.lon.toFixed(2)}°E · r{' '}
                    {Math.round(s.radiusKm)} km
                  </div>
                </li>
              ))}
              {bridge.activeSecurityZones.map((z) => (
                <li
                  key={z.id}
                  className="rounded border border-critical/40 bg-critical/5 p-2.5"
                >
                  <div className="mono text-xs text-critical">{z.name.toUpperCase()}</div>
                  <div className="text-[11px] text-mist mt-1">{z.description}</div>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      <GlassPanel title={`Nearby vessels · ${traffic.length}`}>
        {traffic.length === 0 ? (
          <EmptyState message="Nearby traffic data is temporarily unavailable. Navigation instruments remain active." />
        ) : (
          <ul className="space-y-2">
            {traffic
              .slice()
              .sort((a, b) => a.cpaNm - b.cpaNm)
              .map((c) => {
                const close = c.cpaNm < 1.5;
                return (
                  <li
                    key={c.id}
                    className={clsx(
                      'rounded border p-2.5',
                      close ? 'border-alarm/50 bg-alarm/5' : 'border-steel/50 bg-steel/10',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="mono text-xs text-chalk truncate">{c.name}</div>
                        <div className="label mt-0.5">{c.type}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={clsx('mono text-sm', close ? 'text-alarm' : 'text-chalk')}
                        >
                          {c.cpaNm.toFixed(1)} NM
                        </div>
                        <div className="label">CPA</div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 pt-2 border-t border-steel/30">
                      <span className="mono text-[11px] text-mist">
                        RNG {c.rangeNm.toFixed(1)} NM
                      </span>
                      <span className="mono text-[11px] text-mist">
                        HDG {String(c.heading).padStart(3, '0')}°
                      </span>
                      <span className="mono text-[11px] text-mist">
                        SPD {c.speed.toFixed(1)} kn
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
