"use client";
import { useLibraryStore } from "@/lib/store/library-store";
import { scoringEligibility } from "@/lib/platform/policy";

import * as React from "react";
import {
  AlertTriangle,
  ChevronRight,
  CircleDashed,
  Cpu,
  Database,
  FileCode2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mono, Separator } from "@/components/ui/misc";
import { StageStatusBadge } from "@/components/workflow/status";
import { OutlineEditor, OutlineRecord } from "@/components/panels/outline-editor";
import { StoryPanel } from "@/components/panels/story-panel";
import { RevisionDiff } from "@/components/panels/revision-diff";
import {
  AggregationPanel,
  FinalizePanel,
  ReviewAgentPanel,
  ScoringPanel,
} from "@/components/panels/review-panel";
import { formatTimestamp } from "@/lib/format";
import {
  deriveStageStates,
  latestReachedExecution,
  visibleRevisionIds,
} from "@/lib/replay/engine";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import {
  STAGE_LABELS,
  type DemoRunFile,
  type StageExecution,
  type StageId,
} from "@/lib/types/domain";

function StageFacts({
  run,
  stageId,
  execution,
}: {
  run: DemoRunFile;
  stageId: StageId;
  execution: StageExecution | undefined;
}) {
  const prompt = execution?.prompt_version
    ? run.prompt_versions.find(
        (version) => version.prompt_version_id === execution.prompt_version
      )
    : run.prompt_versions.find((version) => version.stage_id === stageId);
  const modelConfig = run.model_configs.find(
    (config) => config.stage_id === stageId
  );

  return (
    <div className="space-y-2 rounded border border-line bg-panel-muted/60 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1 text-muted">
          <Database className="size-3" />
          尝试 / 修订
        </span>
        <span className="font-mono text-ink-soft">
          attempt {execution?.attempt ?? "—"}
          {execution?.revision ? ` · ${execution.revision}` : ""}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1 text-muted">
          <Cpu className="size-3" />
          模型
        </span>
        <span className="text-right text-ink-soft">
          {execution?.model
            ? `${execution.model.provider} / ${execution.model.model_id}`
            : modelConfig
              ? `${modelConfig.provider} / ${modelConfig.model_id}`
              : "未调用模型"}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2 text-[11px]">
        <span className="shrink-0 text-muted">时间（UTC）</span>
        <span className="text-right font-mono text-[10px] leading-5 text-ink-soft">
          {formatTimestamp(execution?.started_at ?? null)}
          <ChevronRight className="mx-0.5 inline size-3" />
          {formatTimestamp(execution?.completed_at ?? null)}
        </span>
      </div>
      {prompt ? (
        <details className="group">
          <summary className="cursor-pointer select-none text-[11px] text-muted hover:text-ink-soft">
            提示词 {prompt.version} · <Mono>{prompt.prompt_version_id}</Mono>
          </summary>
          <pre className="thin-scrollbar mt-1.5 max-h-36 overflow-auto whitespace-pre-wrap rounded border border-line bg-panel px-2 py-1.5 font-mono text-[10px] leading-5 text-ink-soft">
            {prompt.template}
          </pre>
          <p className="mt-1 text-[10px] leading-4 text-muted">{prompt.note}</p>
        </details>
      ) : (
        <p className="text-[10px] text-muted">该阶段没有提示词版本记录。</p>
      )}
      {execution?.error ? (
        <p className="rounded border border-danger/20 bg-danger-soft px-2 py-1 text-[10px] leading-4 text-danger">
          {execution.error}
        </p>
      ) : null}
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
        <FileCode2 className="size-3" />
        {title}
      </p>
      <pre className="thin-scrollbar max-h-48 overflow-auto whitespace-pre-wrap rounded border border-line bg-panel-muted px-2 py-1.5 font-mono text-[10px] leading-5 text-ink-soft">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function NotReached({ stageId }: { stageId: StageId }) {
  return (
    <Alert variant="neutral">
      <AlertTitle className="flex items-center gap-1.5">
        <CircleDashed className="size-3.5" />
        尚未执行
      </AlertTitle>
      <AlertDescription>
        任务尚未进入“{STAGE_LABELS[stageId]}”，完成后可查看结果。
      </AlertDescription>
    </Alert>
  );
}

function StageContent({
  run,
  stageId,
  cursor,
  reached,
  outlineReady,
}: {
  run: DemoRunFile;
  stageId: StageId;
  cursor: number;
  reached: boolean;
  outlineReady: boolean;
}) {
  if (stageId === "finalize") return <FinalizePanel run={run} />;
  if (!reached && stageId !== "intake") {
    if (stageId === "outline_confirmation" && outlineReady) {
      return <OutlineEditor run={run} />;
    }
    return <NotReached stageId={stageId} />;
  }

  switch (stageId) {
    case "intake":
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-muted">
            共 {run.source_items.length} 条原始条目
          </p>
          <div className="thin-scrollbar max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {run.source_items.map((item) => (
              <div
                key={item.source_item_id}
                className="rounded border border-line bg-panel px-2.5 py-2"
              >
                <Mono className="text-accent">{item.source_item_id}</Mono>
                <p className="mt-0.5 text-[11.5px] leading-5 text-ink-soft">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    case "item_transformation": {
      const execution = latestReachedExecution(run, stageId, cursor);
      const targets = Array.isArray(execution?.output?.behavioral_targets)
        ? (execution.output.behavioral_targets as Array<{
            source_item_id: string;
            behavioral_description: string;
          }>)
        : [];
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-muted">
            共 {targets.length} 个行为化目标
          </p>
          <div className="thin-scrollbar max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {targets.map((target) => (
              <div
                key={target.source_item_id}
                className="rounded border border-line bg-panel px-2.5 py-2"
              >
                <Mono className="text-accent">{target.source_item_id}</Mono>
                <p className="mt-0.5 text-[11.5px] leading-5 text-ink-soft">
                  {target.behavioral_description}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "outline_generation":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="info">
              <Mono>{run.outline.outline_version}</Mono>
            </Badge>
            <Badge variant="outline">
              {run.outline.events.length} 个事件
            </Badge>
          </div>
          <OutlineRecord run={run} />
          <JsonBlock
            title="阶段输出"
            value={latestReachedExecution(run, stageId, cursor)?.output}
          />
        </div>
      );
    case "outline_confirmation":
      return <OutlineEditor run={run} />;
    case "story_generation":
      return <StoryPanel run={run} />;
    case "review_agent":
      return <ReviewAgentPanel run={run} />;
    case "review_a":
    case "review_b":
    case "review_c":
      return <ScoringPanel run={run} slot={stageId} />;
    case "review_aggregation":
      return <AggregationPanel run={run} />;
    case "auto_revision": {
      const visible = visibleRevisionIds(run, cursor);
      const revisions = run.revisions.filter((revision) =>
        visible.has(revision.revision_id)
      );
      return (
        <div className="space-y-4">
          {revisions.length === 0 ? (
            <p className="text-xs text-muted">当前任务尚无修订记录。</p>
          ) : (
            revisions.map((revision) => (
              <RevisionDiff key={revision.revision_id} revision={revision} />
            ))
          )}
        </div>
      );
    }


    default:
      return null;
  }
}

export function NodeDetailPanel() {
  const entries=useLibraryStore(s=>s.entries);
  const baseRun = useWorkspaceStore((state) => state.baseRun);
  const cursor = useWorkspaceStore((state) => state.cursor);
  const overlay = useWorkspaceStore((state) => state.overlay);
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId);

  if (!baseRun) {
    return (
      <aside className="min-h-0">
        <div className="p-4 text-xs text-muted">尚未载入运行。</div>
      </aside>
    );
  }

  const states = deriveStageStates(baseRun, cursor, overlay);
  states.finalize.status=entries.some(e=>e.id===baseRun.run.run_id+":"+baseRun.story.version)?"completed":scoringEligibility(baseRun,cursor,overlay?.stale??false).ready?"waiting_human":"not_started";
  const state = states[selectedNodeId];
  const execution = latestReachedExecution(baseRun, selectedNodeId, cursor);
  const reached = state.lastEventSeq !== null;
  const outlineReady = states.outline_generation.status === "completed";

  return (
    <aside className="thin-scrollbar flex min-h-0 flex-col gap-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pl-1">
      <div className="rounded-lg border border-line bg-panel">
        <header className="border-b border-line px-3.5 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>

              <h2 className="mt-0.5 font-serif text-[15px] font-semibold leading-6 text-ink">
                {STAGE_LABELS[selectedNodeId]}
              </h2>
            </div>
            <StageStatusBadge
              status={state.status}
              localConfirmed={state.localConfirmed}
            />
          </div>
          <details className="mt-1.5 text-xs text-muted"><summary className="cursor-pointer">版本与执行记录</summary><div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">attempt {state.attempt}</Badge>
            {state.revision ? (
              <Badge variant="gold">{state.revision}</Badge>
            ) : null}
            {state.lastEventSeq !== null ? (
              <Badge variant="muted">seq {state.lastEventSeq}</Badge>
            ) : null}
            {state.stale ? <Badge variant="warning">已过期</Badge> : null}
          </div></details>
        </header>

        <div className="space-y-3 px-3.5 py-3">
          {state.stale ? (
            <Alert variant="warning">
              <AlertTitle className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                已过期（基于旧大纲）
              </AlertTitle>
              <AlertDescription>
                当前大纲已被本地修改。该阶段结果基于旧大纲，不能视为对新大纲的有效结果。
              </AlertDescription>
            </Alert>
          ) : null}

          <details className="technical-details"><summary>模型、提示词与时间记录</summary><StageFacts
            run={baseRun}
            stageId={selectedNodeId}
            execution={execution}
          /></details>

          <Separator />
          <StageContent
            run={baseRun}
            stageId={selectedNodeId}
            cursor={cursor}
            reached={reached}
            outlineReady={outlineReady}
          />

          {execution?.output && reached ? (
            <details>
              <summary className="cursor-pointer select-none text-[10px] uppercase tracking-wide text-muted hover:text-ink-soft">
                原始阶段输出
              </summary>
              <div className="mt-1.5 space-y-2">
                <JsonBlock title="input" value={execution.input} />
                <JsonBlock title="output" value={execution.output} />
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
