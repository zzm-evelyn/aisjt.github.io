"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DemoRunFile, RunEntry } from "@/lib/types/domain";

interface RunsState {
  imported: RunEntry[];
  hydrated: boolean;
  addImportedRun: (run: DemoRunFile) => void;
  removeImportedRun: (runId: string) => void;
  markHydrated: () => void;
}

export const useRunsStore = create<RunsState>()(
  persist(
    (set) => ({
      imported: [],
      hydrated: false,

      addImportedRun: (run) => {
        const entry: RunEntry = {
          id: run.run.run_id,
          origin: "imported",
          importedAt: new Date().toISOString(),
          run,
        };
        set((state) => ({
          imported: [
            entry,
            ...state.imported.filter((existing) => existing.id !== entry.id),
          ],
        }));
      },

      removeImportedRun: (runId) =>
        set((state) => ({
          imported: state.imported.filter((entry) => entry.id !== runId),
        })),

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "sjt:runs:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ imported: state.imported }),
    }
  )
);
