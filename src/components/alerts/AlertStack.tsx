import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { useSimulationStore } from '@/stores/simulationStore';
import { severityTone } from '@/components/ui/statusTones';
import type { VoyageEvent } from '@/types';
import clsx from 'clsx';

const ICONS: Record<VoyageEvent['severity'], typeof Info> = {
  INFO: Info,
  ADVISORY: Info,
  WARNING: AlertTriangle,
  CRITICAL: ShieldAlert,
  SUCCESS: CheckCircle2,
};

const TONE_BORDER: Record<string, string> = {
  ok: 'border-ok/50',
  info: 'border-info/50',
  warn: 'border-warn/50',
  crit: 'border-crit/50',
  neutral: 'border-hull-500/50',
};

interface Toast extends VoyageEvent {
  toastId: number;
}

export function AlertStack() {
  const events = useSimulationStore((s) => s.events);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenCount = useRef(0);
  const toastCounter = useRef(0);

  useEffect(() => {
    if (events.length < seenCount.current) {
      seenCount.current = 0;
      setToasts([]);
    }
    if (events.length > seenCount.current) {
      const newOnes = events.slice(seenCount.current).map((e) => ({ ...e, toastId: ++toastCounter.current }));
      seenCount.current = events.length;
      setToasts((prev) => [...prev, ...newOnes]);
      newOnes.forEach((t) => {
        setTimeout(() => setToasts((prev) => prev.filter((x) => x.toastId !== t.toastId)), 7000);
      });
    }
  }, [events]);

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.severity];
          const tone = severityTone(t.severity);
          return (
            <motion.div
              key={t.toastId}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={clsx('glass-panel pointer-events-auto rounded-md border-l-2 px-3 py-2.5 shadow-lg', TONE_BORDER[tone])}
            >
              <div className="flex items-start gap-2">
                <Icon size={15} className="mt-0.5 shrink-0 text-slate-200" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-hull-300">{t.severity}</div>
                  <div className="text-xs leading-snug text-slate-100">{t.description}</div>
                  {t.impact && <div className="mt-0.5 text-[11px] text-hull-300">{t.impact}</div>}
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((x) => x.toastId !== t.toastId))}
                  className="text-hull-400 hover:text-slate-200"
                  aria-label="Dismiss alert"
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
