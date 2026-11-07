import { Outlet } from 'react-router-dom';
import { TopCommandBar } from './TopCommandBar';
import { LeftSidebar } from './LeftSidebar';
import { AlertStack } from '@/components/alerts/AlertStack';

export function AppShell() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-abyss">
      <a href="#control-main" onClick={event => {
        event.preventDefault();
        document.getElementById('control-main')?.focus();
      }} className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-hull-950 focus:px-3 focus:py-2 focus:text-cyan-glow">
        Skip to control room content
      </a>
      <TopCommandBar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <LeftSidebar />
        <main id="control-main" tabIndex={-1} className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <AlertStack />
    </div>
  );
}
