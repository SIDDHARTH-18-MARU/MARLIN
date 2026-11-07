import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Ship } from 'lucide-react';
import { VESSEL_PROFILES } from '@/data/vessels';
import { PORTS } from '@/data/ports';
import { useVoyageStore, PRESETS } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { Badge } from '@/components/ui/Badge';
import clsx from 'clsx';

const QUICK_TIMES = ['08:00', '12:00', '16:00', '20:00'];

function toDateInput(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}
function toTimeInput(ms: number) {
  return new Date(ms).toISOString().slice(11, 16);
}

export function PlanVoyage() {
  const navigate = useNavigate();
  const { vessel, origin, destination, departureMs, preferences, isCalculating, status } = useVoyageStore();
  const setVessel = useVoyageStore((s) => s.setVessel);
  const setOrigin = useVoyageStore((s) => s.setOrigin);
  const setDestination = useVoyageStore((s) => s.setDestination);
  const setDeparture = useVoyageStore((s) => s.setDeparture);
  const setPreferences = useVoyageStore((s) => s.setPreferences);
  const applyPreset = useVoyageStore((s) => s.applyPreset);
  const generateRoutes = useVoyageStore((s) => s.generateRoutes);
  const resetPlanning = useVoyageStore((s) => s.resetPlanning);

  const [error, setError] = useState<string | null>(null);

  const swapPorts = () => {
    const o = origin;
    setOrigin(destination);
    setDestination(o);
  };

  const setTimePortion = (hhmm: string) => {
    updateDeparture(toDateInput(departureMs), hhmm);
  };
  const updateDeparture = (date: string, time: string) => {
    const next = Date.parse(`${date}T${time}:00Z`);
    if (!date || !time || !Number.isFinite(next) || toDateInput(next) !== date) {
      setError('Enter a valid departure date and UTC time.');
      return;
    }
    setError(null);
    setDeparture(next);
  };

  const handleGenerate = async () => {
    if (origin.id === destination.id) {
      setError('Origin and destination must be different ports.');
      return;
    }
    setError(null);
    resetPlanning();
    try {
      if (await generateRoutes()) navigate('/route-analysis');
    } catch {
      setError('No route could be calculated for this plan. Check the ports and departure, then try again.');
    }
  };

  if (status === 'underway') {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-start justify-center gap-4 px-6">
        <h1 className="text-lg font-bold">A voyage is in progress</h1>
        <p className="text-sm text-hull-300">Starting a new plan ends this unfinished simulation. Completed reports remain in this session.</p>
        <Button variant="primary" onClick={() => navigate('/command-center')}>Return to voyage</Button>
        <Button variant="secondary" onClick={() => {
          useSimulationStore.getState().clearVoyage();
          resetPlanning();
        }}>End voyage and start a new plan</Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Plan Voyage</h1>
          <p className="text-xs text-hull-300">Configure vessel, corridor, departure time, and routing objectives.</p>
        </div>

        <Panel title="Vessel">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {VESSEL_PROFILES.map((v) => (
              <button
                key={v.id}
                aria-pressed={vessel.id === v.id}
                onClick={() => setVessel(v)}
                className={clsx(
                  'rounded-md border p-3 text-left transition-colors',
                  vessel.id === v.id ? 'border-cyan-glow/60 bg-cyan-mid/10' : 'border-hull-600/40 bg-hull-800/40 hover:border-hull-400/50',
                )}
              >
                <Ship size={18} className="mb-1.5 text-cyan-glow" />
                <div className="text-xs font-bold text-slate-100">{v.name}</div>
                <div className="mt-1 text-[10px] text-hull-300">Cruising {v.cruisingSpeedKn} kn</div>
                <div className="text-[10px] text-hull-300">{v.fuelEfficiencyLabel}</div>
                <Badge tone="neutral" className="mt-1.5">
                  Simulation Profile
                </Badge>
              </button>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel title="Origin & Destination">
            <div className="flex items-center gap-2">
              <PortSelect label="Origin" value={origin.id} onChange={(id) => setOrigin(PORTS.find((p) => p.id === id)!)} exclude={destination.id} />
              <button onClick={swapPorts} className="mt-4 rounded p-1.5 text-hull-300 hover:bg-hull-700/50 hover:text-cyan-glow" aria-label="Swap ports">
                <ArrowRightLeft size={15} />
              </button>
              <PortSelect label="Destination" value={destination.id} onChange={(id) => setDestination(PORTS.find((p) => p.id === id)!)} exclude={origin.id} />
            </div>
          </Panel>

          <Panel title="Voyage Time">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="departure-date" className="mb-1 block text-[11px] uppercase tracking-wide text-hull-300">Departure Date</label>
                <input
                  id="departure-date"
                  type="date"
                  value={toDateInput(departureMs)}
                  onChange={(e) => updateDeparture(e.target.value, toTimeInput(departureMs))}
                  className="w-full rounded border border-hull-600/50 bg-hull-800/60 px-2 py-1.5 text-xs text-slate-100"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="departure-time" className="mb-1 block text-[11px] uppercase tracking-wide text-hull-300">Departure Time (UTC)</label>
                <input
                  id="departure-time"
                  type="time"
                  value={toTimeInput(departureMs)}
                  onChange={(e) => setTimePortion(e.target.value)}
                  className="w-full rounded border border-hull-600/50 bg-hull-800/60 px-2 py-1.5 text-xs text-slate-100"
                />
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {QUICK_TIMES.map((t) => (
                <button
                  key={t}
                  aria-pressed={toTimeInput(departureMs) === t}
                  onClick={() => setTimePortion(t)}
                  className={clsx(
                    'flex-1 rounded px-2 py-1 text-[11px] font-semibold',
                    toTimeInput(departureMs) === t ? 'bg-cyan-mid/20 text-cyan-glow' : 'bg-hull-700/50 text-hull-300 hover:text-slate-100',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-hull-300">
              Voyage Time Machine: environmental conditions along the corridor differ at the selected departure time — the recommended
              route can shift accordingly. Same ship, same ports, different departure time can mean a different optimal route.
            </p>
          </Panel>
        </div>

        <Panel title="Routing Objectives">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((key) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className="rounded-full border border-hull-600/50 bg-hull-800/50 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-hull-300 hover:border-cyan-glow/50 hover:text-cyan-glow"
              >
                {key.replace('-', ' ')}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Slider label="Safety" value={preferences.safety} onChange={(v) => setPreferences({ safety: v })} />
            <Slider label="Fuel Efficiency" value={preferences.fuel} onChange={(v) => setPreferences({ fuel: v })} />
            <Slider label="Travel Time" value={preferences.time} onChange={(v) => setPreferences({ time: v })} />
            <Slider label="Risk Threshold" value={preferences.riskThreshold} onChange={(v) => setPreferences({ riskThreshold: v })} />
          </div>
          <p className="mt-3 border-t border-hull-600/40 pt-2.5 text-[10.5px] leading-snug text-hull-300">
            Safety, fuel and time weight the recommendation. The prototype applies a 15-point tolerance to the risk threshold.
          </p>
        </Panel>

        {error && <div role="alert" className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</div>}

        <div className="flex justify-end pb-4">
          <Button variant="primary" onClick={handleGenerate} disabled={isCalculating} className="px-6 py-2.5 text-sm">
            {isCalculating ? 'Analyzing Environment...' : 'Generate Routes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PortSelect({ label, value, onChange, exclude }: { label: string; value: string; onChange: (id: string) => void; exclude: string }) {
  const id = `voyage-${label.toLowerCase()}`;
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-[11px] uppercase tracking-wide text-hull-300">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-hull-600/50 bg-hull-800/60 px-2 py-1.5 text-xs text-slate-100"
      >
        {PORTS.filter((p) => p.id !== exclude || p.id === value).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.country}
          </option>
        ))}
      </select>
    </div>
  );
}
