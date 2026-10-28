"use client";
import * as React from "react";
import { columns, mappedRows, parseCsv } from "@/lib/studio/import";
import {
  validateRows,
  versionDiff,
  type ItemSet,
  type SourceRecord,
} from "@/lib/studio/model";
import type { StudioAction } from "@/lib/studio/service";
type Props = {
  existing?: ItemSet;
  onSave: (a: StudioAction) => Promise<unknown>;
  onClose: () => void;
};
const labels: Record<string, string> = {
  source_item_id: "稳定来源 ID",
  source_text: "条目文本",
  domain: "目标维度",
  facet: "子维度 / facet",
  construct_definition: "构念定义",
  reverse_flag: "是否反向",
  notes: "备注",
};
export function ImportEditor({ existing, onSave, onClose }: Props) {
  const last = existing?.versions.at(-1);
  const initial = last
    ? [
        columns,
        ...last.rows.map((r) => [
          r.sourceId,
          r.text,
          r.domain,
          r.facet,
          r.definition,
          r.reverseFlag === null ? "" : String(r.reverseFlag),
          r.notes,
        ]),
      ]
    : [];
  const [grid, setGrid] = React.useState<string[][]>(initial);
  const [mapping, setMapping] = React.useState<Record<string, number>>(
    Object.fromEntries(columns.map((c, i) => [c, i])),
  );
  const [name, setName] = React.useState(existing?.name ?? "");
  const [reason, setReason] = React.useState("");
  const [facets, setFacets] = React.useState(
    last?.rows.some((r) => r.facet) ?? false,
  );
  const [error, setError] = React.useState("");
  const [pasted, setPasted] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  let rows: SourceRecord[] = [];
  let parseError = "";
  try {
    rows = mappedRows(grid, mapping);
  } catch (e) {
    parseError = String(e instanceof Error ? e.message : e);
  }
  const issues = validateRows(rows, facets);
  const diff = versionDiff(last?.rows ?? [], rows);
  const setFileGrid = (value: string[][]) => {
    setGrid(value);
    setMapping(
      Object.fromEntries(
        columns.map((c) => [
          c,
          value[0]?.findIndex((h) => h.trim() === c) ?? -1,
        ]),
      ),
    );
  };
  async function upload(file: File) {
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/studio/import", {
        method: "POST",
        body: form,
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      setFileGrid(v.grid);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave({
        action: "saveSet",
        id: existing?.id,
        baseVersion: last?.id,
        name,
        reason,
        usesFacets: facets,
        rows,
      });
      onClose();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="v3-editor">
      <div className="v3-section-title">
        <h2>
          {existing ? "基于 V" + last?.number + " 保存新版本" : "导入条目集"}
        </h2>
        <button onClick={onClose} className="v3-secondary">
          关闭
        </button>
      </div>
      <p className="v3-muted">
        先映射列并核对，再保存独立版本。来源 ID
        不使用文件行号自动生成；新构念或新行为含义请分配新 ID。
      </p>
      <div className="v3-form-grid">
        <label>
          条目集名称
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          版本说明 / 替换理由
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="修改措辞、增加条目或替换关系"
          />
        </label>
      </div>
      <label className="v3-check">
        <input
          type="checkbox"
          checked={facets}
          onChange={(e) => setFacets(e.target.checked)}
        />
        本条目集使用子维度层级
      </label>
      <div className="v3-upload">
        <input
          type="file"
          aria-label="上传条目文件"
          accept=".csv,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <a href="/source-items-template.csv" download>
          下载 CSV 模板
        </a>
        <span>支持 CSV / XLSX，首行表头，最多 2000 条。</span>
      </div>
      <details>
        <summary>粘贴 CSV 或直接编辑当前版本</summary>
        <textarea
          aria-label="CSV 条目内容"
          rows={7}
          value={
            pasted ||
            grid
              .map((r) =>
                r.map((c) => '"' + c.replaceAll('"', '""') + '"').join(","),
              )
              .join("\n")
          }
          onChange={(e) => setPasted(e.target.value)}
        />
        <button
          type="button"
          className="v3-secondary"
          onClick={() => {
            try {
              setFileGrid(parseCsv(pasted));
              setError("");
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          读取粘贴内容
        </button>
      </details>
      <ErrorBox message={error || parseError} />
      {grid.length > 0 && (
        <>
          <h3>列映射</h3>
          <div className="v3-mapping">
            {columns.map((c) => (
              <label key={c}>
                {labels[c]}
                <select
                  value={mapping[c] ?? -1}
                  onChange={(e) =>
                    setMapping({ ...mapping, [c]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>不映射</option>
                  {grid[0].map((h, i) => (
                    <option key={i} value={i}>
                      {h || `第${i + 1}列`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="v3-diff-summary">
            新增 {diff.added.length} · 修改 {diff.changed.length} · 移除{" "}
            {diff.removed.length} · 共 {rows.length} 条
          </div>
          <details open={issues.some((x) => x.severity === "error")}>
            <summary>导入核对 · {issues.length} 项提示</summary>
            {issues.map((p, i) => (
              <p
                key={i}
                className={p.severity === "error" ? "v3-danger" : "v3-muted"}
              >
                第 {p.row} 行 · {labels[p.field] ?? p.field}：{p.message}
              </p>
            ))}
            {!issues.length && <p>必要字段和稳定 ID 检查通过。</p>}
          </details>
          <div className="v3-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>文件行</th>
                  <th>来源 ID</th>
                  <th>条目文本</th>
                  <th>维度</th>
                  <th>子维度</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i}>
                    <td>{i + 2}</td>
                    <td>{r.sourceId}</td>
                    <td>{r.text}</td>
                    <td>{r.domain}</td>
                    <td>{r.facet || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>查看版本差异</summary>
            {diff.added.map((r) => (
              <p key={r.sourceId}>
                新增：{r.sourceId} · {r.text}
              </p>
            ))}
            {diff.changed.map((r) => (
              <p key={r.sourceId}>
                修改：{r.sourceId} ·{" "}
                {last?.rows.find((x) => x.sourceId === r.sourceId)?.text} →{" "}
                {r.text}
              </p>
            ))}
            {diff.removed.map((r) => (
              <p key={r.sourceId}>
                移除：{r.sourceId} · {r.text}
              </p>
            ))}
          </details>
        </>
      )}
      <button
        className="v3-primary"
        disabled={
          busy ||
          !name.trim() ||
          !reason.trim() ||
          !!parseError ||
          issues.some((x) => x.severity === "error")
        }
        onClick={() => void save()}
      >
        保存{existing ? "新版本" : "条目集"}
      </button>
      <p className="v3-muted">
        同 ID 修改措辞表示你确认仍属同一来源含义；不同构念／行为的新题须新
        ID。家族关系不会自动继承或推断。
      </p>
    </div>
  );
}
function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="v3-error">
      {message}
    </div>
  ) : null;
}
