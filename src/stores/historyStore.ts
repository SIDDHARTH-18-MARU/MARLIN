import { create } from 'zustand';
import type { VoyageReport } from '@/types';

interface HistoryState {
  voyages: VoyageReport[];
  selectedVoyageId: string | null;
  addReport: (report: VoyageReport) => void;
  select: (id: string | null) => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  voyages: [],
  selectedVoyageId: null,
  addReport: (report) =>
    set((s) => ({
      voyages: [report, ...s.voyages.filter((v) => v.voyageId !== report.voyageId)].slice(0, 12),
      selectedVoyageId: report.voyageId,
    })),
  select: (id) => set({ selectedVoyageId: id }),
}));
