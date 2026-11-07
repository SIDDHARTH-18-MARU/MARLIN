import { Anchor } from 'lucide-react';
import { useVoyageStore } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { formatUtc } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';

export function TopCommandBar() {
  const { origin, destination, status, vessel } = useVoyageStore();
  const simTimeMs = useSimulationStore((s) => s.simTimeMs);
  const activeStorms = useSimulationStore((s) => s.activeStorms);
  const activeZones = useSimulationStore((s) => s.activeSecurityZones);
  const departureMs = useVoyageStore((s) => s.departureMs);

  const displayTimeMs = status === 'underway' || status === 'complete' ? simTimeMs : departureMs;
  const weatherStable = activeStorms.length === 0;
  const securityNormal = activeZones.length === 0;

  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-hull-600/40 bg-hull-950/90 px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-cyan-mid/15 text-cyan-glow">
          <Anchor size={18} strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-widest text-slate-100">MARLIN</div>
          <div className="text-[10px] uppercase tracking-wider text-hull-300">Maritime Operations Center</div>
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        {status === 'underway' && (
          <span className="mono-num flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-crit">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-crit" /> Live simulation
          </span>
        )}
        <span className="text-xs font-semibold text-slate-200">
          Voyage — {vessel.name} · {origin.name} <span className="text-hull-300">&rarr;</span> {destination.name}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden flex-col items-end leading-tight lg:flex">
          <span className="text-[9px] uppercase tracking-widest text-hull-300">Simulation Time</span>
          <span className="mono-num text-xs font-semibold text-slate-100">{formatUtc(displayTimeMs)}</span>
        </div>
        <div className="hidden items-center gap-2 xl:flex">
          <Badge tone={weatherStable ? 'ok' : 'warn'}>Weather {weatherStable ? 'Stable' : 'Active'}</Badge>
          <Badge tone={securityNormal ? 'ok' : 'crit'}>Security {securityNormal ? 'Normal' : 'Elevated'}</Badge>
        </div>
        <Badge tone="info">Synthetic simulation</Badge>
      </div>
    </header>
  );
}
