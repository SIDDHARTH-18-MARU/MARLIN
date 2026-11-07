import { useHistoryStore } from '@/stores/historyStore';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { VoyageReportView } from '@/components/voyage/VoyageReportView';
import { formatDurationHr, formatKm, formatUtc } from '@/utils/format';

export function VoyageHistory() {
  const voyages = useHistoryStore((s) => s.voyages);
  const selectedId = useHistoryStore((s) => s.selectedVoyageId);
  const select = useHistoryStore((s) => s.select);

  const selected = voyages.find((v) => v.voyageId === selectedId);

  if (voyages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className="text-sm font-semibold text-slate-100">No completed voyages yet</div>
        <p className="max-w-sm text-xs text-hull-300">Run a voyage to completion in the Command Center to see its report here.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Panel title="Voyage History">
          <p className="mb-3 text-xs text-hull-300">The latest 12 completed simulations are kept in this tab until reload. Export a report to retain it.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-hull-300">
                  <th className="pb-2">Voyage</th>
                  <th className="pb-2">Vessel</th>
                  <th className="pb-2">Route</th>
                  <th className="pb-2">Departure</th>
                  <th className="pb-2">Arrival</th>
                  <th className="pb-2">Duration</th>
                  <th className="pb-2">Distance</th>
                  <th className="pb-2">Changes</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {voyages.map((v) => (
                  <tr
                    key={v.voyageId}
                    className={`border-t border-hull-600/30 ${v.voyageId === selectedId ? 'bg-hull-700/40' : ''}`}
                  >
                    <td className="py-2">
                      <button type="button" onClick={() => select(v.voyageId)}
                        aria-pressed={v.voyageId === selectedId} className="font-semibold text-cyan-glow">
                        View report<span className="sr-only"> for {v.origin.name} to {v.destination.name}, {formatUtc(v.departureMs)}</span>
                      </button>
                    </td>
                    <td className="py-2 font-medium text-slate-100">{v.vessel.name}</td>
                    <td className="py-2 text-hull-300">
                      {v.origin.name} &rarr; {v.destination.name}
                    </td>
                    <td className="mono-num py-2 text-hull-300">{formatUtc(v.departureMs)}</td>
                    <td className="mono-num py-2 text-hull-300">{formatUtc(v.arrivalMs)}</td>
                    <td className="mono-num py-2 text-slate-100">{formatDurationHr(v.durationHr)}</td>
                    <td className="mono-num py-2 text-slate-100">{formatKm(v.plannedVsActual.actualDistanceKm)}</td>
                    <td className="mono-num py-2 text-slate-100">{v.routeChanges}</td>
                    <td className="py-2">
                      <Badge tone="ok">Complete</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && <VoyageReportView report={selected} />}
      </div>
    </div>
  );
}
