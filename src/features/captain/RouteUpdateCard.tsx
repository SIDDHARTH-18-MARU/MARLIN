/**
 * The captain-side terminus of the dynamic rerouting sequence.
 *
 * ACKNOWLEDGE calls the same `approveReroute` the Control Room calls, so the
 * vessel visibly changes course on both faces. KEEP holds the current route
 * and is recorded in the counterfactual log.
 *
 * Both buttons perform real actions — no dead buttons.
 */

import { AlertTriangle, Check } from 'lucide-react';
import { useSimulationStore } from '@/stores/simulationStore';
import { Button, RiskTag } from '@/components/ui/Glass';
import { riskBand } from './bridgeTypes';

export function RouteUpdateCard({ compact = false }: { compact?: boolean }) {
  const decision = useSimulationStore((s) => s.decisionPending);
  const isRecalculating = useSimulationStore((s) => s.isRecalculating);
  const approveReroute = useSimulationStore((s) => s.approveReroute);
  const keepCurrentRoute = useSimulationStore((s) => s.keepCurrentRoute);
  const versionCount = useSimulationStore((s) => s.routeVersions.length);

  if (isRecalculating) {
    return (
      <div
        className="glass rounded-lg border-signal/40 p-3 flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <span className="mono text-xs text-signal">RECALCULATING ROUTE…</span>
      </div>
    );
  }

  if (!decision) {
    if (compact || versionCount <= 1) return null;
    return (
      <div
        className="glass rounded-lg border-calm/40 p-3 flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <Check size={15} className="text-calm shrink-0" />
        <div>
          <div className="mono text-xs text-calm">ROUTE UPDATE ACKNOWLEDGED</div>
          <div className="text-[11px] text-mist mt-0.5">
            The approved route is active. Course change in progress.
          </div>
        </div>
      </div>
    );
  }

  const etaDeltaMin = Math.round(
    (decision.newRoute.metrics.etaMs - decision.oldEtaMs) / 60_000,
  );
  const newRisk = Math.round(decision.newRoute.metrics.risk.peak);
  const oldRisk = Math.round(decision.oldRisk);

  return (
    <div
      className="glass rounded-lg border-alarm/50 pulse-alarm overflow-hidden"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <header className="flex items-center gap-2 px-3 py-2 bg-alarm/10 border-b border-alarm/30">
        <AlertTriangle size={14} className="text-alarm shrink-0" />
        <h3 className="mono text-[11px] tracking-wider text-alarm">ROUTE UPDATE</h3>
      </header>

      <div className="p-3 space-y-2">
        <p className="text-xs text-chalk leading-snug">
          Control Room recommends a new route.
        </p>

        <div className="space-y-1">
          <div>
            <span className="label">Reason</span>
            <p className="mono text-xs text-chalk">{decision.reason}</p>
          </div>

          <div className="flex gap-5 pt-1">
            <div>
              <span className="label">ETA change</span>
              <p className="mono text-xs text-caution">
                {etaDeltaMin >= 0 ? '+' : ''}
                {etaDeltaMin} min
              </p>
            </div>
            <div>
              <span className="label">Risk</span>
              <p className="mono text-xs flex items-center gap-1">
                <span className="text-mist">{oldRisk}</span>
                <span className="text-mist">→</span>
                <RiskTag band={riskBand(newRisk)} />
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={keepCurrentRoute} className="flex-1">
            Keep current
          </Button>
          <Button variant="accept" onClick={approveReroute} className="flex-1">
            Acknowledge
          </Button>
        </div>
      </div>
    </div>
  );
}
