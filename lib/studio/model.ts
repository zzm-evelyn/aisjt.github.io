import type { DemoRunFile } from "@/lib/types/domain";

export type SourceRecord = {
  sourceId: string;
  revision: number;
  text: string;
  domain: string;
  facet: string;
  definition: string;
  reverseFlag: boolean | null;
  familyId: string;
  familyConfirmed: boolean;
  notes: string;
};
export type ItemSetVersion = {
  id: string;
  number: number;
  createdAt: string;
  reason: string;
  rows: SourceRecord[];
};
export type ItemSet = {
  id: string;
  name: string;
  archived: boolean;
  versions: ItemSetVersion[];
};
export type Unit = {
  domain: string;
  facet: string;
  definition: string;
  target: number;
};
export type BlueprintVersion = {
  id: string;
  number: number;
  createdAt: string;
  units: Unit[];
  instruction: string;
  levels: string;
  usesFacets: boolean;
};
export type Blueprint = {
  id: string;
  name: string;
  versions: BlueprintVersion[];
};
export type InputSnapshot = {
  contextSnapshot?: import("@/lib/assessment/model").ContextSnapshot;
  itemSetId: string;
  itemSetName: string;
  itemSetVersion: string;
  itemSetVersionNumber?: number;
  blueprintId: string;
  blueprintName: string;
  blueprintVersion: string;
  blueprintVersionNumber?: number;
  rows: SourceRecord[];
  units: Unit[];
  instruction: string;
  levels: string;
  usesFacets: boolean;
  frozenAt: string;
  config: {
    preset: string;
    connected: false;
    budget: number | null;
    maxRevisions: number;
  };
};
export type Task = {
  id: string;
  name: string;
  context: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  status: "draft" | "materials" | "needs_review" | "published";
  origin: string;
  input: InputSnapshot;
  run: DemoRunFile | null;
  staleIds: string[];
  outlineConfirmed: boolean;
  history: {
    at: string;
    reason: string;
    run: DemoRunFile | null;
    staleIds: string[];
  }[];
};
export type Publication = {
  id: string;
  taskId: string;
  createdAt: string;
  fingerprint: string;
  task: Task;
};
export type StudioState = {
  seedFormat?: number;
  revision: number;
  itemSets: ItemSet[];
  blueprints: Blueprint[];
  tasks: Task[];
  publications: Publication[];
};
export type Problem = {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
};
export const unitKey = (domain: string, facet: string) =>
  JSON.stringify([domain.trim(), facet.trim()]);

export function validateRows(
  rows: SourceRecord[],
  usesFacets: boolean,
): Problem[] {
  const problems: Problem[] = [];
  const ids = new Set<string>();
  const texts = new Set<string>();
  if (!rows.length)
    problems.push({
      row: 0,
      field: "rows",
      message: "条目集不能为空",
      severity: "error",
    });
  rows.forEach((r, i) => {
    for (const [field, value] of [
      ["sourceId", r.sourceId],
      ["text", r.text],
      ["domain", r.domain],
      ["definition", r.definition],
      ...(usesFacets ? [["facet", r.facet]] : []),
    ]) {
      if (!value.trim())
        problems.push({
          row: i + 2,
          field,
          message: "必填内容为空",
          severity: "error",
        });
    }
    if (ids.has(r.sourceId))
      problems.push({
        row: i + 2,
        field: "sourceId",
        message: "来源 ID 重复，不能覆盖",
        severity: "error",
      });
    if (texts.has(r.text.trim()))
      problems.push({
        row: i + 2,
        field: "text",
        message: "条目文本重复，请核对",
        severity: "warning",
      });
    ids.add(r.sourceId);
    texts.add(r.text.trim());
  });
  return problems;
}

export function validateBlueprint(
  bp: Pick<BlueprintVersion, "units" | "instruction" | "levels" | "usesFacets">,
): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  if (!bp.units.length) errors.push("请至少配置一个测量单元");
  if (!bp.instruction.trim()) errors.push("请填写作答说明");
  if (!bp.levels.trim()) errors.push("请填写四选项的候选行为等级说明");
  bp.units.forEach((u, i) => {
    if (
      !u.domain.trim() ||
      !u.definition.trim() ||
      (bp.usesFacets && !u.facet.trim())
    )
      errors.push(`第 ${i + 1} 个单元缺少构念或定义`);
    if (!Number.isInteger(u.target) || u.target < 1 || u.target > 1000)
      errors.push(`第 ${i + 1} 个单元的目标题量必须是 1–1000 的整数`);
    const key = unitKey(u.domain, bp.usesFacets ? u.facet : "");
    if (keys.has(key)) errors.push(`第 ${i + 1} 个单元重复`);
    keys.add(key);
  });
  return errors;
}

export function coverage(
  rows: SourceRecord[],
  bp: Pick<BlueprintVersion, "units" | "usesFacets">,
) {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const k = unitKey(r.domain, bp.usesFacets ? r.facet : "");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const problems: string[] = [];
  const allowed = new Set(
    bp.units.map((u) => unitKey(u.domain, bp.usesFacets ? u.facet : "")),
  );
  for (const u of bp.units) {
    const n = counts.get(unitKey(u.domain, bp.usesFacets ? u.facet : "")) ?? 0;
    if (n !== u.target)
      problems.push(
        `${u.domain}${u.facet ? " / " + u.facet : ""}：需要 ${u.target} 条，已选 ${n} 条`,
      );
  }
  rows.forEach((r) => {
    if (!allowed.has(unitKey(r.domain, bp.usesFacets ? r.facet : "")))
      problems.push(`来源 ${r.sourceId} 未映射到蓝图单元`);
  });
  return problems;
}

export function versionDiff(before: SourceRecord[], after: SourceRecord[]) {
  const old = new Map(before.map((r) => [r.sourceId, r]));
  const next = new Map(after.map((r) => [r.sourceId, r]));
  return {
    added: after.filter((r) => !old.has(r.sourceId)),
    removed: before.filter((r) => !next.has(r.sourceId)),
    changed: after.filter((r) => {
      const p = old.get(r.sourceId);
      return (
        p &&
        ["text", "domain", "facet", "definition", "notes", "reverseFlag"].some(
          (k) => p[k as keyof SourceRecord] !== r[k as keyof SourceRecord],
        )
      );
    }),
  };
}

/** Only editable content is included; recorded evaluations and source records are never rewritten. */
export function contentFingerprint(run: DemoRunFile | null): string {
  return JSON.stringify(
    run
      ? {
          story: run.story,
          items: run.items.map((i) => ({
            id: i.item_id,
            stem: i.stem,
            options: i.options,
          })),
          outline: run.outline,
        }
      : null,
  );
}
