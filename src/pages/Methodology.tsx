import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';

const PIPELINE = [
  'Vessel + Origin + Destination + Departure Time + Environment + Preferences',
  'Fixed corridor graph and distance-weighted Dijkstra',
  'Three candidate geometries with time-stepped evaluation',
  'Multi-Objective Cost — Time + Fuel + Risk',
  'Coarse land screening and simulated exposure',
  'Route Ranking',
  '3D Simulation',
  'Event Detection',
  'Dynamic Rerouting',
  'Voyage History',
  'Post-Voyage Analysis',
];

const EXISTING = [
  { approach: 'Dijkstra', idea: 'Distance-weighted shortest path search', strength: 'Simple, optimal on static graphs', weakness: 'No time-dependence in graph search', uses: 'Yes, to choose the base corridor' },
  { approach: 'A*', idea: 'Heuristic-guided shortest path search', strength: 'Can explore fewer states with a useful heuristic', weakness: 'Heuristic quality-dependent', uses: 'Proposed for a future full-resolution solver' },
  { approach: 'Dynamic Programming', idea: 'Stage-wise optimal substructure over time/space', strength: 'Exact for well-structured problems', weakness: 'State-space explodes with dimensions', uses: 'No — future work' },
  { approach: 'Isochrone methods', idea: 'Expand reachable-position wavefronts over time', strength: 'Naturally time-dependent, classic weather routing', weakness: 'Coarse without fine time steps', uses: 'No — conceptually related to our time-stepped evaluation' },
  { approach: 'Genetic Algorithm / NSGA-II / NSGA-III', idea: 'Population-based multi-objective search', strength: 'Handles many objectives, Pareto fronts', weakness: 'Slower, stochastic, harder to explain', uses: 'No — future work' },
  { approach: 'Time-dependent shortest path', idea: 'Edge cost varies with arrival time', strength: 'Matches real weather routing needs', weakness: 'Needs FIFO cost consistency for correctness', uses: 'Related concept. MARLIN time-steps candidate evaluation.' },
  { approach: 'D* Lite / incremental search', idea: 'Efficiently repairs a search after local changes', strength: 'Fast replanning without full recompute', weakness: 'More complex to implement/explain', uses: 'No — future work' },
  { approach: 'ML / RL', idea: 'Learn routing policy from data/simulation', strength: 'Can capture complex patterns', weakness: 'Needs data, less explainable, harder to validate', uses: 'No — future work' },
];

const DIFFERENTIATORS = [
  { title: 'Time-dependent route calculation', existing: 'Time-dependent shortest path and isochrone methods are established.', marlin: 'Applies the concept end-to-end: environment sampled at the vessel\'s actual expected arrival time at every point.' },
  { title: 'Vessel-aware routing', existing: 'Vessel performance models are standard in weather routing literature.', marlin: 'A simplified, transparent vessel profile drives speed, fuel, and risk uniformly across the whole pipeline.' },
  { title: 'Event-triggered rerouting', existing: 'Operational routing systems recompute routes when conditions change.', marlin: 'Reroute search restarts from the vessel\'s current position/time, not the origin, with an explicit human-approval step.' },
  { title: 'Decision explanation', existing: 'Explainable-AI framing is broadly discussed.', marlin: 'Every route ships with reason codes generated from an actual metric comparison against its alternatives.' },
  { title: 'Route version history + planned-vs-actual', existing: 'Common in fleet-management software.', marlin: 'Applied at the single-voyage level with full replay of route versions and event attribution.' },
  { title: 'Counterfactual analysis', existing: 'Scenario comparison is a known decision-support technique.', marlin: 'Compares adopted detours against retaining the previously assigned route using the modeled event conditions.' },
];

export function Methodology() {
  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 pb-10">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Methodology</h1>
          <p className="text-xs text-hull-300">
            How MARLIN turns PSS07's requirement — a versatile, reasonably fast routing algorithm accounting for wind, currents,
            waves, ship design, drift and changing weather — into an adaptive voyage decision-support workflow.
          </p>
        </div>

        <Panel title="Pipeline">
          <div className="flex flex-col gap-1.5">
            {PIPELINE.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="mono-num w-5 shrink-0 text-[10px] text-hull-400">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1 rounded border border-hull-600/40 bg-hull-800/40 px-3 py-1.5 text-xs text-slate-100">{step}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Why Time Is Part Of The State">
          <p className="text-xs leading-relaxed text-hull-200">
            The corridor graph connects fixed locations. Candidate evaluation samples wind, waves and current at each projected arrival time.
            The chain is: current position &rarr; current simulation time &rarr; environmental conditions &rarr; effective speed
            &rarr; travel time to the next point &rarr; arrival time at the next point &rarr; environmental conditions there
            &rarr; next movement. This is why the same origin/destination pair can produce a different recommended route at a
            different departure time.
          </p>
        </Panel>

        <Panel title="Candidate Ranking and Model Limits">
          <p className="mb-2 text-xs leading-relaxed text-hull-200">
            The engine evaluates three candidate geometries. It favors candidates within the configured peak-risk threshold plus
            a 15-point tolerance. Coarse exclusion boxes screen route adjustments. Operational coastlines, depth and restricted waterways
            require validated geographic data.
          </p>
          <p className="text-xs leading-relaxed text-hull-200">
            The multi-objective cost is <code className="rounded bg-hull-800 px-1 py-0.5">C = w_t·T_norm + w_f·F_norm + w_r·R_norm</code>{' '}
            . Time and fuel are normalized against the candidate set. Risk is scaled to 0–1. The result ranks these three
            candidates for the selected preferences.
          </p>
        </Panel>

        <Panel title="Existing Research vs. MARLIN">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-hull-300">
                  <th className="pb-2">Approach</th>
                  <th className="pb-2">Main Idea</th>
                  <th className="pb-2">Strength</th>
                  <th className="pb-2">Weakness</th>
                  <th className="pb-2">MARLIN Uses?</th>
                </tr>
              </thead>
              <tbody>
                {EXISTING.map((row) => (
                  <tr key={row.approach} className="border-t border-hull-600/30 align-top">
                    <td className="py-2 font-semibold text-slate-100">{row.approach}</td>
                    <td className="py-2 text-hull-200">{row.idea}</td>
                    <td className="py-2 text-hull-200">{row.strength}</td>
                    <td className="py-2 text-hull-200">{row.weakness}</td>
                    <td className="py-2 text-hull-200">{row.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="What MARLIN Does Differently">
          <p className="mb-3 text-xs leading-relaxed text-hull-200">
            The individual algorithms and ideas below are established in weather-routing and decision-support literature. MARLIN's
            contribution is not a new pathfinding algorithm — it is integrating these ideas into one time-dependent, vessel-aware,
            adaptive, explainable, human-in-the-loop voyage workflow, and visualizing that workflow operationally.
          </p>
          <div className="flex flex-col gap-2.5">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.title} className="rounded border border-hull-600/40 bg-hull-800/30 p-2.5">
                <div className="mb-1 text-xs font-bold text-cyan-glow">{d.title}</div>
                <div className="text-[11px] text-hull-300">
                  <span className="font-semibold text-hull-200">Existing: </span>
                  {d.existing}
                </div>
                <div className="text-[11px] text-hull-300">
                  <span className="font-semibold text-hull-200">MARLIN: </span>
                  {d.marlin}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Claims We Avoid">
          <div className="flex flex-wrap gap-1.5">
            {[
              'A* is novel',
              'Weather routing is novel',
              'Exact fuel prediction',
              'Exact accident probability',
              'Autonomous navigation',
              'Satellite intelligence',
              'Guaranteed optimal real-world route',
              'War / conflict prediction',
            ].map((c) => (
              <Badge key={c} tone="crit">
                {c}
              </Badge>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-hull-300">
            Instead: modeled risk score (0-100, not a probability), modelled fuel estimate, simulated environment, simulated
            security scenario, and decision-support recommendation subject to human approval.
          </p>
        </Panel>

        <Panel title="Roadmap">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RoadmapCol title="Today" items={['Simulated environment', 'Time-dependent A* (toy corridor graph)', 'Vessel profiles', 'Dynamic rerouting', '3D simulation', 'Voyage analytics']} tone="ok" />
            <RoadmapCol title="Next" items={['Real weather / ocean data APIs', 'AIS integration', 'Bathymetry / under-keel clearance', 'Higher-resolution navigable grid']} tone="info" />
            <RoadmapCol title="Future" items={['ML-assisted fuel model', 'Pareto / NSGA-II optimization', 'D* Lite incremental replanning', 'Fleet-scale optimization']} tone="neutral" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RoadmapCol({ title, items, tone }: { title: string; items: string[]; tone: 'ok' | 'info' | 'neutral' }) {
  return (
    <div className="rounded border border-hull-600/40 bg-hull-800/30 p-3">
      <Badge tone={tone}>{title}</Badge>
      <ul className="mt-2 flex flex-col gap-1 text-[11px] text-hull-200">
        {items.map((i) => (
          <li key={i}>&bull; {i}</li>
        ))}
      </ul>
    </div>
  );
}
