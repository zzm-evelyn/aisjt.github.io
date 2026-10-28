import { beforeEach, describe, expect, it } from "vitest";
import { loadRecordedRun, loadSyntheticRun } from "@/lib/demo/load";
import { getGateSeq, isGateLocked } from "@/lib/replay/engine";
import { useWorkspaceStore } from "@/lib/store/workspace-store";

const run = loadSyntheticRun();

function store() {
  return useWorkspaceStore.getState();
}

function advanceToGate() {
  const gateSeq = getGateSeq(run);
  if (gateSeq === null) throw new Error("demo run needs a gate");
  for (let index = 0; index < gateSeq; index += 1) {
    store().step();
  }
  expect(store().cursor).toBe(gateSeq);
}

describe("workspace store", () => {
  it("follows the active stage and keeps the outline gate visible until confirmation", () => {
    store().step();
    expect(store().selectedNodeId).toBe(run.events[0].stage_id);
    advanceToGate();
    expect(store().selectedNodeId).toBe("outline_confirmation");
    store().step();
    expect(store().selectedNodeId).toBe("outline_confirmation");
    store().resetReplay();
    expect(store().selectedNodeId).toBe("intake");
  });

  it("follows timed processing through scoring and opens the library step", () => {
    const recorded = loadRecordedRun();
    store().loadRun(recorded);
    store().play();
    for(let i=0;i<5;i++) store().tick();
    expect(store().playing).toBe(false);
    expect(store().selectedNodeId).toBe("outline_confirmation");
    store().confirmOutline();
    store().play();
    for(let i=0;i<recorded.events.length;i++) store().tick();
    expect(store().cursor).toBe(store().baseRun!.events.length);
    expect(store().selectedNodeId).toBe("finalize");
    expect(store().playing).toBe(false);
  });

  beforeEach(() => {
    store().loadRun(run);
  });

  it("loads a run with a cloned outline draft", () => {
    expect(store().cursor).toBe(0);
    expect(store().overlay?.outlineDraft).toHaveLength(run.outline.events.length);
    expect(store().overlay?.stale).toBe(false);
    expect(store().overlay?.outlineConfirmed).toBe(false);
  });

  it("stops at the human gate and refuses to step before confirmation", () => {
    advanceToGate();
    expect(isGateLocked(run, store().cursor, false)).toBe(true);

    store().step();
    expect(store().cursor).toBe(getGateSeq(run));

    store().confirmOutline();
    expect(store().overlay?.outlineConfirmed).toBe(true);
    expect(store().overlay?.operations).toHaveLength(1);

    store().step();
    expect(store().cursor).toBe((getGateSeq(run) ?? 0) + 1);
  });

  it("records reorder locally without mutating the recorded outline", () => {
    const before = structuredClone(run.outline.events);
    const [first, second] = store().overlay!.outlineDraft;
    store().reorderOutline(first.event_id, second.event_id);

    const draft = store().overlay!.outlineDraft;
    expect(draft[0].event_id).toBe(second.event_id);
    expect(store().overlay?.stale).toBe(true);
    expect(store().overlay?.operations).toHaveLength(1);
    expect(run.outline.events).toEqual(before);
  });

  it("keeps stale after confirming an edited outline", () => {
    const [first, second] = store().overlay!.outlineDraft;
    store().reorderOutline(first.event_id, second.event_id);
    advanceToGate();
    store().confirmOutline();

    expect(store().overlay?.outlineConfirmed).toBe(true);
    expect(store().overlay?.stale).toBe(true);
  });

  it("edits an outline description and marks downstream stale", () => {
    const target = store().overlay!.outlineDraft[0];
    store().updateOutlineDescription(
      target.event_id,
      "本地修改后的事件描述。"
    );
    expect(store().overlay?.outlineDraft[0].description).toBe(
      "本地修改后的事件描述。"
    );
    expect(store().overlay?.stale).toBe(true);
  });

  it("invalidates a confirmation when the outline is edited afterwards", () => {
    advanceToGate();
    store().confirmOutline();
    expect(store().overlay?.outlineConfirmed).toBe(true);

    const [first, second] = store().overlay!.outlineDraft;
    store().reorderOutline(first.event_id, second.event_id);

    expect(store().overlay?.outlineConfirmed).toBe(false);
    expect(store().overlay?.stale).toBe(true);
    expect(store().overlay?.operations.at(-1)?.message).toContain("原确认失效");
  });

  it("resets replay without touching the recorded run", () => {
    advanceToGate();
    const [first, second] = store().overlay!.outlineDraft;
    store().reorderOutline(first.event_id, second.event_id);

    store().resetReplay();

    expect(store().cursor).toBe(0);
    expect(store().overlay?.stale).toBe(false);
    expect(store().overlay?.outlineConfirmed).toBe(false);
    expect(store().overlay?.operations).toHaveLength(0);
    expect(run.events).toHaveLength(17);
  });

  it("does not advance in live mode", () => {
    store().setMode("live");
    store().step();
    expect(store().cursor).toBe(0);
    store().play();
    expect(store().playing).toBe(false);
  });

  it("completes scoring without an expert gate", () => {
    const recorded = loadRecordedRun();
    store().loadRun(recorded);

    for (let index = 0; index < 5; index += 1) {
      store().step();
    }
    store().confirmOutline();
    while (store().cursor < store().baseRun!.events.length) {
      store().step();
    }

    expect(store().cursor).toBe(store().baseRun!.events.length);
    expect(store().overlay?.outlineConfirmed).toBe(true);
    store().play();
    expect(store().playing).toBe(false);
    store().step();
    expect(store().cursor).toBe(store().baseRun!.events.length);
  });
});
