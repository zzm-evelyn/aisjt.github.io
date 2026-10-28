import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NodeDetailPanel } from "@/components/panels/node-detail-panel";
import { OutlineEditor } from "@/components/panels/outline-editor";
import { LiveModePanel } from "@/components/panels/live-mode-panel";
import { RevisionDiff } from "@/components/panels/revision-diff";
import { ReplayControls } from "@/components/layout/replay-controls";
import { loadRecordedRun, loadSyntheticRun } from "@/lib/demo/load";
import { getGateSeq } from "@/lib/replay/engine";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import type { StageId } from "@/lib/types/domain";

const run = loadSyntheticRun();
const recorded = loadRecordedRun();

function store() {
  return useWorkspaceStore.getState();
}

function advanceTo(target: number) {
  const gate = getGateSeq(run);
  act(() => {
    while (store().cursor < Math.min(target, store().baseRun!.events.length)) {
      if (
        gate !== null &&
        store().cursor === gate &&
        !store().overlay?.outlineConfirmed
      ) {
        store().confirmOutline();
      }
      store().step();
    }
  });
}

function advanceRecordedTo(target: number) {
  act(() => {
    for (let index = 0; index < 5; index += 1) store().step();
    store().confirmOutline();
    while (store().cursor < Math.min(target, store().baseRun!.events.length)) store().step();
  });
}

function select(stageId: StageId) {
  act(() => {
    store().selectNode(stageId);
  });
}

describe("workspace panels", () => {
  beforeEach(() => {
    act(() => {
      store().loadRun(run);
    });
  });

  it("shows a not-yet-executed state before the cursor reaches a node", () => {
    select("story_generation");
    render(<NodeDetailPanel />);
    expect(screen.getByText("尚未执行")).toBeInTheDocument();
    expect(screen.getByText("连续故事与题目生成")).toBeInTheDocument();
  });

  it("renders the story, four items and sixteen options after generation", () => {
    advanceTo(9);
    select("story_generation");
    render(<NodeDetailPanel />);

    expect(screen.getByText("答辩前的临时通知")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /题目与选项/ }));

    expect(screen.getAllByText(/^\d 分$/)).toHaveLength(16);
    expect(screen.queryByText("专家评分：")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^A$/).length).toBeGreaterThan(0);
  });

  it("shows an empty review-agent state when no report was recorded", () => {
    advanceTo(11);
    select("review_agent");
    render(<NodeDetailPanel />);

    expect(
      screen.getByText("当前任务尚无审查报告。")
    ).toBeInTheDocument();
  });

  it("keeps synthetic scoring agents unevaluated", () => {
    advanceTo(11);
    select("review_a");
    render(<NodeDetailPanel />);

    expect(
      screen.getByText("打分智能体 A（占位，未运行）")
    ).toBeInTheDocument();
    expect(screen.getByText("0 / 1 / 2 整数")).toBeInTheDocument();
    expect(screen.getByText("非满分 0")).toBeInTheDocument();
    expect(
      screen.queryByText("触发修改")
    ).not.toBeInTheDocument();
  });

  it("renders recorded review-agent issues with before/after examples", () => {
    act(() => {
      store().loadRun(recorded);
    });
    advanceRecordedTo(12);
    select("review_agent");
    render(<NodeDetailPanel />);

    expect(
      screen.getByText("审查 60 个情景，记录 6 个问题示例")
    ).toBeInTheDocument();
    expect(screen.getAllByText("退回条目转化").length).toBeGreaterThan(0);
    expect(screen.getByText("u-item-02")).toBeInTheDocument();
    expect(screen.getAllByText("修改前后对比").length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: /第 1 轮 · v1 · 6 例/ })
    );
    expect(screen.getByText("u-item-05")).toBeInTheDocument();
    expect(screen.getAllByText("退回故事生成").length).toBeGreaterThan(0);
  });

  it("renders recorded scoring rounds with integer scores", () => {
    act(() => {
      store().loadRun(recorded);
    });
    advanceRecordedTo(23);
    select("review_a");
    render(<NodeDetailPanel />);

    expect(
      screen.getByRole("button", { name: /第 2 轮 · v4/ })
    ).toBeInTheDocument();
    expect(screen.getByText("GPT（具体版本未记录）")).toBeInTheDocument();
    expect(screen.getByText(/非满分 \d+/)).toBeInTheDocument();
    expect(screen.getByText(/来源：/)).toBeInTheDocument();
    expect(screen.queryByText(/\d\.\d/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /第 1 轮 · v3/ })
    );
    expect(screen.getByText(/非满分 \d+/)).toBeInTheDocument();
  });

  it("shows aggregation triggers and passing examples", () => {
    act(() => {
      store().loadRun(recorded);
    });
    advanceRecordedTo(23);
    select("review_aggregation");
    render(<NodeDetailPanel />);

    expect(
      screen.getByText("任一智能体在任一维度给出 0 分，触发修改。")
    ).toBeInTheDocument();
    expect(screen.getByText("触发 8 项")).toBeInTheDocument();
    expect(screen.getByText("无触发项")).toBeInTheDocument();
    expect(screen.getAllByText("u-item-14").length).toBeGreaterThan(0);
    expect(screen.getAllByText("触发修改").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未触发，保留").length).toBeGreaterThan(0);
  });

  it("marks downstream nodes stale after an outline edit", () => {
    advanceTo(17);
    act(() => {
      const [first, second] = store().overlay!.outlineDraft;
      store().reorderOutline(first.event_id, second.event_id);
      store().selectNode("finalize");
    });
    render(<NodeDetailPanel />);

    expect(screen.getByText("已过期（基于旧大纲）")).toBeInTheDocument();
    expect(screen.getByText("暂不可入库")).toBeInTheDocument();
  });

  it("enables outline confirmation only at the human gate and records it locally", () => {
    render(<OutlineEditor run={run} />);
    const disabled = screen.getByRole("button", {
      name: /任务尚未到达人工检查点/,
    });
    expect(disabled).toBeDisabled();

    advanceTo(getGateSeq(run) ?? 0);
    const confirm = screen.getByRole("button", {
      name: /确认大纲并允许继续任务/,
    });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    fireEvent.click(screen.getByRole("button", { name: "确认大纲" }));

    expect(store().overlay?.outlineConfirmed).toBe(true);
    expect(store().overlay?.operations.at(-1)?.kind).toBe("outline_confirmed");
  });

  it("locks replay controls at the gate until confirmation", () => {
    advanceTo(getGateSeq(run) ?? 0);
    render(<ReplayControls />);
    expect(screen.getByRole("button", { name: "启动任务" })).toBeDisabled();
    act(() => store().confirmOutline());
    expect(screen.getByRole("button", { name: "启动任务" })).toBeEnabled();
  });

  it("renders the revision diff with added and removed fragments", () => {
    const { container } = render(
      <RevisionDiff revision={run.revisions[0]} />
    );
    expect(screen.getByText("该修订未关联评分记录")).toBeInTheDocument();
    expect(container.querySelector("ins")).not.toBeNull();
    expect(container.querySelector("del")).not.toBeNull();
    const added = Array.from(container.querySelectorAll("ins"))
      .map((node) => node.textContent)
      .join("");
    const removed = Array.from(container.querySelectorAll("del"))
      .map((node) => node.textContent)
      .join("");
    expect(added).toContain("口头部分");
    expect(removed).toContain("别紧张");
  });

  it("reports the backend as disconnected in live mode", () => {
    render(<LiveModePanel />);
    expect(screen.getByText("实时模式：Flask 后端未连接")).toBeInTheDocument();
    expect(screen.getByText("没有可用的实时数据")).toBeInTheDocument();
    expect(screen.queryByText(/运行已创建/)).not.toBeInTheDocument();
  });
});
