import { describe, expect, it } from "vitest";
import { loadRecordedRun, loadSyntheticRun } from "@/lib/demo/load";
import { parseDemoRun, safeParseDemoRun } from "@/lib/schemas/run";
import { buildExportDocument } from "@/lib/storage/exchange";
import type { DemoRunFile } from "@/lib/types/domain";

function cloneRun(): DemoRunFile {
  return structuredClone(loadSyntheticRun());
}

function issues(input: unknown): string[] {
  const result = safeParseDemoRun(input);
  return result.ok ? [] : result.issues;
}

describe("sjt-run/1 schema", () => {
  it("accepts the bundled synthetic run", () => {
    expect(() => parseDemoRun(cloneRun())).not.toThrow();
  });

  it("rejects an item without exactly four options", () => {
    const run = cloneRun();
    run.items[0].options = run.items[0].options.slice(0, 3);
    const messages = issues(run).join("\n");
    expect(messages).toContain("必须恰好包含 4 个选项");
  });

  it("rejects duplicate item ids", () => {
    const run = cloneRun();
    run.items[1].item_id = run.items[0].item_id;
    expect(issues(run).join("\n")).toContain("item_id 必须唯一");
  });

  it("rejects non-UTC timestamps", () => {
    const run = cloneRun();
    run.run.created_at = "2026-10-19 02:00:00";
    expect(issues(run).join("\n")).toContain("UTC");
  });

  it("rejects unknown stage ids", () => {
    const run = cloneRun();
    (run.events[0] as unknown as { stage_id: string }).stage_id = "unknown_stage";
    expect(issues(run).join("\n")).toContain("stage_id");
  });

  it("rejects fabricated review scores on synthetic runs", () => {
    const run = cloneRun();
    run.reviews[0].status = "completed";
    run.reviews[0].item_scores = { "gi-01": { construct: 2 } };
    expect(issues(run).join("\n")).toContain("不得包含真实打分");
  });

  it("rejects review reports on synthetic runs", () => {
    const run = cloneRun();
    run.review_reports.push({
      report_id: "rr-demo",
      attempt: 1,
      model_label: "demo",
      status: "completed",
      reviewed_version: "v1",
      checked_count: 4,
      summary: "demo",
      issues: [],
      source_files: [],
    });
    expect(issues(run).join("\n")).toContain("不得包含审查智能体报告");
  });

  it("rejects a completed expert decision on synthetic runs", () => {
    const run = cloneRun();
    run.expert_decision.decision = "approved";
    expect(issues(run).join("\n")).toContain("不得包含已完成的专家决定");
  });

  it("rejects non-demonstration revisions on synthetic runs", () => {
    const run = cloneRun();
    run.revisions[0].demonstration_only = false;
    expect(issues(run).join("\n")).toContain("demonstration_only");
  });

  it("rejects a run without a human gate", () => {
    const run = cloneRun();
    run.events = run.events.filter((event) => event.type !== "human_gate");
    run.events = run.events.map((event, index) => ({
      ...event,
      seq: index + 1,
    }));
    expect(issues(run).join("\n")).toContain("human_gate");
  });

  it("roundtrips an exported document through the schema", () => {
    const run = cloneRun();
    const exported = buildExportDocument(run, null);
    const parsed = safeParseDemoRun(exported);
    expect(parsed.ok).toBe(true);
  });

  it("accepts the recorded run with integer scores and a pending expert decision", () => {
    const run = structuredClone(loadRecordedRun());
    expect(issues(run)).toEqual([]);
    expect(run.items).toHaveLength(60);
    expect(run.reviews).toHaveLength(6);
    expect(run.review_reports).toHaveLength(2);
    expect(run.scoring_examples).toHaveLength(4);
    expect(
      run.reviews.every(
        (review) =>
          review.item_scores !== null &&
          Object.values(review.item_scores).every((scores) =>
            Object.values(scores).every(
              (score) => Number.isInteger(score) && score >= 0 && score <= 2
            )
          )
      )
    ).toBe(true);
    expect(
      run.reviews.some(
        (review) => review.reviewed_item_version === run.story.version
      )
    ).toBe(true);
    expect(run.expert_decision.decision).toBe("pending");
  });

  it("rejects decimal scores", () => {
    const run = structuredClone(loadRecordedRun());
    run.reviews[0].item_scores!["u-item-01"].construct = 1.5;
    expect(issues(run).join("\n")).toContain("整数");
  });

  it("allows the same reviewer slot across rounds but not within one round", () => {
    const run = structuredClone(loadRecordedRun());
    run.reviews[1].reviewer_slot = run.reviews[0].reviewer_slot;
    run.reviews[1].attempt = run.reviews[0].attempt;
    expect(issues(run).join("\n")).toContain(
      "同一打分轮次中三个智能体的结果不得重复使用同一 reviewer_slot"
    );
  });

  it("rejects review item scores that reference unknown items", () => {
    const run = structuredClone(loadRecordedRun());
    run.reviews[0].item_scores = { "missing-item": { story: 1 } };
    expect(issues(run).join("\n")).toContain("不存在的题目");
  });

  it("rejects review report issues that reference unknown items", () => {
    const run = structuredClone(loadRecordedRun());
    run.review_reports[0].issues[0].scenario_id = "missing-item";
    expect(issues(run).join("\n")).toContain("不存在的题目");
  });
});
