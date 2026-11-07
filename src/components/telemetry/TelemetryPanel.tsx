import { Panel, MetricRow } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { riskTone, riskLabel } from '@/components/ui/statusTones';
import { useVoyageStore } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { formatCoord, formatDurationHr, formatKm, formatUtc } from '@/utils/format';

export function TelemetryPanel() {
  const vessel = useVoyageStore((s) => s.vessel);
  const status = useVoyageStore((s) => s.status);
  const simTimeMs = useSimulationStore((s) => s.simTimeMs);
  const shipPosition = useSimulationStore((s) => s.shipPosition);
  const shipHeadingDeg = useSimulationStore((s) => s.shipHeadingDeg);
  const shipSpeedKn = useSimulationStore((s) => s.shipSpeedKn);
  const telemetryHistory = useSimulationStore((s) => s.telemetryHistory);
  const routeVersions = useSimulationStore((s) => s.routeVersions);
  const activeVersionIndex = useSimulationStore((s) => s.activeVersionIndex);

  const latest = telemetryHistory[telemetryHistory.length - 1];
  const route = routeVersions[activeVersionIndex]?.route;
  const totalDistanceKm = route ? route.metrics.distanceKm : 0;
  const distanceTravelled = latest?.distanceTravelledKm ?? 0;
  const distanceRemaining = latest?.distanceRemainingKm ?? totalDistanceKm;
  const eta = route?.metrics.etaMs ?? 0;
  const timeRemainingHr = Math.max(0, (eta - simTimeMs) / 3_600_000);

  const risk = latest?.risk ?? 0;
  const security = latest?.securityExposure ?? 0;
  const isUnderway = status === 'underway';

  return (
    <Panel
      title="Live Telemetry"
      right={<Badge tone={isUnderway ? 'ok' : 'neutral'}>{isUnderway ? 'Underway' : status === 'complete' ? 'Arrived' : 'Standby'}</Badge>}
      className="w-72"
    >
      <div className="mb-2 text-sm font-semibold text-slate-100">{vessel.name}</div>
      <MetricRow label="Speed" value={shipSpeedKn.toFixed(1)} unit="kn" />
      <MetricRow label="Heading" value={Math.round(shipHeadingDeg)} unit="°" />
      <MetricRow label="Position" value={formatCoord(shipPosition.lat, shipPosition.lon)} />
      <MetricRow label="Distance Travelled" value={formatKm(distanceTravelled)} />
      <MetricRow label="Distance Remaining" value={formatKm(distanceRemaining)} />
      <MetricRow label="ETA" value={eta ? formatUtc(eta) : '—'} />
      <MetricRow label="Time Remaining" value={formatDurationHr(timeRemainingHr)} />
      <MetricRow label="Modelled Fuel Used" value={(latest?.fuelUsedTonnes ?? 0).toFixed(1)} unit="t" />
      <div className="mt-2 border-t border-hull-600/40 pt-2">
        <MetricRow
          label="Current Risk"
          value={
            <span className="flex items-center gap-1.5">
              {risk.toFixed(0)}/100 <Badge tone={riskTone(risk)}>{riskLabel(risk)}</Badge>
            </span>
          }
        />
        <MetricRow label="Security Exposure" value={`${security.toFixed(0)}/100`} />
        <MetricRow label="Forecast Confidence" value={`${route?.metrics.forecastConfidence.h0_24 ?? 95}%`} />
      </div>
    </Panel>
  );
}
