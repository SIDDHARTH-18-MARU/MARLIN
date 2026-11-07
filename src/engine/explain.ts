import type { Route, RouteReasonCode, RoutingPreferences } from '@/types';

/**
 * Decision Explanation Engine — turns comparative route metrics into
 * plain-language reason codes. Every bullet is derived from an actual
 * metric comparison against the other candidates, not a canned string.
 */
export function explainRoute(candidate: Route, all: Route[], preferences: RoutingPreferences): RouteReasonCode[] {
  const maxRisk = Math.max(...all.map((r) => r.metrics.risk.total));
  const minRisk = Math.min(...all.map((r) => r.metrics.risk.total));
  const minDuration = Math.min(...all.map((r) => r.metrics.durationHr));
  const maxSecurity = Math.max(...all.map((r) => r.metrics.securityExposure));
  const maxWave = Math.max(...all.map((r) => r.metrics.risk.wave));

  const reasons: RouteReasonCode[] = [];

  if (candidate.metrics.risk.total <= minRisk + 0.5) {
    reasons.push({ positive: true, label: 'Lower modeled environmental risk' });
  } else if (candidate.metrics.risk.total >= maxRisk - 0.5) {
    reasons.push({ positive: false, label: 'Higher modeled environmental risk than alternatives' });
  }

  if (maxWave > 0 && candidate.metrics.risk.wave <= maxWave * 0.75 && candidate.metrics.risk.wave < maxWave) {
    reasons.push({ positive: true, label: 'Avoids the most severe modeled wave region' });
  }

  const avgEffSpeed =
    candidate.waypoints.reduce((s, w) => s + w.effectiveSpeedKn, 0) / Math.max(1, candidate.waypoints.length);
  const cruiseRef = all[0]?.waypoints[0]?.effectiveSpeedKn ?? avgEffSpeed;
  if (avgEffSpeed >= cruiseRef) {
    reasons.push({ positive: true, label: 'Favorable current along most of the corridor' });
  }

  const etaDeltaHr = candidate.metrics.durationHr - minDuration;
  if (etaDeltaHr <= 12) {
    reasons.push({ positive: true, label: 'Acceptable ETA relative to the fastest feasible route' });
  } else {
    reasons.push({ positive: false, label: `Adds ${Math.round(etaDeltaHr)}h versus the fastest feasible route` });
  }

  if (maxSecurity > 0 && candidate.metrics.securityExposure <= maxSecurity * 0.6) {
    reasons.push({ positive: true, label: 'Lower security exposure' });
  } else if (maxSecurity > 0 && candidate.metrics.securityExposure >= maxSecurity - 0.5) {
    reasons.push({ positive: false, label: 'Passes closer to the active security advisory zone' });
  }

  reasons.push({
    positive: candidate.metrics.withinRiskThreshold,
    label: candidate.metrics.withinRiskThreshold
      ? `Within model limit (${preferences.riskThreshold} + 15 tolerance)`
      : `Exceeds model limit (${preferences.riskThreshold} + 15 tolerance)`,
  });

  return reasons;
}
