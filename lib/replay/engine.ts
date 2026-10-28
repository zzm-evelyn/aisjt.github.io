import {
  DOWNSTREAM_OF_OUTLINE,
  REVIEW_SLOTS,
  STAGE_IDS,
  type DemoRunFile,
  type DerivedStage,
  type LocalOverlay,
  type OutlineEvent,
  type RunEvent,
  type StageId,
  type StageStatus,
} from "@/lib/types/domain";

export function orderedEvents(run: DemoRunFile): RunEvent[] {
  return [...run.events].sort((a, b) => a.seq - b.seq);
}

export function getHumanGates(run: DemoRunFile): RunEvent[] {
  return orderedEvents(run).filter((event) => event.type === "human_gate");
}

export function getGateEvent(run: DemoRunFile): RunEvent | undefined {
  return getHumanGates(run).find(
    (event) => event.stage_id === "outline_confirmation"
  );
}

export function getGateSeq(run: DemoRunFile): number | null {
  return getGateEvent(run)?.seq ?? null;
}

export function isHumanGateSeq(run: DemoRunFile, seq: number): boolean {
  return run.events.some(
    (event) => event.seq === seq && event.type === "human_gate"
  );
}

export function isGateReached(
  run: DemoRunFile,
  cursor: number
): boolean {
  const gateSeq = getGateSeq(run);
  return gateSeq !== null && cursor >= gateSeq;
}

/**
 * The gate the cursor currently sits on and that still needs an action.
 * Outline confirmation is cleared by the local overlay; the expert gate is
 * cleared only by a recorded expert decision, which this tool cannot invent.
 */
export function lockedGate(
  run: DemoRunFile,
  cursor: number,
  outlineConfirmed: boolean
): RunEvent | undefined {
  const gate = orderedEvents(run).find(
    (event) => event.seq === cursor && event.type === "human_gate"
  );
  if (!gate) return undefined;
  if (gate.stage_id === "outline_confirmation" && outlineConfirmed) {
    return undefined;
  }
  if (
    gate.stage_id === "expert_review" &&
    run.expert_decision.decision !== "pending"
  ) {
    return undefined;
  }
  return gate;
}

export function isGateLocked(
  run: DemoRunFile,
  cursor: number,
  outlineConfirmed: boolean
): boolean {
  return Boolean(lockedGate(run, cursor, outlineConfirmed));
}

export function canAdvance(
  run: DemoRunFile,
  cursor: number,
  outlineConfirmed: boolean
): boolean {
  const total = run.events.length;
  if (cursor >= total) return false;
  return !lockedGate(run, cursor, outlineConfirmed);
}

export function isReplayComplete(run: DemoRunFile, cursor: number): boolean {
  return cursor >= run.events.length;
}

export function visibleEvents(
  run: DemoRunFile,
  cursor: number
): RunEvent[] {
  return orderedEvents(run).filter((event) => event.seq <= cursor);
}

/**
 * Latest execution that has actually been reached at the replay cursor.
 * Executions are matched by execution timestamps; executions without any
 * timestamp only count once an event for that stage is visible.
 */
export function latestReachedExecution(
  run: DemoRunFile,
  stageId: StageId,
  cursor: number
): (typeof run.stages)[number] | undefined {
  const events = visibleEvents(run, cursor);
  const cutoff = events.length ? Date.parse(events[events.length - 1].at) : null;
  const stageReached = events.some((event) => event.stage_id === stageId);

  return [...run.stages]
    .filter((stage) => {
      if (stage.stage_id !== stageId) return false;
      const start = stage.started_at ? Date.parse(stage.started_at) : null;
      const end = stage.completed_at ? Date.parse(stage.completed_at) : null;
      if (start === null && end === null) return stageReached;
      return (
        (start !== null && cutoff !== null && start <= cutoff) ||
        (end !== null && cutoff !== null && end <= cutoff)
      );
    })
    .sort((a, b) => b.attempt - a.attempt)[0];
}

/** Review records whose round has produced a terminal event by the cursor. */
export function visibleReviewIds(
  run: DemoRunFile,
  cursor: number
): Set<string> {
  const events = visibleEvents(run, cursor);
  const ids = new Set<string>();
  for (const slot of REVIEW_SLOTS) {
    const terminal = events.filter(
      (event) =>
        event.stage_id === slot &&
        ["completed", "skipped", "failed"].includes(event.status)
    ).length;
    run.reviews
      .filter((review) => review.reviewer_slot === slot)
      .sort((a, b) => a.attempt - b.attempt)
      .slice(0, terminal)
      .forEach((review) => ids.add(review.review_id));
  }
  return ids;
}

/** Review-agent reports whose review run has completed by the cursor. */
export function visibleReviewReportIds(
  run: DemoRunFile,
  cursor: number
): Set<string> {
  const completed = visibleEvents(run, cursor).filter(
    (event) =>
      event.stage_id === "review_agent" && event.status === "completed"
  ).length;
  return new Set(
    run.review_reports.slice(0, completed).map((report) => report.report_id)
  );
}

/** Revisions whose auto-revision run has completed by the cursor. */
export function visibleRevisionIds(
  run: DemoRunFile,
  cursor: number
): Set<string> {
  const applied = visibleEvents(run, cursor).filter(
    (event) =>
      event.stage_id === "auto_revision" && event.status === "completed"
  ).length;
  return new Set(run.revisions.slice(0, applied).map((r) => r.revision_id));
}

export function deriveStageStates(
  run: DemoRunFile,
  cursor: number,
  overlay: LocalOverlay | null
): Record<StageId, DerivedStage> {
  const states = {} as Record<StageId, DerivedStage>;
  for (const stageId of STAGE_IDS) {
    const execution = latestReachedExecution(run, stageId, cursor);
    states[stageId] = {
      stage_id: stageId,
      status: "not_started",
      attempt: execution?.attempt ?? 0,
      revision: execution?.revision ?? null,
      localConfirmed: false,
      stale: Boolean(
        overlay?.stale && DOWNSTREAM_OF_OUTLINE.includes(stageId)
      ),
      lastEventSeq: null,
    };
  }

  for (const event of orderedEvents(run)) {
    if (event.seq > cursor) break;
    const state = states[event.stage_id];
    if (!state) continue;
    state.status = event.status;
    state.lastEventSeq = event.seq;
  }

  if (overlay?.outlineConfirmed) {
    const confirmation = states.outline_confirmation;
    if (
      confirmation.lastEventSeq !== null &&
      confirmation.status === "waiting_human"
    ) {
      confirmation.status = "completed";
      confirmation.localConfirmed = true;
    }
  }

  return states;
}

export function stageStatusLabel(status: StageStatus): string {
  const labels: Record<StageStatus, string> = {
    not_started: "未开始",
    queued: "排队中",
    running: "运行中",
    waiting_human: "等待人工",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
    skipped: "已跳过",
  };
  return labels[status];
}

export function normalizeOutline(events: OutlineEvent[]): OutlineEvent[] {
  return [...events]
    .sort((a, b) => a.order - b.order)
    .map((event, index) => ({
      event_id: event.event_id,
      order: index + 1,
      description: event.description,
      source_item_ids: [...event.source_item_ids].sort(),
      item_ids: [...event.item_ids].sort(),
    }));
}

export function isOutlineDraftChanged(
  run: DemoRunFile,
  draft: OutlineEvent[]
): boolean {
  return (
    JSON.stringify(normalizeOutline(draft)) !==
    JSON.stringify(normalizeOutline(run.outline.events))
  );
}

export function staleStages(
  run: DemoRunFile,
  draft: OutlineEvent[]
): StageId[] {
  return isOutlineDraftChanged(run, draft) ? DOWNSTREAM_OF_OUTLINE : [];
}

export function gateStatus(
  run: DemoRunFile,
  cursor: number,
  overlay: LocalOverlay | null
): "before" | "waiting" | "confirmed" {
  if (!isGateReached(run, cursor)) return "before";
  return overlay?.outlineConfirmed ? "confirmed" : "waiting";
}
