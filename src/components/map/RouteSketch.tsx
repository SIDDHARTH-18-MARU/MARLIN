import type { LatLon, Route } from '@/types';

export function RouteSketch({ routes, position }: { routes: Route[]; position?: LatLon }) {
  const points = routes.flatMap(route => route.waypoints);
  if (!points.length) return <p className="p-4 text-sm text-hull-300">No route to display yet.</p>;
  const south = Math.min(...points.map(point => point.lat));
  const north = Math.max(...points.map(point => point.lat));
  const west = Math.min(...points.map(point => point.lon));
  const east = Math.max(...points.map(point => point.lon));
  const scale = Math.min(448 / Math.max(1, east - west), 208 / Math.max(1, north - south));
  const project = ({ lat, lon }: LatLon) => [
    240 + (lon - (east + west) / 2) * scale,
    120 - (lat - (north + south) / 2) * scale,
  ];
  const marker = position && project(position);
  return (
    <svg viewBox="0 0 480 240" role="img" aria-label="Schematic of the simulated voyage routes" className="h-full max-h-72 w-full">
      <rect width="480" height="240" rx="8" fill="#0a121d" />
      {routes.map(route => (
        <polyline key={route.id} points={route.waypoints.map(point => project(point).join(',')).join(' ')}
          stroke={route.color} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
      ))}
      {marker && <circle cx={marker[0]} cy={marker[1]} r="5" fill="#fff" stroke="#05080d" strokeWidth="2" />}
    </svg>
  );
}
