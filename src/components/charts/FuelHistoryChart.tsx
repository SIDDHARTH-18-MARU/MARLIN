import { CartesianGrid, Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TelemetrySample } from '@/types';
import { formatUtcShort } from '@/utils/format';

export function FuelHistoryChart({
  telemetry,
  plannedTotalFuelTonnes,
  plannedDurationHr,
  departureMs,
}: {
  telemetry: TelemetrySample[];
  plannedTotalFuelTonnes: number;
  plannedDurationHr: number;
  departureMs: number;
}) {
  const plannedEndMs = departureMs + plannedDurationHr * 3_600_000;
  const data = telemetry.map((t) => {
    const fracPlanned = Math.min(1, (t.timestampMs - departureMs) / Math.max(1, plannedEndMs - departureMs));
    return { t: t.timestampMs, actual: t.fuelUsedTonnes, planned: fracPlanned * plannedTotalFuelTonnes };
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#16283e" strokeDasharray="3 3" />
        <XAxis dataKey="t" tickFormatter={formatUtcShort} tick={{ fill: '#7a95ac', fontSize: 10 }} stroke="#2c4a6b" />
        <YAxis tick={{ fill: '#7a95ac', fontSize: 10 }} stroke="#2c4a6b" unit="t" />
        <Tooltip
          contentStyle={{ background: '#0d1726', border: '1px solid #2c4a6b', borderRadius: 6, fontSize: 11 }}
          labelFormatter={(v) => formatUtcShort(Number(v))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="planned" name="Planned" stroke="#7a95ac" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="actual" name="Actual / Simulated" stroke="#33d6e0" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
