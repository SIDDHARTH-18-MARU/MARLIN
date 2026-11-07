import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TelemetrySample, VoyageEvent } from '@/types';
import { formatUtcShort } from '@/utils/format';

export function RiskHistoryChart({ telemetry, events }: { telemetry: TelemetrySample[]; events: VoyageEvent[] }) {
  const data = telemetry.map((t) => ({ t: t.timestampMs, risk: t.risk }));
  const annotated = events.filter((e) => e.type === 'STORM_DETECTED' || e.type === 'SECURITY_ALERT' || e.type === 'ROUTE_CHANGED');

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#16283e" strokeDasharray="3 3" />
        <XAxis dataKey="t" tickFormatter={formatUtcShort} tick={{ fill: '#7a95ac', fontSize: 10 }} stroke="#2c4a6b" />
        <YAxis domain={[0, 100]} tick={{ fill: '#7a95ac', fontSize: 10 }} stroke="#2c4a6b" />
        <Tooltip
          contentStyle={{ background: '#0d1726', border: '1px solid #2c4a6b', borderRadius: 6, fontSize: 11 }}
          labelFormatter={(v) => formatUtcShort(Number(v))}
        />
        <Line type="monotone" dataKey="risk" stroke="#33d6e0" strokeWidth={2} dot={false} />
        {annotated.map((e) => {
          const nearest = telemetry.reduce((best, t) => (Math.abs(t.timestampMs - e.timestampMs) < Math.abs(best.timestampMs - e.timestampMs) ? t : best), telemetry[0]);
          if (!nearest) return null;
          return (
            <ReferenceDot key={e.id} x={nearest.timestampMs} y={nearest.risk} r={5} fill="#ff4d4f" stroke="#05080d" strokeWidth={1.5} />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
