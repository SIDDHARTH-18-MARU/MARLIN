import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSimulationStore } from '@/stores/simulationStore';
import { useMapStore } from '@/stores/mapStore';
import { Button } from '@/components/ui/Button';
import { signed } from '@/utils/format';

export function DecisionPanel() {
  const pending = useSimulationStore((s) => s.decisionPending);
  const isRecalculating = useSimulationStore((s) => s.isRecalculating);
  const approve = useSimulationStore((s) => s.approveReroute);
  const keep = useSimulationStore((s) => s.keepCurrentRoute);
  const focusOn = useMapStore((s) => s.focusOn);
  const dialog = useRef<HTMLDialogElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  function review() {
    if (!dialog.current?.open) dialog.current?.showModal();
    keepButton.current?.focus();
    setOpen(true);
  }

  useEffect(() => {
    if (pending) review();
  }, [pending]);

  function close() {
    dialog.current?.close();
    setOpen(false);
  }

  function decide(action: () => void) {
    close();
    action();
    if (document.activeElement === document.body || document.activeElement === reviewButton.current || document.activeElement?.closest('dialog')) {
      document.getElementById('control-main')?.focus();
    }
  }

  function dismiss() {
    close();
    requestAnimationFrame(() => reviewButton.current?.focus());
  }

  return (
    <>
      {isRecalculating && (
        <div role="status"
          className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center"
        >
          <div className="glass-panel rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide text-cyan-glow">
            RECALCULATING ROUTE FROM CURRENT POSITION...
          </div>
        </div>
      )}

      {pending && (
        <>
          <div hidden={open} className="fixed inset-x-0 bottom-5 z-40 text-center">
            <Button ref={reviewButton} variant="primary" onClick={review}>Review pending reroute</Button>
          </div>
          <dialog ref={dialog} aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); dismiss(); }}
            className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-[420px] overflow-y-auto rounded-lg bg-hull-950 text-slate-100 backdrop:bg-black/45">
          <div className="glass-panel rounded-lg border-crit/40 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 border-b border-hull-600/40 px-4 py-3">
              <AlertTriangle size={17} className="text-crit" />
              <h2 id={titleId} className="text-sm font-bold uppercase tracking-wide text-slate-100">Route change recommendation</h2>
            </div>

            <div className="px-4 py-3">
              <div className="mb-3 text-xs text-hull-300">
                Reason <span className="font-semibold text-slate-100">{pending.reason}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-hull-800/60 p-2.5">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-hull-300">Current Route</div>
                  <div className="mono-num text-lg font-bold text-crit">{pending.oldRisk.toFixed(0)}</div>
                  <div className="text-[10px] text-hull-300">Modeled risk</div>
                </div>
                <div className="rounded-md bg-hull-800/60 p-2.5">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-hull-300">Recommended Route</div>
                  <div className="mono-num text-lg font-bold text-ok">{pending.newRoute.metrics.risk.peak.toFixed(0)}</div>
                  <div className="text-[10px] text-hull-300">Modeled risk</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-md bg-hull-800/40 px-3 py-2 text-xs">
                <span className="text-hull-300">Trade-off</span>
                <span className="mono-num font-semibold text-slate-100">
                  ETA {signed((pending.newRoute.metrics.etaMs - pending.oldEtaMs) / 3_600_000, 1)}h · Fuel{' '}
                  {signed(((pending.newRoute.metrics.fuelTonnes - pending.oldFuelTonnes) / Math.max(0.1, pending.oldFuelTonnes)) * 100, 1)}%
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-hull-600/40 px-4 py-3">
              <Button variant="ghost" onClick={() => {
                focusOn(pending.newRoute.waypoints[0]);
                dismiss();
              }} className="flex-1">
                View map
              </Button>
              <Button ref={keepButton} variant="secondary" onClick={() => decide(keep)} className="flex-1">
                Keep Current
              </Button>
              <Button variant="success" onClick={() => decide(approve)} className="flex-1">
                Approve Reroute
              </Button>
            </div>
          </div>
          </dialog>
        </>
      )}
    </>
  );
}
