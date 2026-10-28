"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Check,
  GripVertical,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/form";
import { Mono } from "@/components/ui/misc";
import { formatTimestamp } from "@/lib/format";
import { gateStatus } from "@/lib/replay/engine";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import type { DemoRunFile, OutlineEvent } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

function SortableEventRow({
  event,
  index,
  originalOrder,
}: {
  event: OutlineEvent;
  index: number;
  originalOrder: number | null;
}) {
  const updateOutlineDescription = useWorkspaceStore(
    (state) => state.updateOutlineDescription
  );
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(event.description);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.event_id });

  const moved = originalOrder !== null && originalOrder !== index + 1;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded border border-line bg-panel px-2.5 py-2",
        isDragging && "z-10 border-accent shadow-lg"
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted hover:bg-panel-muted hover:text-ink active:cursor-grabbing"
          aria-label={`拖动事件 ${index + 1} 调整顺序`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] text-accent-ink">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-1.5">
              <Textarea
                value={draft}
                onChange={(changed) => setDraft(changed.target.value)}
                rows={2}
                aria-label={`事件 ${index + 1} 描述`}
              />
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  <X /> 取消
                </Button>
                <Button
                  size="sm"
                  disabled={!draft.trim()}
                  onClick={() => {
                    updateOutlineDescription(event.event_id, draft);
                    setEditing(false);
                  }}
                >
                  <Check /> 保存
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11.5px] leading-5 text-ink-soft">
                {event.description}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`编辑事件 ${index + 1}`}
                onClick={() => {
                  setDraft(event.description);
                  setEditing(true);
                }}
              >
                <Pencil />
              </Button>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            <Mono>{event.event_id}</Mono>
            <span>来源：{event.source_item_ids.join("、")}</span>
            <span>题目：{event.item_ids.join("、")}</span>
            {moved ? (
              <Badge variant="gold">原始顺序 #{originalOrder}</Badge>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function OutlineEditor({ run }: { run: DemoRunFile }) {
  const cursor = useWorkspaceStore((state) => state.cursor);
  const overlay = useWorkspaceStore((state) => state.overlay);
  const reorderOutline = useWorkspaceStore((state) => state.reorderOutline);
  const confirmOutline = useWorkspaceStore((state) => state.confirmOutline);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const draft = overlay?.outlineDraft ?? run.outline.events;
  const originalOrders = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const event of run.outline.events) {
      map.set(event.event_id, event.order);
    }
    return map;
  }, [run.outline.events]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const gate = gateStatus(run, cursor, overlay);
  const stale = overlay?.stale ?? false;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderOutline(String(active.id), String(over.id));
  };

  return (
    <div className="space-y-3">
      <Alert variant="neutral">
        <AlertTitle>大纲是人工检查点</AlertTitle>
        <AlertDescription>
          可拖动排序或编辑事件描述。拖动句柄支持鼠标与键盘（聚焦后按空格拾起，方向键移动，空格放下）。
        </AlertDescription>
      </Alert>

      {stale ? (
        <Alert variant="warning">
          <AlertTitle className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            已偏离原始大纲
          </AlertTitle>
          <AlertDescription>
            本地修改不会写回原始记录。继续任务可以查看下游结果，但它们基于旧大纲，已标记为过期。
          </AlertDescription>
        </Alert>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={draft.map((event) => event.event_id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="space-y-1.5">
            {draft.map((event, index) => (
              <SortableEventRow
                key={event.event_id}
                event={event}
                index={index}
                originalOrder={originalOrders.get(event.event_id) ?? null}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="rounded border border-line bg-panel-muted px-2.5 py-2 text-[11px] leading-5 text-ink-soft">
        <p>
          <span className="text-muted">原始确认：</span>
          {run.outline.confirmed_by ?? "—"} ·{" "}
          {formatTimestamp(run.outline.confirmed_at)} ·{" "}
          <Mono>{run.outline.confirmed_version ?? "未确认"}</Mono>
        </p>
        <p className="mt-1">
          <span className="text-muted">本地确认：</span>
          {overlay?.outlineConfirmed ? (
            <span className="text-emerald-700">已确认（本会话）</span>
          ) : gate === "waiting" ? (
            <span className="text-amber-700">等待确认</span>
          ) : (
            <span>任务到达检查点后可确认</span>
          )}
        </p>
      </div>

      <Button
        className="w-full"
        disabled={gate !== "waiting" || overlay?.outlineConfirmed}
        onClick={() => setConfirmOpen(true)}
      >
        <ShieldCheck />
        {gate === "waiting"
          ? "确认大纲并允许继续任务"
          : gate === "confirmed"
            ? "已确认（本会话）"
            : "任务尚未到达人工检查点"}
      </Button>
      <p className="text-[10px] leading-4 text-muted">
        确认仅影响当前任务，不改写原始任务或历史事件。
      </p>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认当前大纲？"
        description={
          stale
            ? "当前大纲与原始版本不同。确认后可以继续任务，但下游结果仍会标记为“基于旧大纲”。"
            : "确认后任务将继续；该操作写入本地操作记录。"
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                confirmOutline();
                setConfirmOpen(false);
              }}
            >
              确认大纲
            </Button>
          </>
        }
      >
        <ol className="space-y-1 text-[11px] leading-5 text-ink-soft">
          {draft.map((event, index) => (
            <li key={event.event_id}>
              <span className="mr-1 font-mono text-accent">{index + 1}.</span>
              {event.description}
            </li>
          ))}
        </ol>
      </Modal>
    </div>
  );
}

export function OutlineRecord({ run }: { run: DemoRunFile }) {
  return (
    <ol className="space-y-1.5">
      {[...run.outline.events]
        .sort((a, b) => a.order - b.order)
        .map((event) => (
          <li
            key={event.event_id}
            className="rounded border border-line bg-panel px-2.5 py-2"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-panel-muted font-mono text-[10px] text-muted">
                {event.order}
              </span>
              <p className="text-[11.5px] leading-5 text-ink-soft">
                {event.description}
              </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 pl-7 text-[10px] text-muted">
              <Mono>{event.event_id}</Mono>
              <span>→ {event.item_ids.join("、")}</span>
            </div>
          </li>
        ))}
    </ol>
  );
}
