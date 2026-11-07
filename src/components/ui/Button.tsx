import type { ComponentPropsWithRef, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-cyan-mid/90 hover:bg-cyan-mid text-hull-950 border-transparent',
  secondary: 'bg-hull-700/70 hover:bg-hull-600 text-slate-100 border-hull-500/50',
  ghost: 'bg-transparent hover:bg-hull-700/50 text-hull-300 hover:text-slate-100 border-hull-600/50',
  danger: 'bg-crit/90 hover:bg-crit text-hull-950 border-transparent',
  success: 'bg-ok/90 hover:bg-ok text-hull-950 border-transparent',
};

interface Props extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', icon, className, children, ...rest }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
