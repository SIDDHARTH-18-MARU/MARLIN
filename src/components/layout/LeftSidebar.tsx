import { NavLink } from 'react-router-dom';
import { BarChart3, Boxes, Compass, History, LayoutGrid, MapPinned, Route, GraduationCap, Ship } from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/command-center', label: 'Command Center', icon: LayoutGrid },
  { to: '/plan', label: 'Plan Voyage', icon: MapPinned },
  { to: '/route-analysis', label: 'Route Analysis', icon: Route },
  { to: '/history', label: 'Voyage History', icon: History },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/assets', label: '3D Assets', icon: Boxes },
  { to: '/methodology', label: 'Methodology', icon: GraduationCap },
];

export function LeftSidebar() {
  return (
    <nav aria-label="Control Room sections" className="flex shrink-0 items-center gap-1 overflow-auto border-b border-hull-600/40 bg-hull-950/80 px-2 py-1 md:w-16 md:flex-col md:border-r md:py-3 xl:w-48 xl:items-stretch">
      <div className="mb-1 hidden items-center gap-1.5 px-2 pb-2 text-hull-300 xl:flex">
        <Compass size={13} />
        <span className="text-[10px] uppercase tracking-widest">Navigation</span>
      </div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-[11px] font-medium transition-colors xl:px-3',
              isActive ? 'bg-cyan-mid/15 text-cyan-glow' : 'text-hull-300 hover:bg-hull-800 hover:text-slate-100',
            )
          }
          title={label}
          aria-label={label}
        >
          <Icon size={17} strokeWidth={2} />
          <span className="hidden truncate xl:inline">{label}</span>
        </NavLink>
      ))}

      {/* The vessel-side face. Separated because it leaves the Control Room
          shell entirely rather than being another page within it. */}
      <div className="ml-auto md:ml-0 md:mt-auto md:pt-2">
        <div className="mb-1 hidden items-center gap-1.5 px-2 pb-1 text-hull-300 xl:flex">
          <span className="text-[10px] uppercase tracking-widest">Vessel</span>
        </div>
        <NavLink
          to="/captain/bridge"
          className="flex items-center gap-2.5 rounded-md border border-cyan-dim/40 px-2.5 py-2.5 text-[11px] font-medium text-cyan-glow transition-colors hover:bg-cyan-mid/15 xl:px-3"
          title="Captain Bridge"
          aria-label="Captain Bridge"
        >
          <Ship size={17} strokeWidth={2} />
          <span className="hidden truncate xl:inline">Captain Bridge</span>
        </NavLink>
      </div>
    </nav>
  );
}
