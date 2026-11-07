import { useNavigate } from 'react-router-dom';
import { useVoyageStore } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { CesiumGlobe } from '@/components/map/CesiumGlobe';
import { LayerControlPanel } from '@/components/map/LayerControlPanel';
import { RouteCard } from '@/components/routes/RouteCard';
import { RouteComparisonTable } from '@/components/routes/RouteComparisonTable';
import { WhyThisRoutePanel } from '@/components/routes/WhyThisRoutePanel';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';

export function RouteAnalysis() {
  const navigate = useNavigate();
  const { routes, activeRouteId, selectRoute, vessel, origin, destination, status } = useVoyageStore();
  const beginVoyage = useVoyageStore((s) => s.beginVoyage);
  const initFromActiveRoute = useSimulationStore((s) => s.initFromActiveRoute);
  if (status === 'underway' || status === 'complete') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-hull-300">This route has already been assigned. Open the voyage to review its current route.</p>
        <Button variant="primary" onClick={() => navigate('/command-center')}>Open Command Center</Button>
      </div>
    );
  }

  if (!routes) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-sm font-semibold text-slate-100">No routes calculated yet</div>
        <p className="max-w-sm text-xs text-hull-300">Configure a voyage in Plan Voyage to generate candidate routes.</p>
        <Button variant="primary" onClick={() => navigate('/plan')}>
          Go to Plan Voyage
        </Button>
      </div>
    );
  }

  const active = routes.find((r) => r.id === activeRouteId) ?? routes[0];
  const fastest = routes.find((r) => r.kind === 'fastest');

  const handleProceed = () => {
    beginVoyage();
    initFromActiveRoute();
    navigate('/command-center');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="relative h-72 shrink-0 lg:h-full lg:min-w-0 lg:flex-1">
        <CesiumGlobe />
        <div className="pointer-events-none absolute inset-0 hidden items-start justify-between p-3 lg:flex">
          <div className="pointer-events-auto">
            <LayerControlPanel />
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-3 border-l border-hull-600/40 bg-hull-950/60 p-3 lg:w-[390px] lg:overflow-y-auto">
        <div className="text-xs text-hull-300">
          {vessel.name} · {origin.name} <span className="text-hull-500">&rarr;</span> {destination.name}
        </div>

        <details className="rounded-md border border-hull-600/40 bg-hull-900 px-3 py-2 lg:hidden">
          <summary className="cursor-pointer py-1 text-sm font-medium text-slate-100">Map layers</summary>
          <div className="pt-2"><LayerControlPanel /></div>
        </details>

        <div className="flex flex-col gap-2.5">
          {routes.map((r) => (
            <RouteCard key={r.id} route={r} selected={r.id === active.id} onSelect={() => selectRoute(r.id)} />
          ))}
        </div>

        <Panel title="Route Comparison">
          <RouteComparisonTable routes={routes} />
        </Panel>

        <WhyThisRoutePanel route={active} comparedTo={active.id === fastest?.id ? routes.find((r) => r.kind === 'high-risk') : fastest} />

        <Button variant="primary" onClick={handleProceed} className="py-2.5 text-sm">
          Select Route &amp; Enter Command Center
        </Button>
      </div>
    </div>
  );
}
