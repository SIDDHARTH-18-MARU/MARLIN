import { Check, X } from 'lucide-react';
import type { Route } from '@/types';
import { Panel } from '@/components/ui/Panel';
import { signed } from '@/utils/format';

export function WhyThisRoutePanel({ route, comparedTo }: { route: Route; comparedTo?: Route }) {
  const riskDelta = comparedTo ? route.metrics.risk.total - comparedTo.metrics.risk.total : null;
  const etaDeltaHr = comparedTo ? route.metrics.durationHr - comparedTo.metrics.durationHr : null;
  const fuelDeltaPct = comparedTo
    ? ((route.metrics.fuelTonnes - comparedTo.metrics.fuelTonnes) / Math.max(0.1, comparedTo.metrics.fuelTonnes)) * 100
    : null;

  return (
    <Panel title="Why This Route?">
      <ul className="flex flex-col gap-1.5">
        {route.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            {r.positive ? <Check size={14} className="mt-0.5 shrink-0 text-ok" /> : <X size={14} className="mt-0.5 shrink-0 text-warn" />}
            <span className={r.positive ? 'text-slate-200' : 'text-warn'}>{r.label}</span>
          </li>
        ))}
      </ul>

      {comparedTo && riskDelta !== null && (
        <div className="mt-3 border-t border-hull-600/40 pt-2.5">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-hull-300">
            Trade-off vs. {comparedTo.label}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <TradeoffStat label="Risk" value={`${comparedTo.metrics.risk.total.toFixed(0)} → ${route.metrics.risk.total.toFixed(0)}`} good={riskDelta! <= 0} />
            <TradeoffStat label="ETA" value={`${signed(etaDeltaHr!, 1)}h`} good={etaDeltaHr! <= 0} />
            <TradeoffStat label="Fuel" value={`${signed(fuelDeltaPct!, 1)}%`} good={fuelDeltaPct! <= 0} />
          </div>
        </div>
      )}
    </Panel>
  );
}

function TradeoffStat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded bg-hull-800/60 px-2 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wide text-hull-300">{label}</div>
      <div className={`mono-num text-sm font-bold ${good ? 'text-ok' : 'text-warn'}`}>{value}</div>
    </div>
  );
}
