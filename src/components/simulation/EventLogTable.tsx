import type { VoyageEvent } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { severityTone } from '@/components/ui/statusTones';
import { formatCoord, formatUtcShort } from '@/utils/format';

export function EventLogTable({ events }: { events: VoyageEvent[] }) {
  if (events.length === 0) {
    return <div className="py-6 text-center text-xs text-hull-300">No events logged yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-hull-300">
            <th className="pb-2">Time</th>
            <th className="pb-2">Event</th>
            <th className="pb-2">Location</th>
            <th className="pb-2">Severity</th>
            <th className="pb-2">Impact</th>
            <th className="pb-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {[...events].reverse().map((e) => (
            <tr
              key={e.id}
              className="border-t border-hull-600/30"
            >
              <td className="mono-num py-1.5 text-hull-300">{formatUtcShort(e.timestampMs)}</td>
              <td className="py-1.5 font-medium text-slate-100">{e.description}</td>
              <td className="mono-num py-1.5 text-hull-300">{formatCoord(e.location.lat, e.location.lon)}</td>
              <td className="py-1.5">
                <Badge tone={severityTone(e.severity)}>{e.severity}</Badge>
              </td>
              <td className="py-1.5 text-hull-300">{e.impact ?? '—'}</td>
              <td className="py-1.5 text-hull-300">{e.actionTaken ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
