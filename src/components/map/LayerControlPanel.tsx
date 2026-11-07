import { useMapStore } from '@/stores/mapStore';
import type { MapLayerState } from '@/types';
import { Layers } from 'lucide-react';

const LAYER_LABELS: { key: keyof MapLayerState; label: string; future?: boolean }[] = [
  { key: 'route', label: 'Route' },
  { key: 'vessel', label: 'Vessel' },
  { key: 'wind', label: 'Wind' },
  { key: 'waves', label: 'Waves' },
  { key: 'current', label: 'Ocean Current' },
  { key: 'risk', label: 'Risk' },
  { key: 'security', label: 'Maritime Security' },
  { key: 'storm', label: 'Storm Track' },
  { key: 'traffic', label: 'Simulated Traffic', future: true },
  { key: 'bathymetry', label: 'Bathymetry', future: true },
];

export function LayerControlPanel() {
  const layers = useMapStore((s) => s.layers);
  const toggle = useMapStore((s) => s.toggleLayer);

  return (
    <div className="glass-panel w-48 rounded-lg p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-hull-300">
        <Layers size={12} /> Map Layers
      </div>
      <p className="mb-1 px-1 text-[10px] text-hull-300">Layers apply to the 3D globe.</p>
      <div className="flex flex-col gap-0.5">
        {LAYER_LABELS.map(({ key, label, future }) => (
          <label
            key={key}
            className={`flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs ${future ? 'opacity-40' : 'hover:bg-hull-700/40'}`}
          >
            <span className="text-slate-200">{label}</span>
            {future ? (
              <span className="text-[9px] uppercase tracking-wide text-hull-400">Future</span>
            ) : (
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => toggle(key)}
                className="h-3.5 w-3.5 accent-cyan-mid"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
