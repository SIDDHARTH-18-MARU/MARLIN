import { lazy, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Landing } from '@/pages/Landing';
import { PlanVoyage } from '@/pages/PlanVoyage';
import { RouteAnalysis } from '@/pages/RouteAnalysis';
import { CommandCenter } from '@/pages/CommandCenter';
import { Methodology } from '@/pages/Methodology';
import { AssetLibrary } from '@/pages/AssetLibrary';
import { CaptainShell } from '@/features/captain/CaptainShell';
import { RoutePanel } from '@/features/captain/RoutePanel';
import { EnvironmentPanel } from '@/features/captain/EnvironmentPanel';
import { AlertPanel } from '@/features/captain/AlertPanel';
import { CommunicationPanel } from '@/features/captain/CommunicationPanel';
import { useSimulationLoop } from '@/hooks/useSimulationLoop';

const VoyageHistory = lazy(() => import('@/pages/VoyageHistory').then(module => ({ default: module.VoyageHistory })));
const Analytics = lazy(() => import('@/pages/Analytics').then(module => ({ default: module.Analytics })));
const loadingReport = <p role="status" className="p-6 text-sm text-hull-300">Loading voyage analysis…</p>;

export default function App() {
  useSimulationLoop();
  return (
    <MotionConfig reducedMotion="user"><HashRouter>
      <Routes>
        {/* Control Room — the shore-side operations face. */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/plan" element={<PlanVoyage />} />
          <Route path="/route-analysis" element={<RouteAnalysis />} />
          <Route path="/command-center" element={<CommandCenter />} />
          <Route path="/history" element={<Suspense fallback={loadingReport}><VoyageHistory /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={loadingReport}><Analytics /></Suspense>} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/assets" element={<AssetLibrary />} />
        </Route>

        {/* Captain Bridge — the vessel-side face. Its own shell and chrome,
            reading the same voyage and simulation stores. */}
        <Route path="/captain" element={<CaptainShell />}>
          <Route index element={<Navigate to="/captain/bridge" replace />} />
          {/* The bridge view is rendered by the shell itself so the WebGL
              scene stays mounted across tab changes. */}
          <Route path="bridge" element={null} />
          <Route path="route" element={<RoutePanel />} />
          <Route path="environment" element={<EnvironmentPanel />} />
          <Route path="alerts" element={<AlertPanel />} />
          <Route path="communications" element={<CommunicationPanel />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter></MotionConfig>
  );
}
