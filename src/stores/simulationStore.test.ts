/**
 * Contract tests for the shared voyage state.
 *
 * These cover the synchronisation guarantees the Control Room and the Captain
 * Bridge both depend on: transport, alert acknowledgement and the shared
 * conversation must live in one store, so an action taken on either interface
 * is immediately visible to the other. Regressions here are exactly the class
 * of bug where the two faces silently drift apart.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useSimulationStore } from './simulationStore';
import { useVoyageStore } from './voyageStore';

const initial = useSimulationStore.getState();
const initialPlan = useVoyageStore.getState();

beforeEach(() => {
  useVoyageStore.setState(initialPlan);
  // Reset to a known baseline without running initFromActiveRoute, which
  // needs a planned voyage.
  useSimulationStore.setState({
    ...initial,
    events: [],
    acknowledgedEventIds: [],
    messages: [],
    isPlaying: false,
    speedMultiplier: 1,
    simTimeMs: 0,
  });
});

describe('voyage lifecycle', () => {
  async function launch() {
    useVoyageStore.getState().setDeparture(Date.UTC(2026, 7, 17, 8));
    await useVoyageStore.getState().generateRoutes();
    useVoyageStore.getState().beginVoyage();
    useSimulationStore.getState().initFromActiveRoute();
  }

  it('stops exactly at ETA and records the arrival sample', async () => {
    await launch();
    const sim = useSimulationStore.getState();
    const eta = sim.routeVersions[0].route.metrics.etaMs;
    useSimulationStore.setState({ simTimeMs: eta - 500, nextRecordAtMs: eta + 1_000_000 });
    sim.play();
    sim.tick(20);
    await Promise.resolve();
    expect(useSimulationStore.getState().simTimeMs).toBe(eta);
    expect(useSimulationStore.getState().telemetryHistory.at(-1)?.timestampMs).toBe(eta);
    expect(useSimulationStore.getState().isPlaying).toBe(false);
    expect(useVoyageStore.getState().status).toBe('complete');
  });

  it('restarts a completed voyage without retaining its active report or clock', async () => {
    await launch();
    useVoyageStore.setState({ status: 'complete' });
    useSimulationStore.getState().resetSimulation();
    expect(useVoyageStore.getState().status).toBe('underway');
    expect(useSimulationStore.getState().simTimeMs).toBe(useVoyageStore.getState().departureMs);
    expect(useSimulationStore.getState().report).toBeNull();
  });

  it('uses the same automatic checkpoints when identical plans have different session IDs', async () => {
    await launch();
    const first = useSimulationStore.getState();
    useVoyageStore.setState({ voyageId: 'separate-run' });
    first.initFromActiveRoute();
    expect(useSimulationStore.getState().weatherCheckpointFraction).toBe(first.weatherCheckpointFraction);
    expect(useSimulationStore.getState().securityCheckpointFraction).toBe(first.securityCheckpointFraction);
  });

  it('either offers a lower-risk reroute from the ship or records that no improvement was found', async () => {
    await launch();
    const { shipPosition, triggerWeatherEvent } = useSimulationStore.getState();
    await triggerWeatherEvent();
    const { decisionPending, events } = useSimulationStore.getState();
    if (decisionPending) {
      expect(decisionPending.newRoute.metrics.risk.peak).toBeLessThan(decisionPending.oldRisk);
      expect(decisionPending.newRoute.waypoints[0]).toMatchObject(shipPosition);
    } else {
      expect(events.some(event => event.description.includes('No lower-risk detour'))).toBe(true);
    }
  });

  it.each([false, true])('reports only adopted detours and preserves vessel position (approve=%s)', async approve => {
    await launch();
    const sim = useSimulationStore.getState();
    sim.setSpeed(20);
    sim.play();
    for (let i = 0; i < 150 && !useSimulationStore.getState().decisionPending; i++) sim.tick(250);
    const before = useSimulationStore.getState();
    expect(before.decisionPending).not.toBeNull();
    if (approve) sim.approveReroute();
    else sim.keepCurrentRoute();
    const after = useSimulationStore.getState();
    expect(after.shipPosition).toEqual(before.shipPosition);
    expect(after.routeVersions).toHaveLength(approve ? 2 : 1);
    if (approve) expect(after.routeVersions.at(-1)?.route.waypoints[0]).toMatchObject(before.shipPosition);
    useSimulationStore.setState({ autoWeatherFired: true, autoSecurityFired: true });
    sim.tick(150_000);
    await Promise.resolve();
    const report = useSimulationStore.getState().report;
    expect(report?.routeChanges).toBe(approve ? 1 : 0);
    expect(report?.riskReductionFromRerouting ?? -1).toBe(approve
      ? Math.round((before.decisionPending!.oldRisk - before.decisionPending!.newRoute.metrics.risk.peak) * 10) / 10
      : 0);
  });
});

describe('transport is shared', () => {
  it('play/pause from either interface drives one flag', () => {
    useSimulationStore.getState().play();
    expect(useSimulationStore.getState().isPlaying).toBe(true);

    useSimulationStore.getState().pause();
    expect(useSimulationStore.getState().isPlaying).toBe(false);
  });

  it('speed changes are shared', () => {
    useSimulationStore.getState().setSpeed(20);
    expect(useSimulationStore.getState().speedMultiplier).toBe(20);
  });
});

describe('alert acknowledgement is shared', () => {
  it('records an acknowledgement visible to every consumer', () => {
    useSimulationStore.getState().acknowledgeEvent('evt-1');
    expect(useSimulationStore.getState().acknowledgedEventIds).toContain('evt-1');
  });

  it('is idempotent, so a double-click does not duplicate', () => {
    const { acknowledgeEvent } = useSimulationStore.getState();
    acknowledgeEvent('evt-1');
    acknowledgeEvent('evt-1');
    const ids = useSimulationStore.getState().acknowledgedEventIds;
    expect(ids.filter((id) => id === 'evt-1')).toHaveLength(1);
  });

  it('keeps acknowledgements independent per event', () => {
    const { acknowledgeEvent } = useSimulationStore.getState();
    acknowledgeEvent('evt-1');
    acknowledgeEvent('evt-2');
    expect(useSimulationStore.getState().acknowledgedEventIds).toEqual(['evt-1', 'evt-2']);
  });
});

describe('communications are one shared record', () => {
  it('appends messages from both directions to the same list', () => {
    const { sendMessage } = useSimulationStore.getState();
    sendMessage('captain-to-control', 'Bridge report', 'Passing Konkan.');
    sendMessage('control-to-captain', 'Advisory', 'Acknowledged.');

    const messages = useSimulationStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].direction).toBe('captain-to-control');
    expect(messages[1].direction).toBe('control-to-captain');
  });

  it('ignores empty or whitespace-only sends', () => {
    const { sendMessage } = useSimulationStore.getState();
    sendMessage('captain-to-control', 'Bridge report', '   ');
    sendMessage('captain-to-control', 'Bridge report', '');
    expect(useSimulationStore.getState().messages).toHaveLength(0);
  });

  it('trims the body and stamps the simulation clock, not wall time', () => {
    useSimulationStore.setState({ simTimeMs: 123_456 });
    useSimulationStore
      .getState()
      .sendMessage('captain-to-control', 'Bridge report', '  All secure.  ');

    const [message] = useSimulationStore.getState().messages;
    expect(message.body).toBe('All secure.');
    expect(message.sentAtMs).toBe(123_456);
  });

  it('gives every message a distinct id', () => {
    const { sendMessage } = useSimulationStore.getState();
    sendMessage('captain-to-control', 'Bridge report', 'one');
    sendMessage('captain-to-control', 'Bridge report', 'two');
    sendMessage('captain-to-control', 'Bridge report', 'three');

    const ids = useSimulationStore.getState().messages.map((m) => m.id);
    expect(new Set(ids).size).toBe(3);
  });
});
