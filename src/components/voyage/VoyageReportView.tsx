import type { VoyageReport } from '@/types';
import { Panel, MetricRow } from '@/components/ui/Panel';
import { PlannedVsActual } from './PlannedVsActual';
import { RouteHistoryTimeline } from './RouteHistoryTimeline';
import { CounterfactualPanel } from './CounterfactualPanel';
import { EventLogTable } from '@/components/simulation/EventLogTable';
import { RiskHistoryChart } from '@/components/charts/RiskHistoryChart';
import { FuelHistoryChart } from '@/components/charts/FuelHistoryChart';
import { Button } from '@/components/ui/Button';
import { VoyageReplay } from './VoyageReplay';
import { formatDurationHr, formatUtc } from '@/utils/format';

export function VoyageReportView({ report }: { report: VoyageReport }) {
  function exportReport() {
    const payload = { schemaVersion: 1, environment: 'Synthetic MARLIN simulation', report };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `marlin-${report.voyageId}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel rounded-lg p-6 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-glow">Voyage Complete</div>
        <div className="mt-1 text-2xl font-bold text-slate-100">
          {report.origin.name} <span className="text-hull-400">&rarr;</span> {report.destination.name}
        </div>
        <div className="mt-0.5 text-sm text-hull-300">{report.vessel.name}</div>
        <Button variant="secondary" className="mt-3" onClick={exportReport}>Export simulated report</Button>
        <div className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
          <Stat label="Departure" value={formatUtc(report.departureMs)} />
          <Stat label="Arrival" value={formatUtc(report.arrivalMs)} />
          <Stat label="Duration" value={formatDurationHr(report.durationHr)} />
          <Stat label="Route Changes" value={String(report.routeChanges)} />
        </div>
      </div>

      <VoyageReplay key={report.voyageId} report={report} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Voyage Summary">
          <MetricRow label="Maximum Risk" value={report.maxRisk.toFixed(0)} />
          <MetricRow label="Average Risk" value={report.averageRisk.toFixed(0)} />
          <MetricRow label="Final Risk" value={report.finalRisk.toFixed(0)} />
          <MetricRow label="Weather Events" value={report.weatherEvents} />
          <MetricRow label="Security Events" value={report.securityEvents} />
          <MetricRow label="Risk Reduction from Rerouting" value={report.riskReductionFromRerouting.toFixed(0)} />
        </Panel>
        <PlannedVsActual data={report.plannedVsActual} />
      </div>

      <Panel title="Risk vs Time">
        <RiskHistoryChart telemetry={report.telemetryHistory} events={report.events} />
      </Panel>

      <Panel title="Modelled Fuel Consumption">
        <FuelHistoryChart
          telemetry={report.telemetryHistory}
          plannedTotalFuelTonnes={report.plannedVsActual.plannedFuelTonnes}
          plannedDurationHr={(report.plannedVsActual.plannedEtaMs - report.departureMs) / 3_600_000}
          departureMs={report.departureMs}
        />
      </Panel>

      <RouteHistoryTimeline versions={report.routeVersions} />

      <CounterfactualPanel result={report.counterfactual} />

      <Panel title="Voyage Event Log">
        <EventLogTable events={report.events} />
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-hull-300">{label}</div>
      <div className="mono-num text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}
