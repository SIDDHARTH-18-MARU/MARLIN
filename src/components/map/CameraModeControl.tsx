import { useMapStore } from '@/stores/mapStore';
import type { CameraMode } from '@/types';
import clsx from 'clsx';

const MODES: { key: CameraMode; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'follow', label: 'Follow' },
  { key: 'chase', label: 'Chase' },
  { key: 'tactical', label: 'Tactical' },
  { key: 'free', label: 'Free' },
];

export function CameraModeControl() {
  const cameraMode = useMapStore((s) => s.cameraMode);
  const setCameraMode = useMapStore((s) => s.setCameraMode);

  return (
    <div role="group" aria-label="3D globe camera mode" className="glass-panel flex flex-wrap gap-0.5 rounded-lg p-1">
      {MODES.map((m) => (
        <button
          key={m.key}
          aria-pressed={cameraMode === m.key}
          onClick={() => setCameraMode(m.key)}
          className={clsx(
            'rounded px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
            cameraMode === m.key ? 'bg-cyan-mid/20 text-cyan-glow' : 'text-hull-300 hover:bg-hull-700/50 hover:text-slate-100',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
