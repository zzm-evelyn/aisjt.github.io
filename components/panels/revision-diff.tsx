"use client";

import * as React from "react";
import { diffWords } from "diff";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { RevisionRecord } from "@/lib/types/domain";

export function RevisionDiff({ revision }: { revision: RevisionRecord }) {
  const chunks = React.useMemo(
    () => diffWords(revision.before_text, revision.after_text),
    [revision.before_text, revision.after_text]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="info">
          {revision.from_version} → {revision.to_version}
        </Badge>
        <Badge variant="outline">{revision.revision_id}</Badge>
        {revision.demonstration_only ? (
          <Badge variant="gold">样例修订</Badge>
        ) : null}
        <span className="text-[10px] text-muted">
          变更条目：{revision.changed_item_ids.join("、")}
        </span>
      </div>

      <p className="rounded border border-line bg-panel-muted px-2.5 py-2 text-[11px] leading-5 text-ink-soft">
        <span className="font-medium text-ink">修订理由：</span>
        {revision.reason}
      </p>

      {revision.demonstration_only ? (
        <Alert variant="warning">
          <AlertTitle>该修订未关联评分记录</AlertTitle>
          <AlertDescription>
            该修订仅用于展示前后版本对比界面。示例数据不含真实模型审查意见。
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded border border-line bg-panel p-3 text-[12px] leading-6 text-ink-soft">
        {chunks.map((chunk, index) => {
          if (chunk.added) {
            return (
              <ins
                key={index}
                className="diff-added rounded-sm px-0.5 no-underline"
              >
                {chunk.value}
              </ins>
            );
          }
          if (chunk.removed) {
            return (
              <del key={index} className="diff-removed rounded-sm px-0.5">
                {chunk.value}
              </del>
            );
          }
          return <React.Fragment key={index}>{chunk.value}</React.Fragment>;
        })}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
          新增
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm bg-rose-100 ring-1 ring-rose-300" />
          删除
        </span>
      </div>
    </div>
  );
}
