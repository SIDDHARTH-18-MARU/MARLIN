import { useNavigate } from 'react-router-dom';
import { CloudLightning, ShieldAlert } from 'lucide-react';
import { useVoyageStore } from '@/stores/voyageStore';
import { MAX_HAZARDS_PER_TYPE, useSimulationStore } from '@/stores/simulationStore';
import { CesiumGlobe } from '@/components/map/CesiumGlobe';
import { LayerControlPanel } from '@/components/map/LayerControlPanel';
import { CameraModeControl } from '@/components/map/CameraModeControl';
import { TelemetryPanel } from '@/components/telemetry/TelemetryPanel';
import { RiskPanel } from '@/components/telemetry/RiskPanel';
import { SimulationTimeline } from '@/components/simulation/SimulationTimeline';
import { DecisionPanel } from '@/components/simulation/DecisionPanel';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export function CommandCenter() {
  const navigate = useNavigate();
  const { status, vessel, origin, destination } = useVoyageStore();
  const routeVersions = useSimulationStore((s) => s.routeVersions);
  const activeVersionIndex = useSimulationStore((s) => s.activeVersionIndex);
  const decisionPending = useSimulationStore((s) => s.decisionPending);
  const isRecalculating = useSimulationStore((s) => s.isRecalculating);
  const triggerWeatherEvent = useSimulationStore((s) => s.triggerWeatherEvent);
  const triggerSecurityEvent = useSimulationStore((s) => s.triggerSecurityEvent);
  const activeStorms = useSimulationStore((s) => s.activeStorms);
  const activeSecurityZones = useSimulationStore((s) => s.activeSecurityZones);
  const report = useSimulationStore((s) => s.report);
  const telemetryHistory = useSimulationStore((s) => s.telemetryHistory);
  const latestEvent = useSimulationStore((s) => s.events.at(-1));
  const latestBridgeReport = useSimulationStore((s) => s.messages.findLast(message => message.direction === 'captain-to-control'));
  const latestTelemetry = telemetryHistory[telemetryHistory.length - 1];

  if (status !== 'underway' && status !== 'complete') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-sm font-semibold text-slate-100">No voyage in progress</div>
        <p className="max-w-sm text-xs text-hull-300">Plan a voyage and select a route before entering the Command Center.</p>
        <Button variant="primary" onClick={() => navigate('/plan')}>
          Plan Voyage
        </Button>
      </div>
    );
  }

  const version = routeVersions[activeVersionIndex];
  const busy = Boolean(decisionPending) || isRecalculating;

  return (
    <div className="relative h-full overflow-y-auto lg:overflow-hidden">
      <DecisionPanel />
      <div className="h-72 lg:absolute lg:inset-0 lg:h-full"><CesiumGlobe /></div>

      <div className="flex flex-col lg:pointer-events-none lg:absolute lg:inset-0">
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:flex lg:flex-1 lg:justify-between">
          <div className="pointer-events-auto flex min-w-0 flex-col gap-3 lg:w-64 xl:w-72">
            <Panel title="Current Voyage" right={<Badge tone={status === 'complete' ? 'ok' : 'info'}>Route v{version?.version}</Badge>}>
              <div className="mb-2 text-sm font-bold text-slate-100">{vessel.name}</div>
              <div className="mb-3 text-xs text-hull-300">
                {origin.name} <span className="text-hull-500">&rarr;</span> {destination.name}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  disabled={busy || status === 'complete' || activeStorms.length >= MAX_HAZARDS_PER_TYPE}
                  onClick={triggerWeatherEvent}
                  icon={<CloudLightning size={14} />}
                >
                  Simulate Weather Event
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || status === 'complete' || activeSecurityZones.length >= MAX_HAZARDS_PER_TYPE}
                  onClick={triggerSecurityEvent}
                  icon={<ShieldAlert size={14} />}
                >
                  Simulate Security Disruption
                </Button>
              </div>
              {(activeStorms.length > 0 || activeSecurityZones.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-hull-600/40 pt-2.5">
                  {activeStorms.length > 0 && <Badge tone="warn">{activeStorms.length} Active Storm(s)</Badge>}
                  {activeSecurityZones.length > 0 && <Badge tone="crit">{activeSecurityZones.length} Security Scenario(s)</Badge>}
                </div>
              )}
              {latestEvent?.description.startsWith('No lower-risk detour') && (
                <p role="status" className="mt-2 text-xs text-hull-300">{latestEvent.description}</p>
              )}
            </Panel>
            {latestBridgeReport && (
              <Panel title="Latest simulated bridge report">
                <p className="break-words text-xs text-slate-200">{latestBridgeReport.body}</p>
              </Panel>
            )}
            <LayerControlPanel />
          </div>

          <div className="pointer-events-auto flex min-w-0 flex-col items-start gap-3 lg:items-end">
            <CameraModeControl />
            <TelemetryPanel />
            {latestTelemetry && <RiskPanel risk={latestTelemetry.riskBreakdown} />}
          </div>
        </div>

        {status === 'complete' && report && (
          <div className="pointer-events-auto flex justify-center pb-2">
            <Button variant="primary" onClick={() => navigate('/history')} className="px-5 py-2 text-sm">
              View Voyage Report
            </Button>
          </div>
        )}

        <div className="pointer-events-auto min-h-24 border-t border-hull-600/40 bg-hull-950/85 backdrop-blur">
          <SimulationTimeline />
        </div>
      </div>
    </div>
  );
}
