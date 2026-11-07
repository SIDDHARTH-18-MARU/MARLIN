import { Pause, Play, RotateCcw } from 'lucide-react';
import { useSimulationStore } from '@/stores/simulationStore';
import { useMapStore } from '@/stores/mapStore';
import { Button } from '@/components/ui/Button';
import { severityTone } from '@/components/ui/statusTones';
import { formatDurationHr } from '@/utils/format';
import clsx from 'clsx';

const SPEEDS = [1, 2, 5, 10, 20];

const SEVERITY_DOT: Record<string, string> = { ok: 'bg-ok', info: 'bg-info', warn: 'bg-warn', crit: 'bg-crit', neutral: 'bg-hull-400' };

export function SimulationTimeline() {
  const simTimeMs = useSimulationStore((s) => s.simTimeMs);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const speedMultiplier = useSimulationStore((s) => s.speedMultiplier);
  const play = useSimulationStore((s) => s.play);
  const pause = useSimulationStore((s) => s.pause);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);
  const routeVersions = useSimulationStore((s) => s.routeVersions);
  const activeVersionIndex = useSimulationStore((s) => s.activeVersionIndex);
  const events = useSimulationStore((s) => s.events);
  const focusOn = useMapStore((s) => s.focusOn);

  const version = routeVersions[activeVersionIndex];
  if (!version) return null;

  const departureMs = routeVersions[0].createdAtMs;
  const totalSpanMs = Math.max(1, version.route.metrics.etaMs - departureMs);
  const progress = Math.min(1, Math.max(0, (simTimeMs - departureMs) / totalSpanMs));
  const totalDays = Math.max(1, Math.ceil(totalSpanMs / 86_400_000));
  const visibleDays = Math.min(5, totalDays + 1);

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={progress >= 1} onClick={() => (isPlaying ? pause() : play())} icon={isPlaying ? <Pause size={13} /> : <Play size={13} />}>
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button variant="ghost" onClick={resetSimulation} icon={<RotateCcw size={13} />}>
          Reset
        </Button>
        <div className="flex gap-1 border-l border-hull-600/40 pl-3">
          {SPEEDS.map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeed(sp)}
              aria-pressed={speedMultiplier === sp}
              className={clsx(
                'rounded px-2 py-1 text-[10px] font-bold',
                speedMultiplier === sp ? 'bg-cyan-mid/20 text-cyan-glow' : 'text-hull-300 hover:bg-hull-700/50',
              )}
            >
              {sp}X
            </button>
          ))}
        </div>
        <div className="ml-auto text-[11px] text-hull-300">
          Elapsed <span className="mono-num text-slate-100">{formatDurationHr((simTimeMs - departureMs) / 3_600_000)}</span> of{' '}
          <span className="mono-num text-slate-100">{formatDurationHr(totalSpanMs / 3_600_000)}</span>
        </div>
      </div>

      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-3.5 h-1.5 rounded-full bg-hull-700/70">
          <div className="h-full rounded-full bg-cyan-mid" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-between px-0.5 text-[9px] uppercase tracking-wide text-hull-400">
          {Array.from({ length: visibleDays }).map((_, i) => (
            <span key={i}>Day {Math.round(i * totalDays / (visibleDays - 1)) + 1}</span>
          ))}
        </div>
        {events.map((e) => {
          const f = Math.min(1, Math.max(0, (e.timestampMs - departureMs) / totalSpanMs));
          return (
            <button
              key={e.id}
              onClick={() => focusOn(e.location)}
              title={`${e.type} — ${e.description}`}
              className={clsx('absolute top-2 h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-2 ring-hull-950', SEVERITY_DOT[severityTone(e.severity)])}
              style={{ left: `${f * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
