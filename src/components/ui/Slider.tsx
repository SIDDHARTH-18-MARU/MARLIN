export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = '%',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-hull-300">{label}</span>
        <span className="mono-num text-xs font-semibold text-cyan-glow">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-hull-600 accent-cyan-mid"
        aria-label={label}
      />
    </div>
  );
}
