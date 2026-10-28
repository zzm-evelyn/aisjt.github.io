export const STAGE_IDS = [
  "intake",
  "item_transformation",
  "outline_generation",
  "outline_confirmation",
  "story_generation",
  "review_agent",
  "review_a",
  "review_b",
  "review_c",
  "review_aggregation",
  "auto_revision",
  "expert_review",
  "finalize",
] as const;

export type StageId = (typeof STAGE_IDS)[number];

export const STAGE_LABELS: Record<StageId, string> = {
  intake: "原始条目与构念输入",
  item_transformation: "行为化条目转化",
  outline_generation: "情境事件大纲构建",
  outline_confirmation: "大纲排序与人工确认",
  story_generation: "连续故事与题目生成",
  review_agent: "审查智能体",
  review_a: "打分智能体 A",
  review_b: "打分智能体 B",
  review_c: "打分智能体 C",
  review_aggregation: "打分规则判定",
  auto_revision: "定向修订",
  expert_review: "专家评分",
  finalize: "条目入库与导出",
};

export const STAGE_SHORT_LABELS: Record<StageId, string> = {
  intake: "条目输入",
  item_transformation: "行为化",
  outline_generation: "事件大纲",
  outline_confirmation: "人工确认",
  story_generation: "故事与题目",
  review_agent: "审查智能体",
  review_a: "打分 A",
  review_b: "打分 B",
  review_c: "打分 C",
  review_aggregation: "规则判定",
  auto_revision: "定向修订",
  expert_review: "专家评分",
  finalize: "入库导出",
};

export const REVIEW_SLOTS = ["review_a", "review_b", "review_c"] as const;
export type ReviewSlot = (typeof REVIEW_SLOTS)[number];

export const REVIEW_SLOT_LABELS: Record<ReviewSlot, string> = {
  review_a: "打分智能体 A",
  review_b: "打分智能体 B",
  review_c: "打分智能体 C",
};

export const STAGE_STATUSES = [
  "not_started",
  "queued",
  "running",
  "waiting_human",
  "completed",
  "failed",
  "cancelled",
  "skipped",
] as const;

export type StageStatus = (typeof STAGE_STATUSES)[number];

export const RUN_MODES = ["demo", "live"] as const;
export type RunMode = (typeof RUN_MODES)[number];

export const CONTEXT_IDS = ["university", "travel"] as const;
export type ContextId = (typeof CONTEXT_IDS)[number];

export const CONTEXT_LABELS: Record<ContextId, string> = {
  university: "大学情境",
  travel: "旅行情境",
};

export type ReviewStatus = "not_evaluated" | "completed" | "failed";
export type ReviewRecommendation = "pass" | "revise" | "reject";
export type ScoringRule = "zero_or_two_ones_same_dimension";
export type ExpertDecisionKind =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_revision";

export const RUBRIC_DIMENSIONS = [
  {
    key: "construct",
    label: "构念一致性",
    description: "题目与行为选项是否对应目标 facet 的行为表达。",
  },
  {
    key: "narrative",
    label: "叙事衔接",
    description: "情景是否与前后故事事件自然衔接、语境连贯。",
  },
  {
    key: "fairness",
    label: "公平无偏",
    description: "是否存在不必要的群体刻板印象或社会赞许性偏差。",
  },
  {
    key: "realism",
    label: "现实可行",
    description: "事件、角色与选项是否符合目标情境的实际条件。",
  },
] as const;

export type ParameterValue = string | number | boolean | null;

export type ModelCallInfo = {
  provider: string;
  model_id: string;
  parameters: Record<string, ParameterValue>;
};

export type ConfigSnapshot = {
  context_id: ContextId;
  domain: string;
  facet: string;
  facet_definition: string;
  source_item_ids: string[];
  temperatures: {
    item_transformation: number | null;
    outline_generation: number | null;
    story_generation: number | null;
  };
  rubric_version: string;
  scoring_rule: ScoringRule;
  max_revisions: number;
  batch_size: number;
};

export type Provenance = {
  source: "synthetic_placeholder" | "imported" | "recorded";
  generated_by: string;
  disclaimer: string;
  exported_at: string | null;
};

export type RunInfo = {
  run_id: string;
  project_id: string;
  context_id: ContextId;
  mode: RunMode;
  status: StageStatus;
  is_synthetic: boolean;
  label: string;
  created_at: string;
  config_snapshot: ConfigSnapshot;
  provenance: Provenance;
};

export type SourceItem = {
  source_item_id: string;
  text: string;
  domain: string;
  facet: string;
  reverse_flag: boolean | null;
  note: string;
};

export type PromptVersion = {
  prompt_version_id: string;
  stage_id: StageId;
  version: string;
  template: string;
  created_at: string;
  note: string;
};

export type ModelConfig = {
  model_config_id: string;
  stage_id: StageId;
  provider: string;
  model_id: string;
  supported_params: string[];
  note: string;
};

export type StageExecution = {
  stage_execution_id: string;
  stage_id: StageId;
  attempt: number;
  revision: string | null;
  status: StageStatus;
  model: ModelCallInfo | null;
  prompt_version: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
};

export type RunEvent = {
  seq: number;
  event_id: string;
  at: string;
  type: "stage_status" | "human_gate" | "log";
  stage_id: StageId;
  status: StageStatus;
  message: string;
};

export type OutlineEvent = {
  event_id: string;
  order: number;
  description: string;
  source_item_ids: string[];
  item_ids: string[];
};

export type Outline = {
  outline_version: string;
  confirmed_version: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  events: OutlineEvent[];
};

export type StorySegment = {
  event_id: string;
  text: string;
};

export type Story = {
  story_id: string;
  version: string;
  outline_version: string;
  context_id: ContextId;
  title: string;
  text: string;
  segments: StorySegment[];
};

export type GeneratedOption = {
  option_id: string;
  text: string;
  candidate_level: number | null;
  reverse: boolean | null;
  review_flags: string[];
};

export type ReviewMarker = {
  reviewer_slot: ReviewSlot;
  status: ReviewStatus;
};

export type SjtItem = {
  item_id: string;
  version: string;
  source_item_id: string;
  item_family_id: string;
  domain: string;
  facet: string;
  context_id: ContextId;
  event_id: string;
  stem: string;
  options: GeneratedOption[];
  candidate_scoring_key: string | null;
  expert_confirmed_scoring_key: string | null;
  review_markers: ReviewMarker[];
  note: string;
};

export type ReviewScores = Record<string, number>;
export type ItemScores = Record<string, ReviewScores>;

export type ReviewResult = {
  review_id: string;
  reviewer_slot: ReviewSlot;
  model_label: string;
  status: ReviewStatus;
  attempt: number;
  revision: string | null;
  rubric_version: string;
  reviewed_item_version: string;
  item_scores: ItemScores | null;
  recommendation: ReviewRecommendation | null;
  rationale: string | null;
  issues: string[];
  source_files: string[];
};

export type ReviewIssue = {
  issue_id: string;
  scenario_id: string;
  target_stage: "item_transformation" | "story_generation";
  category: string;
  problem: string;
  before: string;
  after: string;
};

export type ReviewReport = {
  report_id: string;
  attempt: number;
  model_label: string;
  status: ReviewStatus;
  reviewed_version: string;
  checked_count: number;
  summary: string;
  issues: ReviewIssue[];
  source_files: string[];
};

export type ScoringExample = {
  round: number;
  scenario_id: string;
  outcome: "revised" | "passed";
  reason: string;
  before: string;
  after: string;
};

export type RevisionRecord = {
  revision_id: string;
  from_version: string;
  to_version: string;
  reason: string;
  source_review_ids: string[];
  demonstration_only: boolean;
  changed_item_ids: string[];
  before_text: string;
  after_text: string;
};

export type ExpertDecision = {
  decision: ExpertDecisionKind;
  item_version_id: string | null;
  reviewer: string | null;
  comment: string | null;
  decided_at: string | null;
};

export type DemoRunFile = {
  schema_version: string;
  run: RunInfo;
  source_items: SourceItem[];
  prompt_versions: PromptVersion[];
  model_configs: ModelConfig[];
  stages: StageExecution[];
  events: RunEvent[];
  outline: Outline;
  story: Story;
  items: SjtItem[];
  review_reports: ReviewReport[];
  reviews: ReviewResult[];
  scoring_examples: ScoringExample[];
  revisions: RevisionRecord[];
  expert_decision: ExpertDecision;
  limitations: string[];
};

export type LocalOperationKind = "outline_reordered" | "outline_confirmed";

export type LocalOperation = {
  local_id: string;
  at: string;
  stage_id: StageId;
  kind: LocalOperationKind;
  message: string;
};

export type LocalOverlay = {
  outlineDraft: OutlineEvent[];
  outlineConfirmed: boolean;
  stale: boolean;
  operations: LocalOperation[];
};

export type DerivedStage = {
  stage_id: StageId;
  status: StageStatus;
  attempt: number;
  revision: string | null;
  localConfirmed: boolean;
  stale: boolean;
  lastEventSeq: number | null;
};

export type RunEntry = {
  id: string;
  origin: "bundled" | "imported";
  importedAt: string | null;
  run: DemoRunFile;
};

export const DOWNSTREAM_OF_OUTLINE: StageId[] = [
  "story_generation",
  "review_agent",
  "review_a",
  "review_b",
  "review_c",
  "review_aggregation",
  "auto_revision",
  "expert_review",
  "finalize",
];
