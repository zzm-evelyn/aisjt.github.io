"use client";

import { ChevronDown, ChevronUp, ListTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";
import { orderedEvents } from "@/lib/replay/engine";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import { STAGE_SHORT_LABELS } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

export function Timeline() {
  const baseRun = useWorkspaceStore((state) => state.baseRun);
  const cursor = useWorkspaceStore((state) => state.cursor);
  const overlay = useWorkspaceStore((state) => state.overlay);
  const timelineOpen = useWorkspaceStore((state) => state.timelineOpen);
  const toggleTimeline = useWorkspaceStore((state) => state.toggleTimeline);

  if (!baseRun) return null;

  const events = orderedEvents(baseRun).filter(
    (event) => event.seq <= cursor
  );
  const operations = overlay?.operations ?? [];

  return (
    <section
      className="border-t border-line bg-panel"
      aria-label="运行时间线"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <button
          type="button"
          onClick={toggleTimeline}
          aria-expanded={timelineOpen}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
        >
          <ListTree className="size-3.5 text-accent" />
          时间线
          <Badge variant="muted">{events.length} 条任务事件</Badge>
          {operations.length > 0 ? (
            <Badge variant="gold">{operations.length} 条本地操作</Badge>
          ) : null}
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTimeline}
            aria-label={timelineOpen ? "收起时间线" : "展开时间线"}
          >
            {timelineOpen ? <ChevronDown /> : <ChevronUp />}
          </Button>
        </div>
      </div>

      {timelineOpen ? (
        <div className="thin-scrollbar max-h-52 overflow-y-auto border-t border-line/70">
          {events.length === 0 && operations.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted">
              暂无事件。启动任务后查看执行记录。
            </p>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-panel-muted text-left text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-14 px-3 py-1.5 font-medium">seq</th>
                  <th className="w-36 px-3 py-1.5 font-medium">时间（UTC）</th>
                  <th className="w-24 px-3 py-1.5 font-medium">阶段</th>
                  <th className="w-24 px-3 py-1.5 font-medium">状态</th>
                  <th className="px-3 py-1.5 font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {events.map((event) => (
                  <tr key={event.event_id} className="align-top">
                    <td className="px-3 py-1.5 font-mono text-muted">
                      {event.seq}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-ink-soft">
                      {formatTimestamp(event.at)}
                    </td>
                    <td className="px-3 py-1.5 text-ink-soft">
                      {STAGE_SHORT_LABELS[event.stage_id]}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                          event.type === "human_gate"
                            ? "border-amber-300/60 bg-amber-50 text-amber-700"
                            : "border-line bg-panel-muted text-ink-soft"
                        )}
                      >
                        {event.type === "human_gate"
                          ? "人工检查点"
                          : event.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 leading-5 text-ink-soft">
                      {event.message}
                    </td>
                  </tr>
                ))}
                {operations.map((operation) => (
                  <tr
                    key={operation.local_id}
                    className="align-top bg-amber-50/50"
                  >
                    <td className="px-3 py-1.5 font-mono text-amber-700">
                      local
                    </td>
                    <td className="px-3 py-1.5 font-mono text-ink-soft">
                      {formatTimestamp(operation.at)}
                    </td>
                    <td className="px-3 py-1.5 text-ink-soft">
                      {STAGE_SHORT_LABELS[operation.stage_id]}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge variant="gold">本地操作</Badge>
                    </td>
                    <td className="px-3 py-1.5 leading-5 text-ink-soft">
                      {operation.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </section>
  );
}
