import { useNavigate } from 'react-router-dom';
import { Anchor } from 'lucide-react';
import { DEMO_DEPARTURE_MS, useVoyageStore } from '@/stores/voyageStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { vesselById } from '@/data/vessels';
import { portById } from '@/data/ports';
import { Button } from '@/components/ui/Button';

export function Landing() {
  const navigate = useNavigate();
  const setVessel = useVoyageStore((s) => s.setVessel);
  const setOrigin = useVoyageStore((s) => s.setOrigin);
  const setDestination = useVoyageStore((s) => s.setDestination);
  const setDeparture = useVoyageStore((s) => s.setDeparture);
  const setPreferences = useVoyageStore((s) => s.setPreferences);

  const runDemo = () => {
    if (useVoyageStore.getState().status === 'underway') {
      navigate('/command-center');
      return;
    }
    useSimulationStore.getState().clearVoyage();
    setVessel(vesselById('container-panamax'));
    setOrigin(portById('mumbai'));
    setDestination(portById('singapore'));
    setDeparture(DEMO_DEPARTURE_MS);
    setPreferences({ safety: 80, fuel: 60, time: 70, riskThreshold: 25 });
    navigate('/plan');
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-mid/15 text-cyan-glow">
        <Anchor size={30} strokeWidth={2} />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-slate-100">MARLIN</h1>
        <p className="mt-1 text-sm text-hull-300">Maritime Adaptive Risk-aware Logistics &amp; Intelligent Navigation</p>
      </div>
      <p className="max-w-xl text-xs leading-relaxed text-hull-300">
        A time-dependent, vessel-aware, adaptive voyage decision-support prototype built for PSS07 — Development of a Versatile
        and Fast Algorithm for the Optimal Ship Routing. Plan a voyage, compare route alternatives, run a live simulation, and
        watch MARLIN detect changing conditions and recommend a reroute for operator approval.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={runDemo} className="px-5 py-2.5 text-sm">
          Run Full Demo
        </Button>
        <Button variant="secondary" onClick={() => navigate('/plan')} className="px-5 py-2.5 text-sm">
          Plan Voyage
        </Button>
        <Button variant="ghost" onClick={() => navigate('/methodology')} className="px-5 py-2.5 text-sm">
          Methodology
        </Button>
      </div>
    </div>
  );
}
