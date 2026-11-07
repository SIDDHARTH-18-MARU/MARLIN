/**
 * /captain/communications
 *
 * The control-room ↔ captain message log.
 *
 * Inbound traffic is derived from the voyage event log — the Control Room's
 * decisions (reroutes, hazard detections) are exactly what the bridge would be
 * told about, so they are rendered as inbound messages rather than invented
 * separately. Outbound replies are bridge-local.
 */

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, Send } from 'lucide-react';
import { EmptyState, GlassPanel } from '@/components/ui/Glass';
import { MAX_MESSAGE_LENGTH, useSimulationStore } from '@/stores/simulationStore';
import { useVoyageStore } from '@/stores/voyageStore';
import { formatSimClock } from './bridgeTypes';
import { RouteUpdateCard } from './RouteUpdateCard';
import { useBridgeAlerts, useBridgeMessages } from './bridgeAdapter';

interface BridgeMessage {
  id: string;
  direction: 'control-to-captain' | 'captain-to-control';
  kind: string;
  body: string;
  sentAtMinute: number;
}

export function CommunicationPanel() {
  const alerts = useBridgeAlerts();
  const [draft, setDraft] = useState('');
  // Sent traffic lives in the shared simulation store rather than local state,
  // so the Control Room sees the same conversation.
  const sent = useBridgeMessages();
  const sendMessage = useSimulationStore((s) => s.sendMessage);
  const underway = useVoyageStore((s) => s.status === 'underway');

  const inbound = useMemo<BridgeMessage[]>(
    () =>
      alerts
        .filter((a) => a.severity !== 'INFO' || a.title.includes('ROUTE'))
        .map((a) => ({
          id: a.id,
          direction: 'control-to-captain' as const,
          kind: a.title,
          body: a.impact ? `${a.description} ${a.impact}` : a.description,
          sentAtMinute: a.raisedAtMinute,
        })),
    [alerts],
  );

  const messages = useMemo(
    () => [...inbound, ...sent].sort((a, b) => a.sentAtMinute - b.sentAtMinute),
    [inbound, sent],
  );

  const send = () => {
    const body = draft.trim();
    if (!underway || !body) return;
    sendMessage('captain-to-control', 'Bridge report', body);
    setDraft('');
  };

  return (
    <div className="h-full overflow-y-auto p-2 grid gap-2 lg:grid-cols-[1fr_280px] items-start">
      <GlassPanel title="Control room communications">
        <p className="mb-3 text-xs text-mist">Messages stay in this simulation tab. Enter only synthetic reports.</p>
        {messages.length === 0 ? (
          <EmptyState message="No communications yet. Start voyage playback to receive traffic from the Control Room." />
        ) : (
          <ul className="space-y-2 mb-3">
            {messages.map((m) => {
              const isInbound = m.direction === 'control-to-captain';
              const Icon = isInbound ? ArrowDownLeft : ArrowUpRight;
              return (
                <li
                  key={m.id}
                  className={clsx(
                    'rounded border p-2.5 max-w-[85%]',
                    isInbound
                      ? 'border-steel/60 bg-steel/15'
                      : 'border-calm/30 bg-calm/5 ml-auto',
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={12} className={isInbound ? 'text-signal' : 'text-calm'} />
                    <span className="label">
                      {isInbound ? 'Control room' : 'Own vessel'}
                    </span>
                    <span className="label ml-auto">
                      {formatSimClock(m.sentAtMinute)}
                    </span>
                  </div>

                  <p className="text-xs text-chalk leading-snug">{m.body}</p>

                  <div className="mono text-[10px] text-mist mt-1.5">{m.kind}</div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-steel/60 pt-3 mt-3">
          <label className="label block mb-1.5" htmlFor="bridge-message">
            Message Control Room
          </label>
          <div className="flex gap-2">
            <textarea
              id="bridge-message"
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={!underway}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="min-w-0 flex-1 resize-none rounded border border-steel/70 bg-abyss px-2.5 py-2 text-xs text-chalk outline-none focus:border-signal"
              placeholder="Type bridge report…"
            />
            <button
              type="button"
              disabled={!underway || !draft.trim()}
              onClick={send}
              className="flex items-center gap-1.5 rounded border border-calm/40 bg-calm/10 px-3 text-[10px] font-bold uppercase tracking-wide text-calm disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={13} /> Send
            </button>
          </div>
        </div>
      </GlassPanel>

      <div className="grid gap-2">
        <RouteUpdateCard />
        <GlassPanel title="Simulation status">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="label">Control room</span>
              <span className="mono text-[11px] text-calm">{underway ? 'LOCAL VOYAGE' : 'STANDBY'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="label">Last contact</span>
              <span className="mono text-[11px] text-chalk">
                {messages.length
                  ? formatSimClock(messages[messages.length - 1].sentAtMinute)
                  : '—'}
              </span>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
