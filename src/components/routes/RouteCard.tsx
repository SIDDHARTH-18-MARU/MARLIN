import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Route } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { riskLabel, riskTone } from '@/components/ui/statusTones';
import { formatDurationHr, formatKm, formatUtc } from '@/utils/format';

const KIND_TONE = { recommended: 'ok', fastest: 'info', 'high-risk': 'crit' } as const;

export function RouteCard({ route, selected, onSelect }: { route: Route; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        'glass-panel w-full rounded-lg p-3.5 text-left transition-all',
        selected ? 'border-cyan-glow/60 ring-1 ring-cyan-glow/40' : 'hover:border-hull-400/40',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: route.color }} />
          <span className="text-sm font-bold text-slate-100">{route.label}</span>
        </div>
        <Badge tone={KIND_TONE[route.kind]}>{route.kind === 'high-risk' ? 'Alternative' : route.kind}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <Field label="Distance" value={formatKm(route.metrics.distanceKm)} />
        <Field label="Duration" value={formatDurationHr(route.metrics.durationHr)} />
        <Field label="ETA" value={formatUtc(route.metrics.etaMs)} />
        <Field label="Modelled Fuel" value={`${route.metrics.fuelTonnes.toFixed(1)} t`} />
        <Field
          label="Risk"
          value={
            <span className="flex items-center gap-1">
              {route.metrics.risk.total.toFixed(0)}
              <Badge tone={riskTone(route.metrics.risk.total)} className="px-1 py-0 text-[9px]">
                {riskLabel(route.metrics.risk.total)}
              </Badge>
            </span>
          }
        />
        <Field label="Security Exposure" value={`${route.metrics.securityExposure.toFixed(0)}/100`} />
      </div>

      {!route.metrics.withinRiskThreshold && (
        <div className="mt-2 rounded border border-warn/40 bg-warn/10 px-2 py-1 text-[10.5px] font-medium text-warn">
          Exceeds risk threshold with model tolerance
        </div>
      )}
    </button>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wide text-hull-300">{label}</div>
      <div className="mono-num font-semibold text-slate-100">{value}</div>
    </div>
  );
}
