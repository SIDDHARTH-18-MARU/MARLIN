import { Boxes } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { ASSET_REGISTRY } from '@/data/assetRegistry';
import { assetUrl } from '@/engine/assetUrl';

export function AssetLibrary() {
  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 pb-10">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-100">
            <Boxes size={18} className="text-cyan-glow" />
            3D Asset Library
          </h1>
          <p className="text-xs text-hull-300">
            Provenance and licensing for every 3D model MARLIN renders on the globe.
          </p>
        </div>

        <Panel title="Licensing Policy">
          <p className="text-xs leading-relaxed text-hull-200">
            Every vessel hull below is <b>procedurally generated in-project</b> by{' '}
            <code className="rounded bg-hull-800 px-1 py-0.5">scripts/generate-vessel-models.mjs</code> from simple box
            primitives by the MARLIN project. Both views use these same hulls. The globe uses local Natural Earth II imagery
            distributed with CesiumJS. Public distribution requires review of the project and bundled third-party notices.
          </p>
          <a href={assetUrl('notices/CesiumJS-LICENSE.md')} target="_blank" rel="noreferrer"
            className="mt-2 inline-block text-xs font-semibold text-cyan-glow">CesiumJS and bundled notices</a>
        </Panel>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ASSET_REGISTRY.map((asset) => (
            <div key={asset.id} className="glass-panel rounded-lg p-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-100">{asset.name}</span>
                <Badge tone="ok">{asset.licence.replace('_', ' ')}</Badge>
              </div>
              <p className="mb-2 text-[11px] text-hull-300">{asset.notes}</p>
              <div className="flex flex-col gap-1 text-[11px]">
                <Row label="Vessel Type" value={asset.vesselType} />
                <Row label="Format" value={asset.format.toUpperCase()} />
                <Row label="Source" value="Self-created (procedural)" />
                <Row label="Model Path" value={asset.modelPath} mono />
              </div>
              <p className="mt-2 border-t border-hull-600/40 pt-2 text-[10.5px] text-hull-400">{asset.attribution}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-hull-300">{label}</span>
      <span className={mono ? 'mono-num truncate text-slate-200' : 'text-slate-200'}>{value}</span>
    </div>
  );
}
