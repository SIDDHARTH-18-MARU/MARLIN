import { useEffect, useState } from 'react';
import { RouteSketch } from '@/components/map/RouteSketch';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import type { VoyageReport } from '@/types';
import { formatCoord, formatUtc } from '@/utils/format';

export function VoyageReplay({ report }: { report: VoyageReport }) {
  const samples = report.telemetryHistory;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = samples.length - 1;
  const sample = samples[index];
  const route = report.routeVersions.find(version => version.version === sample?.routeVersion)?.route;

  useEffect(() => {
    if (!playing || index >= last) return;
    const timer = window.setTimeout(() => {
      setIndex(index + 1);
      if (index + 1 === last) setPlaying(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [index, last, playing]);

  return (
    <Panel title="Recorded Voyage Replay">
      {sample && route ? (
        <div className="grid gap-3 md:grid-cols-2">
          <RouteSketch routes={[route]} position={sample.position} />
          <div className="space-y-3 self-center text-sm">
            <p className="text-hull-300">Replay reads recorded synthetic samples. The active voyage stays independent.</p>
            <p className="mono-num">{formatUtc(sample.timestampMs)} · Route v{sample.routeVersion}</p>
            <p>{formatCoord(sample.position.lat, sample.position.lon)} · Risk {sample.risk} · Fuel {sample.fuelUsedTonnes.toFixed(1)} t</p>
            <label className="block text-hull-300">
              Recorded sample {index + 1} of {samples.length}
              <input className="block w-full accent-cyan-mid" type="range" min={0} max={last}
                value={index} onChange={event => {
                  setPlaying(false);
                  setIndex(event.currentTarget.valueAsNumber);
                }} />
            </label>
            <Button variant="secondary" disabled={last < 1} onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (index === last) setIndex(0);
                setPlaying(true);
              }
            }}>{playing ? 'Pause replay' : 'Play replay'}</Button>
          </div>
        </div>
      ) : <p className="text-sm text-hull-300">No telemetry samples are available for this report.</p>}
    </Panel>
  );
}
