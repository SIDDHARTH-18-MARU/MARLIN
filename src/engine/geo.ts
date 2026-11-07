import type { LatLon } from '@/types';

const R_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle interpolation (slerp) at fraction f in [0,1] between a and b. */
export function greatCircleInterpolate(a: LatLon, b: LatLon, f: number): LatLon {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );

  if (d === 0) return { lat: a.lat, lon: a.lon };

  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);
  return { lat: toDeg(lat), lon: toDeg(lon) };
}

/** Offset a point perpendicular to the a->b bearing by `km` (signed: +right, -left). */
export function offsetPerpendicular(base: LatLon, courseDeg: number, km: number): LatLon {
  const perpDeg = courseDeg + 90;
  return destinationPoint(base, perpDeg, km);
}

export function destinationPoint(start: LatLon, bearing: number, distKm: number): LatLon {
  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lon);
  const brng = toRad(bearing);
  const dR = distKm / R_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
      Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: toDeg(lat2), lon: (((toDeg(lon2) + 540) % 360) - 180) };
}

export function pathLengthKm(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/** Densify a polyline of control points into N evenly-spaced points along its great-circle segments. */
export function densifyPath(controlPoints: LatLon[], targetPoints: number): LatLon[] {
  if (controlPoints.length < 2) return controlPoints;
  const segLengths = controlPoints.slice(1).map((p, i) => haversineKm(controlPoints[i], p));
  const total = segLengths.reduce((a, b) => a + b, 0);
  const out: LatLon[] = [];
  for (let i = 0; i < targetPoints; i++) {
    const targetDist = (i / (targetPoints - 1)) * total;
    let acc = 0;
    let segIdx = 0;
    while (segIdx < segLengths.length - 1 && acc + segLengths[segIdx] < targetDist) {
      acc += segLengths[segIdx];
      segIdx++;
    }
    const segLen = segLengths[segIdx] || 1e-6;
    const f = Math.min(1, Math.max(0, (targetDist - acc) / segLen));
    out.push(greatCircleInterpolate(controlPoints[segIdx], controlPoints[segIdx + 1], f));
  }
  return out;
}

export function courseAt(points: LatLon[], i: number): number {
  const a = points[Math.max(0, i - 1)];
  const b = points[Math.min(points.length - 1, i + 1)];
  return bearingDeg(a, b);
}

export function normalizeDelta(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Reroute a polyline around a circular exclusion zone (a hazard cell): any
 * points that fall inside the circle are replaced with an arc that hugs its
 * edge, guaranteeing the resulting path clears the hazard by `marginKm`.
 * Points outside the circle are left untouched.
 */
export function detourAroundCircle(
  path: LatLon[],
  center: LatLon,
  radiusKm: number,
  marginKm = 40,
  arcPoints = 9,
  direction: 'short' | 'long' = 'short',
): LatLon[] {
  const clearRadius = radiusKm + marginKm;
  const inside = path.map((p) => haversineKm(p, center) < clearRadius);
  if (!inside.some(Boolean)) return path;

  const firstIn = inside.indexOf(true);
  const lastIn = inside.lastIndexOf(true);
  const entryIdx = Math.max(0, firstIn - 1);
  const exitIdx = Math.min(path.length - 1, lastIn + 1);
  if (entryIdx >= exitIdx) return path;

  const entry = path[entryIdx];
  const exit = path[exitIdx];
  const angle1 = bearingDeg(center, entry);
  const angle2 = bearingDeg(center, exit);

  const shortDelta = normalizeDelta(angle2 - angle1);
  // The "long way" around the same circle — tried as an alternative when the
  // short way would clip a coastline (open water is often only clear on one
  // side of a hazard sitting near a strait).
  const delta = direction === 'short' ? shortDelta : shortDelta - Math.sign(shortDelta || 1) * 360;

  const arc: LatLon[] = [];
  for (let i = 1; i < arcPoints; i++) {
    const f = i / arcPoints;
    const angle = angle1 + delta * f;
    arc.push(destinationPoint(center, angle, clearRadius));
  }

  return [...path.slice(0, entryIdx + 1), ...arc, ...path.slice(exitIdx)];
}
