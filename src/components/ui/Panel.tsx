import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={clsx('glass-panel rounded-lg shadow-xl shadow-black/30', className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-hull-600/40 px-3.5 py-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-hull-300">{title}</h3>
          {right}
        </div>
      )}
      <div className={clsx('px-3.5 py-3', bodyClassName)}>{children}</div>
    </div>
  );
}

export function MetricRow({ label, value, unit, valueClassName }: { label: string; value: ReactNode; unit?: string; valueClassName?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[11px] uppercase tracking-wide text-hull-300">{label}</span>
      <span className={clsx('mono-num text-sm font-semibold text-slate-100', valueClassName)}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-hull-300">{unit}</span>}
      </span>
    </div>
  );
}
