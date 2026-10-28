"use client";

import { BookOpenText, CircleHelp, FileDiff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Mono } from "@/components/ui/misc";
import { RevisionDiff } from "@/components/panels/revision-diff";
import { visibleRevisionIds } from "@/lib/replay/engine";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import {
  REVIEW_SLOTS,
  REVIEW_SLOT_LABELS,
  type DemoRunFile,
} from "@/lib/types/domain";

export function StoryPanel({ run }: { run: DemoRunFile }) {
  const cursor = useWorkspaceStore((state) => state.cursor);
  const visibleRevisions = visibleRevisionIds(run, cursor);
  const revisions = run.revisions.filter((revision) =>
    visibleRevisions.has(revision.revision_id)
  );
  const eventOrder = new Map(
    run.outline.events.map((event) => [event.event_id, event])
  );

  return (
    <Tabs defaultValue="story">
      <TabsList>
        <TabsTrigger value="story">
          <BookOpenText className="size-3" />
          故事
        </TabsTrigger>
        <TabsTrigger value="items">
          <CircleHelp className="size-3" />
          题目与选项
        </TabsTrigger>
        <TabsTrigger value="revision">
          <FileDiff className="size-3" />
          修订对比
        </TabsTrigger>
      </TabsList>

      <TabsContent value="story" className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="success">最终版 {run.story.version}</Badge>
          <Badge variant="outline">
            大纲 {run.story.outline_version}
          </Badge>
          <span className="text-[10px] text-muted">
            {run.story.segments.length} 个事件锚点
          </span>
        </div>
        <h3 className="font-serif text-base font-semibold text-ink">
          {run.story.title}
        </h3>
        <div className="space-y-2.5">
          {run.story.segments.map((segment, index) => {
            const event = eventOrder.get(segment.event_id);
            return (
              <div
                key={segment.event_id}
                className="rounded border border-line bg-panel px-3 py-2.5"
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted">
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-accent-soft font-mono text-[9px] text-accent-ink">
                    {index + 1}
                  </span>
                  <Mono>{segment.event_id}</Mono>
                  {event ? <span>{event.description}</span> : null}
                </div>
                <p className="text-[12px] leading-6 text-ink-soft">
                  {segment.text}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] leading-4 text-muted">
          {run.run.is_synthetic
            ? "当前内容尚未完成评分。"
            : `按 ${run.story.segments.length} 个大纲事件锚定；历史差异见“修订对比”。`}
        </p>
      </TabsContent>

      <TabsContent value="items" className="space-y-3">
        {run.items.map((item) => {
          const event = eventOrder.get(item.event_id);
          return (
            <article
              key={item.item_id}
              className="rounded border border-line bg-panel"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Mono className="text-accent">{item.item_id}</Mono>
                  <Badge
                    variant={
                      item.version === run.story.version ? "success" : "outline"
                    }
                  >
                    {item.version === run.story.version
                      ? "最终版"
                      : item.version}
                  </Badge>
                  <span className="text-[10px] text-muted">
                    锚定 {item.event_id}
                    {event ? ` · ${event.description.slice(0, 14)}…` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {REVIEW_SLOTS.map((slot) => {
                    const marker = item.review_markers.find(
                      (entry) => entry.reviewer_slot === slot
                    );
                    return (
                      <Badge
                        key={slot}
                        variant={
                          marker?.status === "completed"
                            ? "success"
                            : "muted"
                        }
                        title={REVIEW_SLOT_LABELS[slot]}
                      >
                        {slot.replace("review_", "").toUpperCase()} ·{" "}
                        {marker?.status === "completed" ? "已评" : "未评估"}
                      </Badge>
                    );
                  })}
                </div>
              </header>
              <div className="space-y-2 px-3 py-2.5">
                <p className="text-[12px] font-medium leading-6 text-ink">
                  {item.stem}
                </p>
                <ul className="space-y-1">
                  {item.options.map((option) => (
                    <li
                      key={option.option_id}
                      className="flex items-start gap-2 rounded border border-line/70 bg-panel-muted/40 px-2 py-1.5"
                    >
                      <span className="mt-0.5 inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-panel font-mono text-[10px] text-ink-soft">
                        {option.option_id}
                      </span>
                      <span className="min-w-0 flex-1 text-[11.5px] leading-5 text-ink-soft">
                        {option.text}
                      </span>
                      <Badge variant="muted" title="选项分值">
                        {option.candidate_level === null
                          ? "—"
                          : `${option.candidate_level} 分`}
                      </Badge>
                      {option.reverse ? (
                        <Badge variant="warning">反向</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-2 text-[10px] text-muted">
                  <span>
                    分值顺序：
                    <Mono className="ml-1 text-ink-soft">
                      {item.candidate_scoring_key ?? "—"}
                    </Mono>
                  </span>

                </div>
              </div>
            </article>
          );
        })}
      </TabsContent>

      <TabsContent value="revision" className="space-y-4">
        {revisions.length === 0 ? (
          <p className="text-xs text-muted">当前任务尚无修订记录。</p>
        ) : (
          revisions.map((revision) => (
            <RevisionDiff key={revision.revision_id} revision={revision} />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
