import { describe, expect, it } from "vitest";
import { loadRecordedRun, loadSyntheticRun } from "@/lib/demo/load";
import {
  canAdvance,
  deriveStageStates,
  getGateSeq,
  isGateLocked,
  isOutlineDraftChanged,
  latestReachedExecution,
  visibleEvents,
  visibleReviewIds,
  visibleReviewReportIds,
  visibleRevisionIds,
} from "@/lib/replay/engine";
import type { LocalOverlay } from "@/lib/types/domain";

const run = loadSyntheticRun();
const recorded = loadRecordedRun();

function overlayWith(
  draft = run.outline.events,
  stale = false
): LocalOverlay {
  return {
    outlineDraft: draft.map((event) => ({ ...event })),
    outlineConfirmed: false,
    stale,
    operations: [],
  };
}

describe("replay engine", () => {
  it("starts with every stage not_started and no visible events", () => {
    const states = deriveStageStates(run, 0, overlayWith());
    for (const state of Object.values(states)) {
      expect(state.status).toBe("not_started");
      expect(state.lastEventSeq).toBeNull();
    }
    expect(visibleEvents(run, 0)).toHaveLength(0);
  });

  it("derives the stage status from the last event before the cursor", () => {
    const states = deriveStageStates(run, 3, overlayWith());
    expect(states.intake.status).toBe("completed");
    expect(states.item_transformation.status).toBe("completed");
    expect(states.outline_generation.status).toBe("not_started");
    expect(states.outline_generation.lastEventSeq).toBeNull();
  });

  it("shows the latest attempt after the revision loop", () => {
    const states = deriveStageStates(run, 16, overlayWith());
    expect(states.review_agent.status).toBe("skipped");
    expect(states.review_agent.attempt).toBe(2);
    expect(states.review_agent.revision).toBe("rev_1");
  });

  it("locks the human gate until the outline is confirmed", () => {
    const gateSeq = getGateSeq(run);
    expect(gateSeq).toBe(6);
    if (gateSeq === null) throw new Error("demo run needs a gate");

    expect(canAdvance(run, gateSeq - 1, false)).toBe(true);
    expect(isGateLocked(run, gateSeq, false)).toBe(true);
    expect(canAdvance(run, gateSeq, false)).toBe(false);
    expect(canAdvance(run, gateSeq, true)).toBe(true);

    const locked = deriveStageStates(run, gateSeq, overlayWith());
    expect(locked.outline_confirmation.status).toBe("waiting_human");

    const confirmed = deriveStageStates(run, gateSeq, {
      ...overlayWith(),
      outlineConfirmed: true,
    });
    expect(confirmed.outline_confirmation.status).toBe("completed");
    expect(confirmed.outline_confirmation.localConfirmed).toBe(true);
  });

  it("does not advance past the gate before confirmation", () => {
    expect(canAdvance(run, 6, false)).toBe(false);
    expect(canAdvance(run, 6, true)).toBe(true);
    expect(canAdvance(run, run.events.length, true)).toBe(false);
  });

  it("marks downstream stages stale when the local outline changes", () => {
    const draft = run.outline.events.map((event) => ({ ...event }));
    draft[0].order = 2;
    draft[1].order = 1;

    expect(isOutlineDraftChanged(run, draft)).toBe(true);

    const states = deriveStageStates(run, 16, overlayWith(draft, true));
    expect(states.story_generation.stale).toBe(true);
    expect(states.review_agent.stale).toBe(true);
    expect(states.review_a.stale).toBe(true);
    expect(states.expert_review.stale).toBe(true);
    expect(states.outline_confirmation.stale).toBe(false);
    expect(states.intake.stale).toBe(false);

    // recorded run stays untouched
    expect(run.outline.events[0].order).toBe(1);
    expect(run.outline.events[1].order).toBe(2);
  });

  it("treats a normalised identical outline as unchanged", () => {
    const draft = [...run.outline.events].reverse();
    expect(isOutlineDraftChanged(run, draft)).toBe(false);
  });

  it("does not expose future executions, reviews, or revisions", () => {
    const firstRound = deriveStageStates(recorded, 16, overlayWith());
    expect(firstRound.review_a.attempt).toBe(1);
    expect(firstRound.review_b.attempt).toBe(1);
    expect(firstRound.review_c.attempt).toBe(1);

    const secondRound = deriveStageStates(recorded, 22, overlayWith());
    expect(secondRound.review_a.attempt).toBe(2);
    expect(secondRound.review_b.attempt).toBe(2);
    expect(secondRound.review_c.attempt).toBe(2);

    expect(latestReachedExecution(recorded, "review_agent", 9)?.attempt).toBe(
      1
    );
    expect(latestReachedExecution(recorded, "review_agent", 12)?.attempt).toBe(
      2
    );

    expect(visibleReviewReportIds(recorded, 9).size).toBe(1);
    expect(visibleReviewReportIds(recorded, 12).size).toBe(2);
    expect(visibleReviewIds(recorded, 16).size).toBe(3);
    expect(visibleReviewIds(recorded, 25).size).toBe(6);
    expect([...visibleRevisionIds(recorded, 16)]).toEqual([
      "rev_1",
      "rev_2",
    ]);
    expect(visibleRevisionIds(recorded, 25).size).toBe(3);
  });

  it("stops a recorded run at the outline gate and at the pending expert gate", () => {
    expect(recorded.events).toHaveLength(25);
    expect(recorded.expert_decision.decision).toBe("pending");

    expect(canAdvance(recorded, 4, false)).toBe(true);
    expect(canAdvance(recorded, 5, false)).toBe(false);
    expect(canAdvance(recorded, 5, true)).toBe(true);

    expect(canAdvance(recorded, 23, true)).toBe(true);
    expect(canAdvance(recorded, 24, true)).toBe(false);

    const states = deriveStageStates(recorded, 24, {
      ...overlayWith(),
      outlineConfirmed: true,
    });
    expect(states.intake.status).toBe("completed");
    expect(states.review_a.status).toBe("completed");
    expect(states.expert_review.status).toBe("waiting_human");
    expect(states.finalize.status).toBe("not_started");
  });
});
