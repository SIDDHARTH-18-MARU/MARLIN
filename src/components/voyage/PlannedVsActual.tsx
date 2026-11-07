import type { PlannedVsActual as PlannedVsActualT } from '@/types';
import { Panel } from '@/components/ui/Panel';
import { formatKm, formatUtc, signed } from '@/utils/format';

export function PlannedVsActual({ data }: { data: PlannedVsActualT }) {
  const distDeltaPct = ((data.actualDistanceKm - data.plannedDistanceKm) / Math.max(1, data.plannedDistanceKm)) * 100;
  const fuelDeltaPct = ((data.actualFuelTonnes - data.plannedFuelTonnes) / Math.max(0.1, data.plannedFuelTonnes)) * 100;

  return (
    <Panel title="Planned vs Actual" right={<span className="text-[10px] uppercase tracking-wide text-hull-300">Simulated / Modelled Values</span>}>
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <Header label="" />
        <Header label="Planned" />
        <Header label="Actual / Simulated" />

        <Row label="Distance" planned={formatKm(data.plannedDistanceKm)} actual={formatKm(data.actualDistanceKm)} delta={`${signed(distDeltaPct, 1)}%`} />
        <Row label="ETA" planned={formatUtc(data.plannedEtaMs)} actual={formatUtc(data.actualEtaMs)} delta={`${signed((data.actualEtaMs - data.plannedEtaMs) / 3_600_000, 1)}h`} />
        <Row label="Fuel" planned={`${data.plannedFuelTonnes.toFixed(1)} t`} actual={`${data.actualFuelTonnes.toFixed(1)} t`} delta={`${signed(fuelDeltaPct, 1)}%`} />
        <Row label="Route Changes" planned={String(data.plannedRouteChanges)} actual={String(data.actualRouteChanges)} delta={null} />
      </div>
    </Panel>
  );
}

function Header({ label }: { label: string }) {
  return <div className="text-[10px] font-bold uppercase tracking-widest text-hull-300">{label}</div>;
}

function Row({ label, planned, actual, delta }: { label: string; planned: string; actual: string; delta: string | null }) {
  return (
    <>
      <div className="border-t border-hull-600/30 py-2 text-left text-[11px] text-hull-300">{label}</div>
      <div className="mono-num border-t border-hull-600/30 py-2 font-semibold text-slate-100">{planned}</div>
      <div className="mono-num border-t border-hull-600/30 py-2 font-semibold text-cyan-glow">
        {actual}
        {delta && <div className="text-[10px] font-normal text-hull-300">{delta}</div>}
      </div>
    </>
  );
}
