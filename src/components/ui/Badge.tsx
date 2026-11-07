import type { ReactNode } from 'react';
import clsx from 'clsx';

import type { BadgeTone } from './statusTones';

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: 'bg-ok/15 text-ok border-ok/40',
  info: 'bg-info/15 text-info border-info/40',
  warn: 'bg-warn/15 text-warn border-warn/40',
  crit: 'bg-crit/15 text-crit border-crit/40',
  neutral: 'bg-hull-600/40 text-hull-300 border-hull-500/50',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
