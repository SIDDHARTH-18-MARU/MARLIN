/**
 * Shared visual primitives — Document 26.
 *
 * Owned by the panels side; imported by the 3D side. Nobody writes panel
 * chrome outside this file, so the two halves cannot drift into two visual
 * languages.
 */

import type { ReactNode } from "react";
import clsx from "clsx";
import type { AlertSeverity, RiskBand } from "@/features/captain/bridgeTypes";

export function GlassPanel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("glass rounded-lg flex flex-col min-h-0", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-steel/50 shrink-0">
          <h2 className="label">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-3 overflow-y-auto min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** A single instrument readout: big value, small unit, tiny label. */
export function Readout({
  label,
  value,
  unit,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "default" | "calm" | "caution" | "alarm";
  className?: string;
}) {
  const toneClass = {
    default: "text-chalk",
    calm: "text-calm",
    caution: "text-caution",
    alarm: "text-alarm",
  }[tone];

  return (
    <div className={clsx("flex flex-col gap-0.5", className)}>
      <span className="label">{label}</span>
      <span className={clsx("mono text-2xl leading-none font-medium", toneClass)}>
        {value}
        {unit && <span className="text-sm text-mist ml-1 font-normal">{unit}</span>}
      </span>
    </div>
  );
}

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  INFO: "border-signal/40 text-signal bg-signal/10",
  ADVISORY: "border-caution/40 text-caution bg-caution/10",
  WARNING: "border-alarm/50 text-alarm bg-alarm/10",
  CRITICAL: "border-critical text-critical bg-critical/15",
};

export function SeverityTag({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className={clsx(
        "mono text-[10px] tracking-wider px-1.5 py-0.5 rounded border",
        SEVERITY_STYLE[severity],
      )}
    >
      {severity}
    </span>
  );
}


const RISK_STYLE: Record<RiskBand, string> = {
  LOW: "text-calm",
  MEDIUM: "text-caution",
  HIGH: "text-alarm",
};

export function RiskTag({ band }: { band: RiskBand }) {
  return <span className={clsx("mono font-medium", RISK_STYLE[band])}>{band}</span>;
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  type = "button",
  disabled,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "primary" | "accept";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const variantClass = {
    ghost:
      "border-steel text-mist hover:text-chalk hover:border-signal/60 hover:bg-signal/5",
    primary: "border-signal/60 text-signal bg-signal/10 hover:bg-signal/20",
    accept: "border-calm/60 text-calm bg-calm/10 hover:bg-calm/20",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        "mono text-[11px] tracking-wider uppercase px-3 py-1.5 rounded border transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variantClass,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Empty state — master prompt: never leave a blank screen. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-center p-6">
      <p className="text-sm text-mist max-w-[24ch]">{message}</p>
    </div>
  );
}
