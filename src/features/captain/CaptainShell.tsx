/**
 * The captain interface shell.
 *
 * A digital bridge, deliberately not the control-room dashboard: a tab strip
 * across the top, the view below, and the simulation transport docked at the
 * bottom so time is always reachable.
 *
 * The transport drives the same simulation store the Control Room uses, so
 * playing here plays there — one voyage, two faces.
 */

import { Link, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Compass,
  Route as RouteIcon,
  CloudSun,
  Bell,
  Radio,
  Play,
  Pause,
  RotateCcw,
  Gauge,
} from 'lucide-react';
import { useSimulationStore } from '@/stores/simulationStore';
import { Button } from '@/components/ui/Glass';
import { formatSimClock } from './bridgeTypes';
import { MISSION_END_MINUTE, MISSION_START_MINUTE } from './bridgeScenario';
import { useBridgeState, useBridgeAlerts } from './bridgeAdapter';
import { useVoyageStore } from '@/stores/voyageStore';
import { BridgeView } from './BridgeView';

const TABS = [
  { to: '/captain/bridge', label: 'Navigation', Icon: Compass },
  { to: '/captain/route', label: 'Route', Icon: RouteIcon },
  { to: '/captain/environment', label: 'Environment', Icon: CloudSun },
  { to: '/captain/alerts', label: 'Alerts', Icon: Bell },
  { to: '/captain/communications', label: 'Comms', Icon: Radio },
];

export function CaptainShell() {
  const { pathname } = useLocation();
  const onBridge = pathname === '/captain/bridge' || pathname === '/captain';
  const bridge = useBridgeState();
  const alerts = useBridgeAlerts();

  const play = useSimulationStore((s) => s.play);
  const pause = useSimulationStore((s) => s.pause);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);

  const running = bridge.isPlaying;
  const minute = bridge.minute;
  const complete = useVoyageStore(state => state.status === 'complete');

  const unacked = alerts.filter(
    (a) => !a.acknowledged && (a.severity === 'CRITICAL' || a.severity === 'WARNING'),
  );
  const worst = unacked.some((a) => a.severity === 'CRITICAL')
    ? 'critical'
    : unacked.length
      ? 'alarm'
      : null;

  return (
    <div className="h-full flex flex-col bg-abyss">
      <a
        href="#captain-main"
        onClick={event => {
          event.preventDefault();
          document.getElementById('captain-main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-deep focus:px-3 focus:py-2 focus:text-sm focus:text-signal"
      >
        Skip to captain content
      </a>

      {/* Bridge header */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-steel/60 bg-deep/80 px-3 py-2 md:flex-nowrap">
        <div className="flex items-center gap-2 shrink-0">
          <Compass size={17} className="text-signal" />
          <div className="leading-tight">
            <div className="mono text-xs text-chalk">
              {bridge.vessel.name.toUpperCase()}
            </div>
            <div className="label">Bridge · {bridge.vessel.type}</div>
          </div>
        </div>

        <nav
          className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto md:order-none md:w-auto"
          aria-label="Captain sections"
        >
          {TABS.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded mono text-[11px] tracking-wider uppercase transition-colors whitespace-nowrap',
                pathname === to
                  ? 'text-signal bg-signal/10 border border-signal/40'
                  : 'text-mist border border-transparent hover:text-chalk hover:bg-steel/30',
              )}
            >
              <Icon size={13} />
              {label}
              {label === 'Alerts' && unacked.length > 0 && (
                <span
                  className={clsx(
                    'ml-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] flex items-center justify-center',
                    worst === 'critical'
                      ? 'bg-critical text-abyss'
                      : 'bg-alarm text-abyss',
                  )}
                >
                  {unacked.length}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5" role="status">
            <span
              className="h-1.5 w-1.5 rounded-full bg-calm"
              aria-hidden="true"
            />
            <span className="label">Shared local simulation</span>
          </div>
          <Link
            to="/command-center"
            className="mono text-[10px] tracking-wider uppercase text-mist hover:text-signal border border-steel px-2 py-1 rounded flex items-center gap-1.5"
          >
            <Gauge size={12} />
            Control Room
          </Link>
          <div className="text-right leading-tight">
            <div className="label">Simulation clock</div>
            <div className="mono text-sm text-chalk">{formatSimClock(minute)}</div>
          </div>
        </div>
      </header>

      {/* Keep the WebGL bridge mounted while changing Captain tabs. */}
      <main
        id="captain-main"
        tabIndex={-1}
        className="flex-1 min-h-0 relative"
        aria-label="Captain bridge workspace"
      >
        <div
          className={clsx('absolute inset-0', !onBridge && 'invisible')}
          aria-hidden={!onBridge}
        >
          <BridgeView />
        </div>
        {!onBridge && (
          <div className="absolute inset-0 overflow-y-auto">
            <Outlet />
          </div>
        )}
      </main>

      {/* Simulation transport — shared with the Control Room */}
      <footer className="shrink-0 border-t border-steel/60 bg-deep/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={running ? pause : play}
            variant={running ? 'ghost' : 'primary'}
            disabled={!bridge.hasVoyage || complete}
            ariaLabel={running ? 'Pause voyage playback' : 'Play voyage playback'}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
          </Button>
          <Button
            onClick={resetSimulation}
            disabled={!bridge.hasVoyage}
            ariaLabel="Reset voyage"
          >
            <RotateCcw size={13} />
          </Button>

          <div className="flex-1 relative flex items-center">
            <progress
              max={MISSION_END_MINUTE - MISSION_START_MINUTE}
              value={minute - MISSION_START_MINUTE}
              aria-label="Voyage progress"
              className="h-2 w-full accent-[#33d6e0]"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="label">Speed</span>
            {[1, 5, 20].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSpeed(m)}
                aria-pressed={bridge.speedMultiplier === m}
                className={clsx(
                  'mono text-[11px] px-2 py-1 rounded border transition-colors',
                  bridge.speedMultiplier === m
                    ? 'border-signal/60 text-signal bg-signal/10'
                    : 'border-steel text-mist hover:text-chalk',
                )}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
