"use client";

import { platformRun } from "@/lib/platform/policy";
import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";
import {
  canAdvance,
  getGateSeq,
  isHumanGateSeq,
  isOutlineDraftChanged,
} from "@/lib/replay/engine";
import type {
  DemoRunFile,
  LocalOperation,
  LocalOperationKind,
  LocalOverlay,
  RunMode,
  StageId,
} from "@/lib/types/domain";

type Speed = 0.5 | 1 | 2 | 4;

let localSequence = 0;

function makeLocalOperation(
  kind: LocalOperationKind,
  stageId: StageId,
  message: string
): LocalOperation {
  localSequence += 1;
  return {
    local_id: `local-${Date.now()}-${localSequence}`,
    at: new Date().toISOString(),
    stage_id: stageId,
    kind,
    message,
  };
}

function createOverlay(run: DemoRunFile): LocalOverlay {
  return {
    outlineDraft: run.outline.events
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((event, index) => ({ ...event, order: index + 1 })),
    outlineConfirmed: false,
    stale: false,
    operations: [],
  };
}

export interface WorkspaceState {
  baseRun: DemoRunFile | null;
  cursor: number;
  playing: boolean;
  speed: Speed;
  selectedNodeId: StageId;
  mode: RunMode;
  timelineOpen: boolean;
  overlay: LocalOverlay | null;
  loadRun: (run: DemoRunFile) => void;
  setMode: (mode: RunMode) => void;
  setSpeed: (speed: Speed) => void;
  selectNode: (stageId: StageId) => void;
  toggleTimeline: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  step: () => void;
  tick: () => void;
  resetReplay: () => void;
  reorderOutline: (activeEventId: string, overEventId: string) => void;
  updateOutlineDescription: (eventId: string, description: string) => void;
  confirmOutline: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  baseRun: null,
  cursor: 0,
  playing: false,
  speed: 1,
  selectedNodeId: "intake",
  mode: "demo",
  timelineOpen: false,
  overlay: null,

  loadRun: (source) => {
    const run = platformRun(source);
    set({
      baseRun: run,
      cursor: 0,
      playing: false,
      selectedNodeId: "intake",
      mode: "demo",
      overlay: createOverlay(run),
    });
  },

  setMode: (mode) => {
    set({ mode, playing: false });
  },

  setSpeed: (speed) => set({ speed }),

  selectNode: (stageId) => set({ selectedNodeId: stageId === "expert_review" ? "finalize" : stageId }),

  toggleTimeline: () =>
    set((state) => ({ timelineOpen: !state.timelineOpen })),

  play: () => {
    const { baseRun, cursor, overlay, mode, playing } = get();
    if (!baseRun || mode !== "demo" || playing) return;
    if (
      !canAdvance(
        baseRun,
        cursor,
        overlay?.outlineConfirmed ?? false
      )
    ) {
      return;
    }
    set({ playing: true });
  },

  pause: () => set({ playing: false }),

  togglePlay: () => {
    if (get().playing) {
      get().pause();
    } else {
      get().play();
    }
  },

  step: () => {
    const { baseRun, cursor, overlay, mode } = get();
    if (!baseRun || mode !== "demo") return;
    if (
      !canAdvance(baseRun, cursor, overlay?.outlineConfirmed ?? false)
    ) {
      return;
    }
    set({ cursor: cursor + 1, playing: false, selectedNodeId: cursor + 1 >= baseRun.events.length ? "finalize" : baseRun.events.find(event => event.seq === cursor + 1)?.stage_id ?? get().selectedNodeId });
  },

  tick: () => {
    const { baseRun, cursor, overlay, mode, playing } = get();
    if (!baseRun || mode !== "demo" || !playing) {
      if (playing) set({ playing: false });
      return;
    }
    if (
      !canAdvance(baseRun, cursor, overlay?.outlineConfirmed ?? false)
    ) {
      set({ playing: false });
      return;
    }
    const nextCursor = cursor + 1;
    const shouldPause =
      nextCursor >= baseRun.events.length ||
      isHumanGateSeq(baseRun, nextCursor);
    set({ cursor: nextCursor, playing: shouldPause ? false : playing, selectedNodeId: nextCursor >= baseRun.events.length ? "finalize" : baseRun.events.find(event => event.seq === nextCursor)?.stage_id ?? get().selectedNodeId });
  },

  resetReplay: () => {
    const { baseRun } = get();
    if (!baseRun) return;
    set({
      cursor: 0,
      playing: false,
      selectedNodeId: "intake",
      overlay: createOverlay(baseRun),
    });
  },

  reorderOutline: (activeEventId, overEventId) => {
    const { baseRun, overlay, cursor } = get();
    if (!baseRun || !overlay || activeEventId === overEventId) return;

    const oldIndex = overlay.outlineDraft.findIndex(
      (event) => event.event_id === activeEventId
    );
    const newIndex = overlay.outlineDraft.findIndex(
      (event) => event.event_id === overEventId
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(overlay.outlineDraft, oldIndex, newIndex).map(
      (event, index) => ({ ...event, order: index + 1 })
    );
    const stale = isOutlineDraftChanged(baseRun, reordered);
    if (!stale) {
      set({
        overlay: { ...overlay, outlineDraft: reordered },
      });
      return;
    }

    const invalidatesConfirmation =
      overlay.outlineConfirmed && cursor >= (getGateSeq(baseRun) ?? 0);
    const operation = makeLocalOperation(
      "outline_reordered",
      "outline_confirmation",
      invalidatesConfirmation
        ? "本地调整大纲顺序，原确认失效，需重新确认"
        : "本地调整大纲顺序（未写回原始记录）"
    );

    set({
      overlay: {
        ...overlay,
        outlineDraft: reordered,
        stale: true,
        outlineConfirmed: invalidatesConfirmation
          ? false
          : overlay.outlineConfirmed,
        operations: [...overlay.operations, operation],
      },
      playing: invalidatesConfirmation ? false : get().playing,
    });
  },

  updateOutlineDescription: (eventId, description) => {
    const { baseRun, overlay, cursor } = get();
    if (!baseRun || !overlay) return;
    const trimmed = description.trim();
    if (!trimmed) return;
    const nextDraft = overlay.outlineDraft.map((event) =>
      event.event_id === eventId ? { ...event, description: trimmed } : event
    );
    const stale = isOutlineDraftChanged(baseRun, nextDraft);
    if (!stale) {
      set({ overlay: { ...overlay, outlineDraft: nextDraft } });
      return;
    }

    const invalidatesConfirmation =
      overlay.outlineConfirmed && cursor >= (getGateSeq(baseRun) ?? 0);
    const operation = makeLocalOperation(
      "outline_reordered",
      "outline_confirmation",
      invalidatesConfirmation
        ? "本地编辑大纲描述，原确认失效，需重新确认"
        : "本地编辑大纲事件描述（未写回原始记录）"
    );

    set({
      overlay: {
        ...overlay,
        outlineDraft: nextDraft,
        stale: true,
        outlineConfirmed: invalidatesConfirmation
          ? false
          : overlay.outlineConfirmed,
        operations: [...overlay.operations, operation],
      },
      playing: invalidatesConfirmation ? false : get().playing,
    });
  },

  confirmOutline: () => {
    const { baseRun, overlay, cursor } = get();
    if (!baseRun || !overlay) return;
    const gateSeq = getGateSeq(baseRun);
    if (gateSeq === null || cursor < gateSeq) return;
    if (overlay.outlineConfirmed) return;

    const operation = makeLocalOperation(
      "outline_confirmed",
      "outline_confirmation",
      "local_researcher 确认大纲（任务操作）"
    );

    set({
      overlay: {
        ...overlay,
        outlineConfirmed: true,
        operations: [...overlay.operations, operation],
      },
    });
  },
}));

export type { Speed };
