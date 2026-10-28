import { Radio, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunMode } from "@/lib/types/domain";

export function ModeBadge({ mode }: { mode: RunMode }) {
  const isDemo = mode === "demo";
  const Icon = isDemo ? PlayCircle : Radio;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        isDemo
          ? "border-amber-300/35 bg-amber-300/12 text-amber-100"
          : "border-rose-400/35 bg-rose-400/12 text-rose-100"
      )}
      title={
        isDemo
          ? "演示回放：读取本地录制快照，不调用模型"
          : "实时模式：需要 Flask 后端，V1 尚未连接"
      }
    >
      <Icon className="size-3" />
      {isDemo ? "演示回放" : "实时模式 · 未连接"}
    </span>
  );
}
