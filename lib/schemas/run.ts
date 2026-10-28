import { z } from "zod";
import {
  CONTEXT_IDS,
  REVIEW_SLOTS,
  RUN_MODES,
  STAGE_IDS,
  STAGE_STATUSES,
  type DemoRunFile,
} from "@/lib/types/domain";

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const utcTimestamp = z
  .string()
  .regex(UTC_ISO, "时间必须是 UTC ISO 字符串（以 Z 结尾）");

const stageIdSchema = z.enum(STAGE_IDS);
const stageStatusSchema = z.enum(STAGE_STATUSES);
const contextIdSchema = z.enum(CONTEXT_IDS);
const reviewSlotSchema = z.enum(REVIEW_SLOTS);

const modelCallSchema = z.object({
  provider: z.string().min(1),
  model_id: z.string().min(1),
  parameters: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
  ),
});

const configSnapshotSchema = z.object({
  context_id: contextIdSchema,
  domain: z.string().min(1),
  facet: z.string().min(1),
  facet_definition: z.string().min(1),
  source_item_ids: z.array(z.string().min(1)).min(1),
  temperatures: z.object({
    item_transformation: z.number().min(0).max(2).nullable(),
    outline_generation: z.number().min(0).max(2).nullable(),
    story_generation: z.number().min(0).max(2).nullable(),
  }),
  rubric_version: z.string().min(1),
  scoring_rule: z.enum(["zero_or_two_ones_same_dimension"]),
  max_revisions: z.number().int().min(0).max(10),
  batch_size: z.number().int().min(1),
});

const provenanceSchema = z.object({
  source: z.enum(["synthetic_placeholder", "imported", "recorded"]),
  generated_by: z.string().min(1),
  disclaimer: z.string().min(1),
  exported_at: utcTimestamp.nullable(),
});

const runInfoSchema = z.object({
  run_id: z.string().min(1),
  project_id: z.string().min(1),
  context_id: contextIdSchema,
  mode: z.enum(RUN_MODES),
  status: stageStatusSchema,
  is_synthetic: z.boolean(),
  label: z.string().min(1),
  created_at: utcTimestamp,
  config_snapshot: configSnapshotSchema,
  provenance: provenanceSchema,
});

const sourceItemSchema = z.object({
  source_item_id: z.string().min(1),
  text: z.string().min(1),
  domain: z.string().min(1),
  facet: z.string().min(1),
  reverse_flag: z.boolean().nullable(),
  note: z.string(),
});

const promptVersionSchema = z.object({
  prompt_version_id: z.string().min(1),
  stage_id: stageIdSchema,
  version: z.string().min(1),
  template: z.string().min(1),
  created_at: utcTimestamp,
  note: z.string(),
});

const modelConfigSchema = z.object({
  model_config_id: z.string().min(1),
  stage_id: stageIdSchema,
  provider: z.string().min(1),
  model_id: z.string().min(1),
  supported_params: z.array(z.string()),
  note: z.string(),
});

const stageExecutionSchema = z.object({
  stage_execution_id: z.string().min(1),
  stage_id: stageIdSchema,
  attempt: z.number().int().min(1),
  revision: z.string().nullable(),
  status: stageStatusSchema,
  model: modelCallSchema.nullable(),
  prompt_version: z.string().nullable(),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()).nullable(),
  started_at: utcTimestamp.nullable(),
  completed_at: utcTimestamp.nullable(),
  error: z.string().nullable(),
});

const runEventSchema = z.object({
  seq: z.number().int().min(1),
  event_id: z.string().min(1),
  at: utcTimestamp,
  type: z.enum(["stage_status", "human_gate", "log"]),
  stage_id: stageIdSchema,
  status: stageStatusSchema,
  message: z.string().min(1),
});

const outlineEventSchema = z.object({
  event_id: z.string().min(1),
  order: z.number().int().min(1),
  description: z.string().min(1),
  source_item_ids: z.array(z.string().min(1)),
  item_ids: z.array(z.string().min(1)),
});

const outlineSchema = z.object({
  outline_version: z.string().min(1),
  confirmed_version: z.string().nullable(),
  confirmed_by: z.string().nullable(),
  confirmed_at: utcTimestamp.nullable(),
  events: z.array(outlineEventSchema).min(1),
});

const storySegmentSchema = z.object({
  event_id: z.string().min(1),
  text: z.string().min(1),
});

const storySchema = z.object({
  story_id: z.string().min(1),
  version: z.string().min(1),
  outline_version: z.string().min(1),
  context_id: contextIdSchema,
  title: z.string().min(1),
  text: z.string().min(1),
  segments: z.array(storySegmentSchema).min(1),
});

const optionSchema = z.object({
  option_id: z.string().min(1),
  text: z.string().min(1),
  candidate_level: z.number().int().min(1).max(5).nullable(),
  reverse: z.boolean().nullable(),
  review_flags: z.array(z.string()),
});

const reviewMarkerSchema = z.object({
  reviewer_slot: reviewSlotSchema,
  status: z.enum(["not_evaluated", "completed", "failed"]),
});

const itemSchema = z
  .object({
    item_id: z.string().min(1),
    version: z.string().min(1),
    source_item_id: z.string().min(1),
    item_family_id: z.string().min(1),
    domain: z.string().min(1),
    facet: z.string().min(1),
    context_id: contextIdSchema,
    event_id: z.string().min(1),
    stem: z.string().min(1),
    options: z.array(optionSchema),
    candidate_scoring_key: z.string().nullable(),
    expert_confirmed_scoring_key: z.string().nullable(),
    review_markers: z.array(reviewMarkerSchema),
    note: z.string(),
  })
  .superRefine((item, ctx) => {
    if (item.options.length !== 4) {
      ctx.addIssue({
        code: "custom",
        message: `SJT 题 ${item.item_id} 必须恰好包含 4 个选项`,
        path: ["options"],
      });
    }
    const ids = item.options.map((option) => option.option_id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: `SJT 题 ${item.item_id} 的选项 ID 必须唯一`,
        path: ["options"],
      });
    }
  });

const scoreValueSchema = z
  .number()
  .refine((value) => Number.isInteger(value), "打分必须是 0/1/2 的整数")
  .refine(
    (value) => value >= 0 && value <= 2,
    "打分必须在 0 到 2 之间"
  );
const reviewScoresSchema = z.record(z.string(), scoreValueSchema);

const reviewResultSchema = z.object({
  review_id: z.string().min(1),
  reviewer_slot: reviewSlotSchema,
  model_label: z.string().min(1),
  status: z.enum(["not_evaluated", "completed", "failed"]),
  attempt: z.number().int().min(1).default(1),
  revision: z.string().nullable().default(null),
  rubric_version: z.string().min(1),
  reviewed_item_version: z.string().min(1),
  item_scores: z.record(z.string(), reviewScoresSchema).nullable().default(null),
  recommendation: z.enum(["pass", "revise", "reject"]).nullable(),
  rationale: z.string().nullable(),
  issues: z.array(z.string()),
  source_files: z.array(z.string()).default([]),
});

const reviewIssueSchema = z.object({
  issue_id: z.string().min(1),
  scenario_id: z.string().min(1),
  target_stage: z.enum(["item_transformation", "story_generation"]),
  category: z.string().min(1),
  problem: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
});

const reviewReportSchema = z.object({
  report_id: z.string().min(1),
  attempt: z.number().int().min(1),
  model_label: z.string().min(1),
  status: z.enum(["not_evaluated", "completed", "failed"]),
  reviewed_version: z.string().min(1),
  checked_count: z.number().int().min(0),
  summary: z.string().min(1),
  issues: z.array(reviewIssueSchema),
  source_files: z.array(z.string()).default([]),
});

const scoringExampleSchema = z.object({
  round: z.number().int().min(1),
  scenario_id: z.string().min(1),
  outcome: z.enum(["revised", "passed"]),
  reason: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
});

const revisionRecordSchema = z.object({
  revision_id: z.string().min(1),
  from_version: z.string().min(1),
  to_version: z.string().min(1),
  reason: z.string().min(1),
  source_review_ids: z.array(z.string()),
  demonstration_only: z.boolean(),
  changed_item_ids: z.array(z.string().min(1)),
  before_text: z.string().min(1),
  after_text: z.string().min(1),
});

const expertDecisionSchema = z.object({
  decision: z.enum(["pending", "approved", "rejected", "needs_revision"]),
  item_version_id: z.string().nullable(),
  reviewer: z.string().nullable(),
  comment: z.string().nullable(),
  decided_at: utcTimestamp.nullable(),
});

export const demoRunSchema = z
  .object({
    schema_version: z.literal("sjt-run/1"),
    run: runInfoSchema,
    source_items: z.array(sourceItemSchema).min(1),
    prompt_versions: z.array(promptVersionSchema),
    model_configs: z.array(modelConfigSchema),
    stages: z.array(stageExecutionSchema),
    events: z.array(runEventSchema).min(1),
    outline: outlineSchema,
    story: storySchema,
    items: z.array(itemSchema).min(1),
    review_reports: z.array(reviewReportSchema).default([]),
    reviews: z.array(reviewResultSchema),
    scoring_examples: z.array(scoringExampleSchema).default([]),
    revisions: z.array(revisionRecordSchema),
    expert_decision: expertDecisionSchema,
    limitations: z.array(z.string()).default([]),
  })
  .superRefine((file, ctx) => {
    const sortedEvents = [...file.events].sort((a, b) => a.seq - b.seq);
    sortedEvents.forEach((event, index) => {
      if (event.seq !== index + 1) {
        ctx.addIssue({
          code: "custom",
          message: `事件 seq 必须从 1 连续编号，发现 ${event.seq} 位于第 ${index + 1} 项`,
          path: ["events", index, "seq"],
        });
      }
    });

    if (!file.events.some((event) => event.type === "human_gate")) {
      ctx.addIssue({
        code: "custom",
        message: "运行必须包含一个明确的人工确认检查点（human_gate）",
        path: ["events"],
      });
    }

    const stageExecutionIds = file.stages.map(
      (stage) => stage.stage_execution_id
    );
    if (new Set(stageExecutionIds).size !== stageExecutionIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "stage_execution_id 必须唯一",
        path: ["stages"],
      });
    }

    const itemIds = file.items.map((item) => item.item_id);
    if (new Set(itemIds).size !== itemIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "item_id 必须唯一",
        path: ["items"],
      });
    }

    const outlineEventIds = file.outline.events.map(
      (event) => event.event_id
    );
    if (new Set(outlineEventIds).size !== outlineEventIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "大纲事件 ID 必须唯一",
        path: ["outline", "events"],
      });
    }

    const sortedOrders = [...file.outline.events]
      .map((event) => event.order)
      .sort((a, b) => a - b);
    sortedOrders.forEach((order, index) => {
      if (order !== index + 1) {
        ctx.addIssue({
          code: "custom",
          message: "大纲事件 order 必须从 1 连续编号",
          path: ["outline", "events"],
        });
      }
    });

    const sourceItemIds = new Set(
      file.source_items.map((item) => item.source_item_id)
    );
    for (const item of file.items) {
      if (!sourceItemIds.has(item.source_item_id)) {
        ctx.addIssue({
          code: "custom",
          message: `SJT 题 ${item.item_id} 引用了不存在的原始条目 ${item.source_item_id}`,
          path: ["items"],
        });
      }
    }
    for (const event of file.outline.events) {
      for (const sourceItemId of event.source_item_ids) {
        if (!sourceItemIds.has(sourceItemId)) {
          ctx.addIssue({
            code: "custom",
            message: `大纲事件 ${event.event_id} 引用了不存在的原始条目 ${sourceItemId}`,
            path: ["outline", "events"],
          });
        }
      }
    }
    for (const sourceItemId of file.run.config_snapshot.source_item_ids) {
      if (!sourceItemIds.has(sourceItemId)) {
        ctx.addIssue({
          code: "custom",
          message: `运行配置引用了不存在的原始条目 ${sourceItemId}`,
          path: ["run", "config_snapshot", "source_item_ids"],
        });
      }
    }

    const reviewKeys = file.reviews.map(
      (review) => `${review.reviewer_slot}#${review.attempt}`
    );
    if (new Set(reviewKeys).size !== reviewKeys.length) {
      ctx.addIssue({
        code: "custom",
        message:
          "同一打分轮次中三个智能体的结果不得重复使用同一 reviewer_slot",
        path: ["reviews"],
      });
    }

    const itemIdSet = new Set(itemIds);
    for (const review of file.reviews) {
      for (const itemId of Object.keys(review.item_scores ?? {})) {
        if (!itemIdSet.has(itemId)) {
          ctx.addIssue({
            code: "custom",
            message: `审查 ${review.review_id} 的 item_scores 引用了不存在的题目 ${itemId}`,
            path: ["reviews"],
          });
        }
      }
    }

    for (const segment of file.story.segments) {
      if (!outlineEventIds.includes(segment.event_id)) {
        ctx.addIssue({
          code: "custom",
          message: `故事片段引用了不存在的大纲事件 ${segment.event_id}`,
          path: ["story", "segments"],
        });
      }
    }

    for (const report of file.review_reports) {
      for (const issue of report.issues) {
        if (!itemIdSet.has(issue.scenario_id)) {
          ctx.addIssue({
            code: "custom",
            message: `审查报告 ${report.report_id} 引用了不存在的题目 ${issue.scenario_id}`,
            path: ["review_reports"],
          });
        }
      }
    }

    if (file.run.is_synthetic) {
      for (const review of file.reviews) {
        if (
          review.status !== "not_evaluated" ||
          review.item_scores !== null
        ) {
          ctx.addIssue({
            code: "custom",
            message:
              "合成占位示例不得包含真实打分；请将打分结果标记为 not_evaluated 且评分字段为 null",
            path: ["reviews"],
          });
        }
      }
      if (file.review_reports.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "合成占位示例不得包含审查智能体报告",
          path: ["review_reports"],
        });
      }
      if (file.scoring_examples.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "合成占位示例不得包含真实打分示例",
          path: ["scoring_examples"],
        });
      }
      if (file.expert_decision.decision !== "pending") {
        ctx.addIssue({
          code: "custom",
          message: "合成占位示例不得包含已完成的专家决定",
          path: ["expert_decision", "decision"],
        });
      }
      for (const revision of file.revisions) {
        if (!revision.demonstration_only) {
          ctx.addIssue({
            code: "custom",
            message: "合成占位示例中的修订必须标记 demonstration_only = true",
            path: ["revisions"],
          });
        }
      }
    }
  });

export function parseDemoRun(input: unknown): DemoRunFile {
  return demoRunSchema.parse(input) as DemoRunFile;
}

export type SchemaParseResult =
  | { ok: true; run: DemoRunFile }
  | { ok: false; issues: string[] };

export function safeParseDemoRun(input: unknown): SchemaParseResult {
  const result = demoRunSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, issues: formatSchemaIssues(result.error) };
  }
  return { ok: true, run: result.data as DemoRunFile };
}

export function formatSchemaIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}
