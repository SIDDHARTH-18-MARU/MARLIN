import { useEffect, useState } from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import { Panel, MetricRow } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { riskTone } from '@/components/ui/statusTones';
import { RiskHistoryChart } from '@/components/charts/RiskHistoryChart';
import { FuelHistoryChart } from '@/components/charts/FuelHistoryChart';
import { VESSEL_PROFILES } from '@/data/vessels';
import { portById } from '@/data/ports';
import { DEMO_DEPARTURE_MS, PRESETS } from '@/stores/voyageStore';
import { calculateRoutes } from '@/services/routeService';
import type { Route, VesselProfile } from '@/types';
import { formatDurationHr, formatKm } from '@/utils/format';
import { Button } from '@/components/ui/Button';

export function Analytics() {
  const voyages = useHistoryStore((s) => s.voyages);
  const latest = voyages[0];

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Analytics</h1>
          <p className="text-xs text-hull-300">Post-voyage analytics and cross-vessel routing comparison.</p>
        </div>

        {latest ? (
          <>
            <Panel title={`Latest Voyage — ${latest.vessel.name}: ${latest.origin.name} → ${latest.destination.name}`}>
              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
                <MetricRow label="Max Risk" value={latest.maxRisk.toFixed(0)} />
                <MetricRow label="Avg Risk" value={latest.averageRisk.toFixed(0)} />
                <MetricRow label="Route Changes" value={latest.routeChanges} />
                <MetricRow label="Duration" value={formatDurationHr(latest.durationHr)} />
              </div>
            </Panel>
            <Panel title="Risk Over Time">
              <RiskHistoryChart telemetry={latest.telemetryHistory} events={latest.events} />
            </Panel>
            <Panel title="Modelled Fuel Consumption">
              <FuelHistoryChart
                telemetry={latest.telemetryHistory}
                plannedTotalFuelTonnes={latest.plannedVsActual.plannedFuelTonnes}
                plannedDurationHr={(latest.plannedVsActual.plannedEtaMs - latest.departureMs) / 3_600_000}
                departureMs={latest.departureMs}
              />
            </Panel>
          </>
        ) : (
          <Panel title="Voyage Analytics">
            <p className="text-xs text-hull-300">Complete a voyage to see risk, fuel, and event analytics here.</p>
          </Panel>
        )}

        <VesselComparison />
      </div>
    </div>
  );
}

function VesselComparison() {
  const [results, setResults] = useState<Record<string, Route> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const origin = portById('mumbai');
  const destination = portById('singapore');

  const run = async () => {
    setLoading(true);
    setError(false);
    try {
      const entries = await Promise.all(
      VESSEL_PROFILES.map(async (v) => {
        const routes = await calculateRoutes({
          vessel: v,
          originPoint: { lat: origin.lat, lon: origin.lon },
          originPortId: origin.id,
          destPortId: destination.id,
          departureMs: DEMO_DEPARTURE_MS,
          preferences: PRESETS.balanced,
        });
        return [v.id, routes.find((r) => r.kind === 'recommended')!] as [string, Route];
      }),
    );
      setResults(Object.fromEntries(entries));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Panel
      title={`Vessel Comparison — ${origin.name} → ${destination.name}`}
      right={
        <Button variant="ghost" onClick={run} disabled={loading}>
          {loading ? 'Computing...' : 'Recompute'}
        </Button>
      }
    >
      <p className="mb-3 text-[11px] text-hull-300">
        Five vessel profiles on the same corridor, departure (17 Aug 2026, 08:00 UTC) and balanced routing weights.
      </p>
      {error && <p role="alert" className="mb-3 text-xs text-crit">Comparison failed. Select Recompute to retry.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-hull-300">
              <th className="pb-2">Vessel</th>
              <th className="pb-2">Distance</th>
              <th className="pb-2">Duration</th>
              <th className="pb-2">Modelled Fuel</th>
              <th className="pb-2">Risk</th>
            </tr>
          </thead>
          <tbody>
            {VESSEL_PROFILES.map((v: VesselProfile) => {
              const r = results?.[v.id];
              return (
                <tr key={v.id} className="border-t border-hull-600/30">
                  <td className="py-1.5 font-medium text-slate-100">{v.name}</td>
                  <td className="mono-num py-1.5 text-slate-100">{r ? formatKm(r.metrics.distanceKm) : '—'}</td>
                  <td className="mono-num py-1.5 text-slate-100">{r ? formatDurationHr(r.metrics.durationHr) : '—'}</td>
                  <td className="mono-num py-1.5 text-slate-100">{r ? `${r.metrics.fuelTonnes.toFixed(1)} t` : '—'}</td>
                  <td className="py-1.5">{r && <Badge tone={riskTone(r.metrics.risk.total)}>{r.metrics.risk.total.toFixed(0)}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
