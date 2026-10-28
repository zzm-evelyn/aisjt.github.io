"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  History,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ReplayControls } from "@/components/layout/replay-controls";
import { isBundledRunId } from "@/lib/demo/load";
import { safeParseDemoRun } from "@/lib/schemas/run";
import {
  buildExportDocument,
  downloadJson,
  exportFilename,
  readJsonFile,
} from "@/lib/storage/exchange";
import { useRunsStore } from "@/lib/store/runs-store";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import type { ToastState } from "@/components/ui/toast";

export function WorkspaceToolbar({
  onNotify,
}: {
  onNotify: (toast: Exclude<ToastState, null>) => void;
}) {
  const router = useRouter();
  const baseRun = useWorkspaceStore((state) => state.baseRun);
  const overlay = useWorkspaceStore((state) => state.overlay);
  const mode = useWorkspaceStore((state) => state.mode);
  const loadRun = useWorkspaceStore((state) => state.loadRun);
  const addImportedRun = useRunsStore((state) => state.addImportedRun);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importIssues, setImportIssues] = React.useState<string[] | null>(
    null
  );

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const data = await readJsonFile(file);
      const result = safeParseDemoRun(data);
      if (!result.ok) {
        setImportIssues(result.issues);
        return;
      }
      if (isBundledRunId(result.run.run.run_id)) {
        setImportIssues([
          "run.run_id 与内置运行冲突。请修改 JSON 中的 run_id 后再导入。",
        ]);
        return;
      }
      addImportedRun(result.run);
      loadRun(result.run);
      onNotify({
        kind: "success",
        title: "已导入并载入运行",
        detail: result.run.run.label,
      });
      router.replace(
        `/workspace?run=${encodeURIComponent(result.run.run.run_id)}`
      );
    } catch (error) {
      setImportIssues([
        `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  };

  const handleExport = () => {
    if (!baseRun) return;
    downloadJson(
      buildExportDocument(baseRun, overlay),
      exportFilename(baseRun)
    );
    onNotify({
      kind: "success",
      title: "已导出运行快照",
      detail: "包含任务内容、评分记录与版本信息。",
    });
  };

  return (
    <>
      {mode === "demo" ? <ReplayControls /> : null}
      <details className="toolbar-more"><summary>更多操作</summary><div className="toolbar-more-panel">
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="border-white/20 bg-white/5 text-[#e8e2d5] hover:bg-white/12"
      >
        <Upload />
        导入
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={!baseRun || mode !== "demo"}
        className="border-white/20 bg-white/5 text-[#e8e2d5] hover:bg-white/12"
      >
        <Download />
        导出
      </Button>
      <Link
        href="/runs"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-white/20 bg-white/5 px-2.5 text-xs text-[#e8e2d5] transition-colors hover:bg-white/12"
      >
        <History className="size-3.5" />
        历史
      </Link>

      </div></details>
      <Modal
        open={Boolean(importIssues)}
        onOpenChange={(open) => {
          if (!open) setImportIssues(null);
        }}
        title="无法导入该 JSON"
        description="导入文件必须符合 sjt-run/1 数据契约。以下校验未通过："
        footer={
          <Button variant="outline" onClick={() => setImportIssues(null)}>
            关闭
          </Button>
        }
      >
        <ul className="space-y-1.5">
          {importIssues?.map((issue, index) => (
            <li
              key={`${issue}-${index}`}
              className="rounded border border-danger/20 bg-danger-soft px-2.5 py-2 font-mono text-[11px] leading-5 text-danger"
            >
              {issue}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
