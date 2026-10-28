import rawSynthetic from "@/data/demo/university-placeholder.json";
import rawRecorded from "@/data/runs/university-echoes-2.0.json";
import { parseDemoRun } from "@/lib/schemas/run";
import type { DemoRunFile, RunEntry } from "@/lib/types/domain";

export const RECORDED_RUN_ID = "recorded-univ-echoes-2.0";
export const SYNTHETIC_RUN_ID = "demo-univ-emotional-stability-001";
export const BUNDLED_RUN_ID = RECORDED_RUN_ID;
export const BUNDLED_RUN_IDS = [RECORDED_RUN_ID, SYNTHETIC_RUN_ID];

let recorded: DemoRunFile | null = null;
let synthetic: DemoRunFile | null = null;

export function loadRecordedRun(): DemoRunFile {
  if (!recorded) {
    recorded = parseDemoRun(rawRecorded);
  }
  return recorded;
}

export function loadSyntheticRun(): DemoRunFile {
  if (!synthetic) {
    synthetic = parseDemoRun(rawSynthetic);
  }
  return synthetic;
}

export function loadBundledRun(): DemoRunFile {
  return loadRecordedRun();
}

export function isBundledRunId(id: string): boolean {
  return BUNDLED_RUN_IDS.includes(id);
}

function entryFor(run: DemoRunFile): RunEntry {
  return {
    id: run.run.run_id,
    origin: "bundled",
    importedAt: null,
    run,
  };
}

export function getBundledEntries(): RunEntry[] {
  return [entryFor(loadRecordedRun()), entryFor(loadSyntheticRun())];
}

export function getBundledEntry(): RunEntry {
  return entryFor(loadBundledRun());
}

export function findRunById(
  id: string,
  imported: RunEntry[]
): RunEntry | undefined {
  return (
    imported.find((entry) => entry.id === id) ??
    getBundledEntries().find((entry) => entry.id === id)
  );
}
