import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { riskLabel, riskTone } from '@/components/ui/statusTones';
import type { RouteRiskBreakdown } from '@/types';

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="text-hull-300">{label}</span>
        <span className="mono-num text-slate-200">{value.toFixed(0)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-hull-700/70">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, value)}%`, background: barColor(value) }}
        />
      </div>
    </div>
  );
}

function barColor(v: number) {
  if (v < 25) return '#33cc7a';
  if (v < 50) return '#3aa0ff';
  if (v < 75) return '#f2b53d';
  return '#ff4d4f';
}

export function RiskPanel({ risk }: { risk: RouteRiskBreakdown }) {
  return (
    <Panel title="Current Risk" right={<Badge tone={riskTone(risk.total)}>{riskLabel(risk.total)}</Badge>}>
      <div className="mb-3 flex items-baseline gap-1.5">
        <span className="mono-num text-3xl font-bold text-slate-100">{risk.total.toFixed(0)}</span>
        <span className="text-xs text-hull-300">/ 100</span>
      </div>
      <Bar label="Weather" value={risk.weather} />
      <Bar label="Waves" value={risk.wave} />
      <Bar label="Current" value={risk.current} />
      <Bar label="Security" value={risk.security} />
      <p className="mt-2 border-t border-hull-600/40 pt-2 text-[10.5px] leading-snug text-hull-300">
        Risk Score is a modeled decision-support indicator, not an accident probability.
      </p>
    </Panel>
  );
}
