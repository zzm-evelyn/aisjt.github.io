"use client";

import * as React from "react";
import Link from "next/link";
import { scoringEligibility } from "@/lib/platform/policy";
import { useLibraryStore } from "@/lib/store/library-store";

import {
  ArrowRight,
  BadgeCheck,
  CircleDashed,
  FileText,
  RotateCcw,
  Scale,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/misc";
import {
  visibleReviewIds,
  visibleReviewReportIds,
  visibleRevisionIds,
} from "@/lib/replay/engine";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import {
  REVIEW_SLOTS,
  RUBRIC_DIMENSIONS,
  type DemoRunFile,
  type ReviewIssue,
  type ReviewReport,
  type ReviewResult,
  type ReviewSlot,
  type ScoringExample,
} from "@/lib/types/domain";

function scoreVariant(score: number): "success" | "warning" | "danger" {
  if (score === 2) return "success";
  if (score === 1) return "warning";
  return "danger";
}

function ScoreChip({ score }: { score: number | undefined }) {
  if (typeof score !== "number") {
    return <Badge variant="muted">—</Badge>;
  }
  return <Badge variant={scoreVariant(score)}>{score}</Badge>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-panel-muted/40 px-3 py-4 text-xs text-muted">
      <CircleDashed className="size-3.5" />
      {children}
    </div>
  );
}

function ExampleDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="mb-0.5 text-[10px] text-muted">修改前</p>
        <div className="thin-scrollbar max-h-52 overflow-y-auto rounded border border-rose-200/70 bg-rose-50/50 px-2.5 py-2 text-[11.5px] leading-5 text-ink-soft">
          {before}
        </div>
      </div>
      <div>
        <p className="mb-0.5 text-[10px] text-muted">修改后</p>
        <div className="thin-scrollbar max-h-52 overflow-y-auto rounded border border-emerald-200/70 bg-emerald-50/50 px-2.5 py-2 text-[11.5px] leading-5 text-ink-soft">
          {after}
        </div>
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  defaultOpen,
}: {
  issue: ReviewIssue;
  defaultOpen: boolean;
}) {
  const changed =
    issue.before.trim() !== issue.after.trim();

  return (
    <article className="rounded-lg border border-line bg-panel">
      <header className="flex flex-wrap items-center gap-1.5 border-b border-line/70 px-3 py-2">
        <Mono className="text-accent">{issue.scenario_id}</Mono>
        <Badge variant="outline">
          {issue.target_stage === "item_transformation"
            ? "退回条目转化"
            : "退回故事生成"}
        </Badge>
        <Badge variant="warning">{issue.category}</Badge>
      </header>
      <div className="space-y-2 px-3 py-2.5">
        <p className="text-[12px] leading-5 text-ink">{issue.problem}</p>
        <details open={defaultOpen} className="group">
          <summary className="cursor-pointer select-none text-[11px] text-muted hover:text-ink-soft">
            修改前后对比
          </summary>
          <div className="mt-2 space-y-2">
            {changed ? (
              <ExampleDiff before={issue.before} after={issue.after} />
            ) : (
              <p className="rounded border border-line bg-panel-muted/40 px-2.5 py-2 text-[11.5px] leading-5 text-ink-soft">
                {issue.after}
              </p>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}

function ReportView({ report }: { report: ReviewReport }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-muted">
              {report.model_label} · 审查对象 {report.reviewed_version}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-ink">
              审查 {report.checked_count} 个情景，记录 {report.issues.length}{" "}
              个问题示例
            </p>
          </div>
          <Badge variant="warning">
            <RotateCcw className="size-3" />
            退回修订
          </Badge>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-5 text-ink-soft">
          {report.summary}
        </p>
        <p className="mt-1 text-[10px] text-muted">
          问题定位到条目或故事后重写，再审直到没有问题，才进入打分。
        </p>
      </div>

      {report.issues.map((issue, index) => (
        <IssueCard
          key={issue.issue_id}
          issue={issue}
          defaultOpen={index === 0}
        />
      ))}

      {report.source_files.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1 text-[10px] leading-4 text-muted">
          <FileText className="size-3" />
          来源：
          {report.source_files.map((file) => (
            <Mono key={file}>{file}</Mono>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function ReviewAgentPanel({ run }: { run: DemoRunFile }) {
  const cursor = useWorkspaceStore((state) => state.cursor);
  const visible = visibleReviewReportIds(run, cursor);
  const reports = run.review_reports
    .filter((report) => visible.has(report.report_id))
    .sort((a, b) => a.attempt - b.attempt);
  const [attempt, setAttempt] = React.useState<number | null>(null);

  if (reports.length === 0) {
    return <EmptyState>当前任务尚无审查报告。</EmptyState>;
  }

  const current =
    reports.find((report) => report.attempt === attempt) ??
    reports[reports.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {reports.map((report) => (
          <button
            key={report.report_id}
            type="button"
            onClick={() => setAttempt(report.attempt)}
            className={
              report.attempt === current.attempt
                ? "rounded-md border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink"
                : "rounded-md border border-line bg-panel px-2.5 py-1 text-[11px] text-ink-soft hover:border-line-strong"
            }
          >
            第 {report.attempt} 轮 · {report.reviewed_version} ·{" "}
            {report.issues.length} 例
          </button>
        ))}
      </div>
      <ReportView report={current} />
    </div>
  );
}

function itemById(run: DemoRunFile, itemId: string) {
  return run.items.find((item) => item.item_id === itemId);
}

function lowScoreItems(review: ReviewResult): Array<{
  itemId: string;
  scores: Record<string, number>;
}> {
  if (!review.item_scores) return [];
  return Object.entries(review.item_scores)
    .filter(([, scores]) =>
      RUBRIC_DIMENSIONS.some((dimension) => (scores[dimension.key] ?? 2) < 2)
    )
    .map(([itemId, scores]) => ({ itemId, scores }))
    .sort((a, b) => {
      const minA = Math.min(
        ...RUBRIC_DIMENSIONS.map((d) => a.scores[d.key] ?? 2)
      );
      const minB = Math.min(
        ...RUBRIC_DIMENSIONS.map((d) => b.scores[d.key] ?? 2)
      );
      return minA - minB || a.itemId.localeCompare(b.itemId);
    });
}

function Dimensions({ scores }: { scores: Record<string, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {RUBRIC_DIMENSIONS.map((dimension) => (
        <span
          key={dimension.key}
          className="inline-flex items-center gap-1 text-[10px] text-muted"
          title={dimension.description}
        >
          {dimension.label}
          <ScoreChip score={scores[dimension.key]} />
        </span>
      ))}
    </div>
  );
}

export function ScoringPanel({
  run,
  slot,
}: {
  run: DemoRunFile;
  slot: ReviewSlot;
}) {
  const cursor = useWorkspaceStore((state) => state.cursor);
  const visible = visibleReviewIds(run, cursor);
  const reviews = run.reviews
    .filter(
      (review) =>
        visible.has(review.review_id) && review.reviewer_slot === slot
    )
    .sort((a, b) => a.attempt - b.attempt);
  const [attempt, setAttempt] = React.useState<number | null>(null);

  if (reviews.length === 0) {
    return <EmptyState>当前任务尚无该智能体的打分记录。</EmptyState>;
  }

  const current =
    reviews.find((review) => review.attempt === attempt) ??
    reviews[reviews.length - 1];
  const allEntries = Object.entries(current.item_scores ?? {});
  const low = lowScoreItems(current);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {reviews.map((review) => (
          <button
            key={review.review_id}
            type="button"
            onClick={() => setAttempt(review.attempt)}
            className={
              review.attempt === current.attempt
                ? "rounded-md border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink"
                : "rounded-md border border-line bg-panel px-2.5 py-1 text-[11px] text-ink-soft hover:border-line-strong"
            }
          >
            第 {review.attempt} 轮 · {review.reviewed_item_version}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-muted">
              对象 {current.reviewed_item_version} ·{" "}
              {current.rubric_version}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-ink">
              {current.model_label}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">0 / 1 / 2 整数</Badge>
            <Badge variant="muted">{allEntries.length} 题</Badge>
            <Badge variant={low.length > 0 ? "warning" : "success"}>
              非满分 {low.length}
            </Badge>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-ink-soft">
          {current.rationale ?? "存档未记录打分说明。"}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">
          非满分项
        </p>
        {low.length === 0 ? (
          <p className="rounded border border-line bg-panel-muted/40 px-2.5 py-2 text-[11px] text-muted">
            本轮所有题目四维均为 2 分。
          </p>
        ) : (
          <div className="space-y-1.5">
            {low.map(({ itemId, scores }) => {
              const item = itemById(run, itemId);
              return (
                <div
                  key={itemId}
                  className="rounded border border-line bg-panel px-2.5 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Mono className="text-accent">{itemId}</Mono>
                    <Dimensions scores={scores} />
                  </div>
                  {item ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted">
                      {item.stem}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <details className="rounded border border-line bg-panel-muted/30 px-2.5 py-2">
        <summary className="cursor-pointer select-none text-[10px] text-muted hover:text-ink-soft">
          全部 {allEntries.length} 题评分
        </summary>
        <div className="thin-scrollbar mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
          {allEntries.map(([itemId, scores]) => (
            <div
              key={itemId}
              className="flex flex-wrap items-center justify-between gap-1 rounded border border-line/70 bg-panel px-2 py-1"
            >
              <Mono className="text-[10px] text-ink-soft">{itemId}</Mono>
              <Dimensions scores={scores} />
            </div>
          ))}
        </div>
      </details>

      {current.source_files.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1 text-[10px] leading-4 text-muted">
          <FileText className="size-3" />
          来源：
          {current.source_files.map((file) => (
            <Mono key={file}>{file}</Mono>
          ))}
        </p>
      ) : null}
    </div>
  );
}

type RoundItemScore = {
  itemId: string;
  scores: Record<ReviewSlot, Record<string, number> | null>;
  trigger: boolean;
};

function completeRound(run: DemoRunFile, reviews: ReviewResult[]) {
 return reviews.length===3 && REVIEW_SLOTS.every(slot=>reviews.filter(r=>r.reviewer_slot===slot&&r.status==="completed").length===1)
 && new Set(reviews.map(r=>r.reviewed_item_version)).size===1
 && reviews.every(r=>r.rubric_version===run.run.config_snapshot.rubric_version && run.items.every(item=>RUBRIC_DIMENSIONS.every(d=>[0,1,2].includes(r.item_scores?.[item.item_id]?.[d.key] as number))));
}

function buildRoundItems(reviews: ReviewResult[]): RoundItemScore[] {
  const bySlot = new Map<ReviewSlot, ReviewResult>();
  for (const review of reviews) bySlot.set(review.reviewer_slot, review);

  const itemIds = new Set<string>();
  for (const review of reviews) {
    for (const itemId of Object.keys(review.item_scores ?? {})) {
      itemIds.add(itemId);
    }
  }

  return Array.from(itemIds)
    .sort()
    .map((itemId) => {
      const scores = {} as Record<
        ReviewSlot,
        Record<string, number> | null
      >;
      for (const slot of REVIEW_SLOTS) {
        scores[slot] = bySlot.get(slot)?.item_scores?.[itemId] ?? null;
      }
      const hasZero = REVIEW_SLOTS.some((slot) =>
        RUBRIC_DIMENSIONS.some(
          (dimension) => scores[slot]?.[dimension.key] === 0
        )
      );
      const twoOnes = RUBRIC_DIMENSIONS.some(
        (dimension) =>
          REVIEW_SLOTS.filter(
            (slot) => scores[slot]?.[dimension.key] === 1
          ).length >= 2
      );
      return { itemId, scores, trigger: hasZero || twoOnes };
    });
}

function triggerReason(item: RoundItemScore): string {
  for (const slot of REVIEW_SLOTS) {
    for (const dimension of RUBRIC_DIMENSIONS) {
      if (item.scores[slot]?.[dimension.key] === 0) {
        return `${dimension.label} 0 分`;
      }
    }
  }
  for (const dimension of RUBRIC_DIMENSIONS) {
    const ones = REVIEW_SLOTS.filter(
      (slot) => item.scores[slot]?.[dimension.key] === 1
    ).length;
    if (ones >= 2) return `${dimension.label} ${ones} 个 1 分`;
  }
  return "";
}

function TriggerCard({
  item,
  run,
}: {
  item: RoundItemScore;
  run: DemoRunFile;
}) {
  const scenario = itemById(run, item.itemId);
  return (
    <div className="rounded-lg border border-warning/30 bg-warning-soft/30 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Mono className="text-accent">{item.itemId}</Mono>
          <Badge variant="warning">{triggerReason(item)}</Badge>
        </div>
      </div>
      {scenario ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-ink-soft">
          {scenario.stem}
        </p>
      ) : null}
      <div className="mt-1.5 space-y-1">
        {REVIEW_SLOTS.map((slot) => (
          <div
            key={slot}
            className="flex flex-wrap items-center justify-between gap-1 text-[10px]"
          >
            <span className="text-muted">
              {slot.replace("review_", "").toUpperCase()}
            </span>
            {item.scores[slot] ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {RUBRIC_DIMENSIONS.map((dimension) => (
                  <span
                    key={dimension.key}
                    className="inline-flex items-center gap-0.5 text-muted"
                  >
                    {dimension.label}
                    <ScoreChip
                      score={item.scores[slot]?.[dimension.key]}
                    />
                  </span>
                ))}
              </div>
            ) : (
              <Badge variant="muted">无记录</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoringExampleCard({ example }: { example: ScoringExample }) {
  const changed = example.before.trim() !== example.after.trim();
  return (
    <article className="rounded-lg border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-1.5 border-b border-line/70 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Mono className="text-accent">{example.scenario_id}</Mono>
          <Badge variant="outline">第 {example.round} 轮</Badge>
        </div>
        <Badge variant={example.outcome === "revised" ? "warning" : "success"}>
          {example.outcome === "revised" ? "触发修改" : "未触发，保留"}
        </Badge>
      </header>
      <div className="space-y-2 px-3 py-2.5">
        <p className="text-[11.5px] leading-5 text-ink-soft">
          {example.reason}
        </p>
        {changed ? (
          <ExampleDiff before={example.before} after={example.after} />
        ) : (
          <p className="rounded border border-line bg-panel-muted/30 px-2.5 py-2 text-[11.5px] leading-5 text-ink-soft">
            {example.after}
          </p>
        )}
      </div>
    </article>
  );
}

export function AggregationPanel({ run }: { run: DemoRunFile }) {
  const cursor = useWorkspaceStore((state) => state.cursor);
  const visibleReviews = visibleReviewIds(run, cursor);
  const reviews = run.reviews.filter((review) =>
    visibleReviews.has(review.review_id)
  );
  const visibleRevisions = visibleRevisionIds(run, cursor);
  const revisions = run.revisions.filter((revision) =>
    visibleRevisions.has(revision.revision_id)
  );
  const doneRounds = run.events.filter(
    (event) =>
      event.seq <= cursor &&
      event.stage_id === "review_aggregation" &&
      event.status === "completed"
  ).length;
  const rounds = Array.from(
    new Set(reviews.map((review) => review.attempt))
  )
    .filter((attempt) => attempt <= doneRounds)
    .sort((a, b) => a - b);
  const examples = run.scoring_examples.filter(
    (example) => example.round <= doneRounds
  );
  const finalVersion =
    revisions[revisions.length - 1]?.to_version ?? run.story.version;
  const lastAttempt = rounds[rounds.length - 1];
  const passed =
    lastAttempt !== undefined && completeRound(run, reviews.filter(r=>r.attempt===lastAttempt)) &&
    buildRoundItems(
      reviews.filter((review) => review.attempt === lastAttempt)
    ).every((item) => !item.trigger);

  if (rounds.length === 0) {
    return <EmptyState>当前任务尚无打分汇总。</EmptyState>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <Scale className="size-3.5 text-accent" />
          打分规则
        </div>
        <ul className="mt-1.5 space-y-1 text-[11.5px] leading-5 text-ink-soft">
          <li className="flex items-start gap-1.5">
            <ArrowRight className="mt-1 size-3 shrink-0 text-warning" />
            任一智能体在任一维度给出 0 分，触发修改。
          </li>
          <li className="flex items-start gap-1.5">
            <ArrowRight className="mt-1 size-3 shrink-0 text-warning" />
            同一维度有两个及以上智能体给出 1 分，触发修改。
          </li>
          <li className="flex items-start gap-1.5">
            <ArrowRight className="mt-1 size-3 shrink-0 text-success" />
            三路评分完整且未触发修订时，可进入题目库。
          </li>
        </ul>
      </div>

      {rounds.map((attempt) => {
        const roundReviews = reviews.filter(
          (review) => review.attempt === attempt
        );
        const complete = completeRound(run, roundReviews);
        const items = buildRoundItems(roundReviews);
        const triggers = items.filter((item) => item.trigger);
        const version = roundReviews[0]?.reviewed_item_version;
        return (
          <div key={attempt} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-[12px] font-semibold text-ink">
                第 {attempt} 轮 · {version}
              </p>
              <Badge variant={!complete || triggers.length > 0 ? "warning" : "success"}>
                {!complete ? "评分不完整" : triggers.length > 0
                  ? `触发 ${triggers.length} 项`
                  : "无触发项"}
              </Badge>
            </div>
            {!complete ? <p className="text-xs text-warning">评分记录不完整，暂不判定通过。</p> : triggers.length > 0 ? (
              <div className="space-y-1.5">
                {triggers.map((item) => (
                  <TriggerCard key={item.itemId} item={item} run={run} />
                ))}
              </div>
            ) : (
              <p className="rounded border border-success/20 bg-success-soft/40 px-2.5 py-2 text-[11px] text-success">
                本轮未触发修订；三路评分完整后可入库。
              </p>
            )}
          </div>
        );
      })}

      {passed && doneRounds > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-line bg-panel-muted/40 px-2.5 py-2">
          <BadgeCheck className="size-3.5 text-success" />
          <span className="text-[11px] text-ink-soft">
            最终候选版本 <Mono>{finalVersion}</Mono>
            {"，可查看入库条件。"}
          </span>
        </div>
      ) : null}

      {examples.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted">
            判定示例
          </p>
          {examples.map((example) => (
            <ScoringExampleCard
              key={`${example.round}-${example.scenario_id}`}
              example={example}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FinalizePanel({ run }: { run: DemoRunFile }) {
 const cursor=useWorkspaceStore(s=>s.cursor);
 const stale=useWorkspaceStore(s=>s.overlay?.stale??false);
 const entries=useLibraryStore(s=>s.entries);
 const add=useLibraryStore(s=>s.add);
 React.useEffect(()=>{void useLibraryStore.persist.rehydrate();},[]);
 const eligibility=scoringEligibility(run,cursor,stale);
 const saved=entries.some(e=>e.id===run.run.run_id+":"+run.story.version);
 return <div className="space-y-4"><Alert variant={eligibility.ready?"neutral":"warning"}><AlertTitle>{saved?"已保存到题目库":eligibility.ready?"评分已通过，可以入库":"暂不可入库"}</AlertTitle><AlertDescription>{eligibility.reason}</AlertDescription></Alert><p className="text-sm text-ink-soft">当前版本 {run.story.version} · {run.items.length} 道题目</p><button type="button" className="primary-link disabled:opacity-40" disabled={!eligibility.ready||saved} onClick={()=>add(run,cursor,stale)}>{saved?"已入库":"确认入库"}</button><Link href="/library" className="quiet-link ml-4">查看题目库 →</Link></div>;
}
