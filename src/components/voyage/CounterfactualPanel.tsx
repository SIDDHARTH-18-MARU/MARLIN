import type { CounterfactualResult } from '@/types';
import { Panel } from '@/components/ui/Panel';
import { signed } from '@/utils/format';

export function CounterfactualPanel({ result }: { result: CounterfactualResult }) {
  if (!result.adoptedDetours) {
    return <Panel title="What If We Did Not Reroute?"><p className="text-xs text-hull-300">{result.narrative}</p></Panel>;
  }
  return (
    <Panel title="What If We Did Not Reroute?" right={<span className="text-[10px] uppercase tracking-wide text-hull-300">Simulated Counterfactual</span>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-ok/30 bg-ok/5 p-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-ok">Actual Adaptive Route</div>
          <Stat label="Risk" value={result.actual.risk.toFixed(0)} />
          <Stat label="ETA" value={`${signed(result.actual.etaDeltaHr, 1)}h`} />
          <Stat label="Fuel" value={`${signed(result.actual.fuelDeltaPct, 1)}%`} />
        </div>
        <div className="rounded-md border border-crit/30 bg-crit/5 p-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-crit">Retain Assigned Route</div>
          <Stat label="Risk" value={result.noReroute.risk.toFixed(0)} />
          <Stat label="ETA" value={`${signed(result.noReroute.etaDeltaHr, 1)}h`} />
          <Stat label="Fuel" value={`${signed(result.noReroute.fuelDeltaPct, 1)}%`} />
        </div>
      </div>
      <p className="mt-3 border-t border-hull-600/40 pt-2.5 text-xs leading-relaxed text-hull-200">{result.narrative}</p>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-hull-300">{label}</span>
      <span className="mono-num font-semibold text-slate-100">{value}</span>
    </div>
  );
}
