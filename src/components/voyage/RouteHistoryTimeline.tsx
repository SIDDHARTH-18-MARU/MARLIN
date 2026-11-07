import type { RouteVersion } from '@/types';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { riskTone } from '@/components/ui/statusTones';
import { formatDurationHr, formatKm, formatUtc } from '@/utils/format';

export function RouteHistoryTimeline({ versions }: { versions: RouteVersion[] }) {
  return (
    <Panel title="Voyage Route History">
      <div className="flex flex-col">
        {versions.map((v, i) => (
          <div key={v.version} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: v.route.color, color: v.route.color }}>
                <span className="text-[10px] font-bold">v{v.version}</span>
              </div>
              {i < versions.length - 1 && <div className="my-1 w-px flex-1 bg-hull-600/50" />}
            </div>
            <div className="mb-5 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100">Route v{v.version}</span>
                <span className="text-xs text-hull-300">{v.reason}</span>
              </div>
              <div className="mono-num text-[11px] text-hull-300">{formatUtc(v.createdAtMs)}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                <span>Distance <b className="text-slate-100">{formatKm(v.route.metrics.distanceKm)}</b></span>
                <span>ETA <b className="text-slate-100">{formatDurationHr(v.route.metrics.durationHr)}</b></span>
                <span>Fuel <b className="text-slate-100">{v.route.metrics.fuelTonnes.toFixed(1)} t</b></span>
                <span>
                  Risk <Badge tone={riskTone(v.route.metrics.risk.total)}>{v.route.metrics.risk.total.toFixed(0)}</Badge>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
