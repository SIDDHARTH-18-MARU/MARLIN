import { useEffect, useRef } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';

/** Drives the simulation clock via requestAnimationFrame, independent of React render cycles. */
export function useSimulationLoop() {
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (now: number) => {
      if (lastRef.current !== null) {
        const delta = Math.min(250, now - lastRef.current);
        useSimulationStore.getState().tick(delta);
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, []);
}
