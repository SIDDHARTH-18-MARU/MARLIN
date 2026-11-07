import type { Route } from '@/types';
import { generateRouteCandidates, type RouteGenParams } from '@/engine/routingEngine';

// Future backend seam: POST /api/v1/routes/calculate and POST /api/v1/routes/reroute.
// Both calls share this same signature today; only the transport changes.
export async function calculateRoutes(params: RouteGenParams): Promise<Route[]> {
  return generateRouteCandidates(params);
}

export async function recalculateRoutes(params: RouteGenParams): Promise<Route[]> {
  return generateRouteCandidates(params);
}
