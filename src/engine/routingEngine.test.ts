import { describe, expect, it } from 'vitest';
import { PORTS, portById } from '@/data/ports';
import { VESSEL_PROFILES } from '@/data/vessels';
import { corridorPath } from '@/data/corridorGraph';
import { generateRouteCandidates, type RouteGenParams } from './routingEngine';

const params: RouteGenParams = {
  vessel: VESSEL_PROFILES[0],
  originPoint: portById('mumbai'),
  originPortId: 'mumbai',
  destPortId: 'singapore',
  departureMs: Date.UTC(2026, 7, 17, 8),
  preferences: { safety: 80, fuel: 60, time: 70, riskThreshold: 25 },
};

describe('corridor simulation', () => {
  it('connects every documented port pair through the fixture graph', () => {
    for (const origin of PORTS) {
      for (const destination of PORTS) {
        if (origin === destination) continue;
        const path = corridorPath(origin.id, destination.id);
        expect(path.length).toBeGreaterThanOrEqual(2);
        expect(path[0]).toMatchObject({ lat: origin.lat, lon: origin.lon });
        expect(path.at(-1)).toMatchObject({ lat: destination.lat, lon: destination.lon });
      }
    }
  });

  it('reproduces a fixed voyage with finite, time-ordered metrics', () => {
    const routes = generateRouteCandidates(params);
    expect(routes).toEqual(generateRouteCandidates(params));
    expect(routes).toHaveLength(3);
    for (const { metrics, waypoints } of routes) {
      expect(metrics.distanceKm).toBeGreaterThan(0);
      expect(metrics.fuelTonnes).toBeGreaterThan(0);
      expect(metrics.risk.peak).toBeGreaterThanOrEqual(metrics.risk.total);
      expect(metrics.risk.peak).toBeLessThanOrEqual(100);
      expect(waypoints[0].etaMs).toBe(params.departureMs);
      expect(waypoints.at(-1)?.etaMs).toBe(metrics.etaMs);
      expect(waypoints.every((point, i) => !i || point.etaMs > waypoints[i - 1].etaMs)).toBe(true);
    }
  });

  it('rejects unknown and identical ports and invalid simulation inputs', () => {
    expect(() => corridorPath('unknown', 'singapore')).toThrow();
    expect(() => corridorPath('mumbai', 'mumbai')).toThrow();
    expect(() => generateRouteCandidates({ ...params, departureMs: NaN })).toThrow();
    expect(() => generateRouteCandidates({
      ...params, preferences: { ...params.preferences, safety: Infinity },
    })).toThrow();
  });

  it('chooses the lowest-fuel candidate under fuel-only preferences', () => {
    const routes = generateRouteCandidates({
      ...params, preferences: { safety: 0, fuel: 100, time: 0, riskThreshold: 100 },
    });
    expect(routes[0].metrics.fuelTonnes).toBe(Math.min(...routes.map(r => r.metrics.fuelTonnes)));
    expect(routes[1].metrics.etaMs).toBeLessThanOrEqual(routes[2].metrics.etaMs);
  });

  it('chooses the earliest candidate under time-only preferences', () => {
    const routes = generateRouteCandidates({
      ...params, preferences: { safety: 0, fuel: 0, time: 100, riskThreshold: 100 },
    });
    expect(routes[0].metrics.etaMs).toBe(Math.min(...routes.map(r => r.metrics.etaMs)));
  });
});
