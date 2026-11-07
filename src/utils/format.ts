export function formatUtc(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const year = d.getUTCFullYear();
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year} — ${hh}:${mm} UTC`;
}

export function formatUtcShort(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${hh}:${mm}`;
}

export function formatDurationHr(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hrs = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  const mins = totalMinutes % 60;
  return `${hrs}h ${mins}m`;
}

export function formatCoord(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}  ${lonStr}`;
}

export function nm(km: number): number {
  return km / 1.852;
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

export function formatNm(km: number): string {
  return `${Math.round(nm(km)).toLocaleString()} nm`;
}

export function signed(v: number, digits = 1): string {
  const r = v.toFixed(digits);
  return v >= 0 ? `+${r}` : r;
}
