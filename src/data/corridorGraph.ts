import type { LatLon } from '@/types';
import { PORTS } from './ports';
import { haversineKm } from '@/engine/geo';

// ---------------------------------------------------------------------------
// A small, hand-placed open-water waypoint graph connecting the MARLIN port
// list. This is a toy stand-in for the backend's full-resolution
// time-dependent spatial grid (see Methodology): a handful of nodes instead
// of a few hundred thousand, and a plain distance-weighted Dijkstra instead
// of a time-dependent A*. It exists so route geometry in the demo follows
// plausible open-ocean corridors instead of a straight line drawn through
// the Indian subcontinent.
// ---------------------------------------------------------------------------

interface ChokePoint extends LatLon {
  id: string;
}

const CHOKEPOINTS: ChokePoint[] = [
  { id: 'cp-arabian-mid', lat: 16.0, lon: 65.0 },
  { id: 'cp-lakshadweep', lat: 11.0, lon: 72.0 },
  { id: 'cp-nine-degree', lat: 8.5, lon: 73.5 },
  { id: 'cp-south-sri-lanka', lat: 5.3, lon: 80.8 },
  { id: 'cp-bay-of-bengal-sw', lat: 6.5, lon: 82.5 },
  { id: 'cp-andaman-approach', lat: 6.0, lon: 93.0 },
  { id: 'cp-malacca-west', lat: 5.3, lon: 97.5 },
  { id: 'cp-malacca-mid', lat: 2.5, lon: 101.0 },
  { id: 'cp-sunda-approach', lat: -5.5, lon: 105.3 },
  { id: 'cp-somali-basin', lat: 2.0, lon: 56.0 },
  { id: 'cp-mozambique-n', lat: -10.5, lon: 41.0 },
  { id: 'cp-mozambique-s', lat: -24.0, lon: 36.0 },
  { id: 'cp-mascarene', lat: -14.0, lon: 58.0 },
  { id: 'cp-central-indian-ocean', lat: -6.0, lon: 62.0 },
  { id: 'cp-oman-approach', lat: 21.5, lon: 62.0 },
  { id: 'cp-hormuz-approach', lat: 25.5, lon: 58.0 },
  { id: 'cp-arabian-nw', lat: 19.0, lon: 63.5 },
];

const EDGES: [string, string][] = [
  ['mumbai', 'cp-arabian-nw'],
  ['mumbai', 'cp-arabian-mid'],
  ['mumbai', 'cp-lakshadweep'],
  ['cp-arabian-nw', 'cp-hormuz-approach'],
  ['cp-arabian-nw', 'cp-oman-approach'],
  ['cp-oman-approach', 'muscat'],
  ['cp-hormuz-approach', 'muscat'],
  ['cp-hormuz-approach', 'dubai'],
  ['cp-oman-approach', 'cp-arabian-mid'],
  ['cp-arabian-mid', 'cp-lakshadweep'],
  ['cp-lakshadweep', 'kochi'],
  ['cp-lakshadweep', 'cp-nine-degree'],
  ['kochi', 'cp-nine-degree'],
  ['cp-nine-degree', 'cp-south-sri-lanka'],
  ['cp-nine-degree', 'male'],
  ['cp-south-sri-lanka', 'colombo'],
  ['cp-south-sri-lanka', 'cp-bay-of-bengal-sw'],
  ['colombo', 'cp-bay-of-bengal-sw'],
  ['chennai', 'cp-bay-of-bengal-sw'],
  ['cp-bay-of-bengal-sw', 'cp-andaman-approach'],
  ['cp-andaman-approach', 'cp-malacca-west'],
  ['cp-malacca-west', 'cp-malacca-mid'],
  ['cp-malacca-mid', 'singapore'],
  ['cp-malacca-mid', 'cp-sunda-approach'],
  ['cp-sunda-approach', 'jakarta'],
  ['male', 'cp-somali-basin'],
  ['male', 'cp-central-indian-ocean'],
  ['cp-somali-basin', 'cp-central-indian-ocean'],
  ['cp-somali-basin', 'mombasa'],
  ['cp-somali-basin', 'cp-arabian-mid'],
  ['cp-somali-basin', 'cp-oman-approach'],
  ['cp-central-indian-ocean', 'cp-mascarene'],
  ['cp-central-indian-ocean', 'cp-mozambique-n'],
  ['cp-mascarene', 'port-louis'],
  ['cp-mascarene', 'cp-mozambique-s'],
  ['cp-mozambique-n', 'mombasa'],
  ['cp-mozambique-n', 'cp-mozambique-s'],
  ['cp-mozambique-s', 'durban'],
];

type NodeId = string;

const nodeCoords = new Map<NodeId, LatLon>();
for (const p of PORTS) nodeCoords.set(p.id, { lat: p.lat, lon: p.lon });
for (const c of CHOKEPOINTS) nodeCoords.set(c.id, { lat: c.lat, lon: c.lon });

const adjacency = new Map<NodeId, NodeId[]>();
for (const [a, b] of EDGES) {
  if (!adjacency.has(a)) adjacency.set(a, []);
  if (!adjacency.has(b)) adjacency.set(b, []);
  adjacency.get(a)!.push(b);
  adjacency.get(b)!.push(a);
}

/** Plain distance-weighted Dijkstra over the corridor graph. */
export function corridorPath(originPortId: string, destPortId: string): LatLon[] {
  if (originPortId === destPortId || !nodeCoords.has(originPortId) || !nodeCoords.has(destPortId)) {
    throw new Error('Select two different ports from the simulation registry.');
  }
  const dist = new Map<NodeId, number>();
  const prev = new Map<NodeId, NodeId>();
  const visited = new Set<NodeId>();
  for (const id of nodeCoords.keys()) dist.set(id, Infinity);
  dist.set(originPortId, 0);

  while (visited.size < nodeCoords.size) {
    let u: NodeId | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null) break;
    visited.add(u);
    if (u === destPortId) break;

    for (const v of adjacency.get(u) ?? []) {
      if (visited.has(v)) continue;
      const w = haversineKm(nodeCoords.get(u)!, nodeCoords.get(v)!);
      const alt = dist.get(u)! + w;
      if (alt < dist.get(v)!) {
        dist.set(v, alt);
        prev.set(v, u);
      }
    }
  }

  if (!visited.has(destPortId)) throw new Error('No corridor connects the selected ports.');
  const path: LatLon[] = [];
  let cur: NodeId | undefined = destPortId;
  while (cur) {
    path.unshift(nodeCoords.get(cur)!);
    cur = prev.get(cur);
    if (cur === originPortId) {
      path.unshift(nodeCoords.get(cur)!);
      break;
    }
  }
  return path;
}
