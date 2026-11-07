/**
 * /captain/alerts
 *
 * Vessel-scoped alerts derived from the voyage event log, severity-graded
 * INFO → CRITICAL. Events are appended by the simulation as the voyage runs,
 * so the list grows in step with the Control Room's timeline.
 *
 * Acknowledgement is bridge-local: the underlying event log is the voyage
 * record and is never mutated from here.
 */

import clsx from 'clsx';
import { Info, AlertTriangle, TriangleAlert, Siren } from 'lucide-react';
import { Button, EmptyState, GlassPanel, SeverityTag } from '@/components/ui/Glass';
import { useSimulationStore } from '@/stores/simulationStore';
import { formatSimClock, type AlertSeverity } from './bridgeTypes';
import { useBridgeAlerts } from './bridgeAdapter';

const ICON: Record<AlertSeverity, typeof Info> = {
  INFO: Info,
  ADVISORY: AlertTriangle,
  WARNING: TriangleAlert,
  CRITICAL: Siren,
};

const TONE: Record<AlertSeverity, string> = {
  INFO: 'text-signal border-signal/30',
  ADVISORY: 'text-caution border-caution/30',
  WARNING: 'text-alarm border-alarm/40',
  CRITICAL: 'text-critical border-critical/60',
};

export function AlertPanel() {
  const alerts = useBridgeAlerts();
  // Acknowledgement lives in the shared simulation store, not local state, so
  // clearing an alert here also clears it in the Control Room.
  const acknowledgeEvent = useSimulationStore((s) => s.acknowledgeEvent);

  const active = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="h-full overflow-y-auto p-2 grid gap-2 lg:grid-cols-[1fr_240px] items-start">
      <GlassPanel title={`Vessel alerts · ${active.length} active`}>
        {alerts.length === 0 ? (
          <EmptyState message="No alerts raised for this vessel. Start voyage playback to review incoming events." />
        ) : (
          <ul className="space-y-2">
            {alerts
              .slice()
              .reverse()
              .map((a) => {
                const Icon = ICON[a.severity];
                const done = a.acknowledged;
                return (
                  <li
                    key={a.id}
                    className={clsx(
                      'rounded border p-3 transition-opacity',
                      TONE[a.severity],
                      done && 'opacity-45',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon size={16} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeverityTag severity={a.severity} />
                          <span className="mono text-xs text-chalk">{a.title}</span>
                          <span className="mono text-[10px] text-mist ml-auto">
                            {formatSimClock(a.raisedAtMinute)}
                          </span>
                        </div>

                        <p className="text-xs text-chalk/90 mt-1.5 leading-snug">
                          {a.description}
                        </p>

                        {a.impact && (
                          <p className="mono text-[11px] text-mist mt-1.5">{a.impact}</p>
                        )}

                        {a.actionTaken && (
                          <div className="mt-2 pt-2 border-t border-steel/40">
                            <span className="label">Action taken</span>
                            <p className="text-xs text-chalk/90 mt-0.5">{a.actionTaken}</p>
                          </div>
                        )}

                        {!done && (
                          <div className="mt-2.5">
                            <Button onClick={() => acknowledgeEvent(a.id)}>
                              Acknowledge
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </GlassPanel>

      <GlassPanel title="Severity key">
        <ul className="space-y-2">
          {(['INFO', 'ADVISORY', 'WARNING', 'CRITICAL'] as AlertSeverity[]).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <SeverityTag severity={s} />
              <span className="text-[11px] text-mist">
                {s === 'INFO'
                  ? 'No action needed'
                  : s === 'ADVISORY'
                    ? 'Be aware'
                    : s === 'WARNING'
                      ? 'Review and consider action'
                      : 'Immediate action required'}
              </span>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
