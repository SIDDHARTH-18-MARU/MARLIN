import type { ReactNode } from 'react';
import type { Route } from '@/types';
import { formatDurationHr, formatKm } from '@/utils/format';
import { riskTone } from '@/components/ui/statusTones';

const ROW_TONE_BG: Record<string, string> = { ok: 'text-ok', info: 'text-info', warn: 'text-warn', crit: 'text-crit', neutral: 'text-slate-300' };

export function RouteComparisonTable({ routes }: { routes: Route[] }) {
  const rows: [string, (r: Route) => ReactNode][] = [
    ['Distance', (r) => formatKm(r.metrics.distanceKm)],
    ['Duration', (r) => formatDurationHr(r.metrics.durationHr)],
    ['Modelled Fuel', (r) => `${r.metrics.fuelTonnes.toFixed(1)} t`],
    ['Risk', (r) => <span className={ROW_TONE_BG[riskTone(r.metrics.risk.total)]}>{r.metrics.risk.total.toFixed(0)}</span>],
    ['Security Exposure', (r) => `${r.metrics.securityExposure.toFixed(0)}`],
    ['Weather Exposure', (r) => `${r.metrics.weatherExposure.toFixed(0)}`],
    ['Illustrative confidence (0–24h)', (r) => `${r.metrics.forecastConfidence.h0_24}%`],
  ];

  return (
    <div className="overflow-x-auto focus-visible:outline focus-visible:outline-cyan-glow" role="region" aria-label="Scrollable route metrics" tabIndex={0}>
      <table className="w-full min-w-[560px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-40 pb-2 text-left text-[10px] uppercase tracking-wide text-hull-300"> </th>
            {routes.map((r) => (
              <th key={r.id} className="pb-2 text-left text-[11px] font-bold" style={{ color: r.color }}>
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, fn]) => (
            <tr key={label} className="border-t border-hull-600/30">
              <td className="py-1.5 text-[11px] text-hull-300">{label}</td>
              {routes.map((r) => (
                <td key={r.id} className="mono-num py-1.5 font-semibold text-slate-100">
                  {fn(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
