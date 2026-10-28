import { safeParseDemoRun } from "@/lib/schemas/run";
import type { SourceRecord, Unit } from "./model";
import { publicationChecks } from "./checks";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import {
  coverage,
  validateRows,
  validateBlueprint,
  contentFingerprint,
  type StudioState,
  type Task,
} from "./model";
import { recordedMaterial } from "./seed";
import { platformRun } from "@/lib/platform/policy";

import { selectionSchema } from "@/lib/assessment/model";
const text = z.string().trim().max(100000);
const required = text.min(1);
const row = z.object({
  sourceId: required.max(200),
  revision: z.number().int().min(1),
  text: required,
  domain: required,
  facet: text,
  definition: required,
  reverseFlag: z.boolean().nullable(),
  familyId: text,
  familyConfirmed: z.boolean(),
  notes: text,
});
const unit = z.object({
  domain: required,
  facet: text,
  definition: required,
  target: z.number().int().min(1).max(1000),
});
export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("saveSet"),
    id: text.optional(),
    name: required.max(200),
    baseVersion: text.optional(),
    reason: required,
    usesFacets: z.boolean(),
    rows: z.array(row).min(1).max(2000),
  }),
  z.object({
    action: z.literal("archiveSet"),
    id: required,
    archived: z.boolean(),
  }),
  z.object({
    action: z.literal("saveBlueprint"),
    id: text.optional(),
    baseVersion: text.optional(),
    name: required.max(200),
    units: z.array(unit).min(1).max(1000),
    usesFacets: z.boolean(),
    instruction: required,
    levels: required,
  }),
  z.object({
    action: z.literal("createTask"),
    contextSelection: selectionSchema.optional(),
    name: required.max(200),
    context: required.max(100),
    setId: required,
    setVersion: required,
    blueprintId: required,
    blueprintVersion: required,
    budget: z.number().positive().nullable(),
    maxRevisions: z.number().int().min(0).max(10),
    sourceIds: z.array(required).min(1),
  }),
  z.object({ action: z.literal("openCase") }),
  z.object({ action: z.literal("importCase"), payload: z.unknown() }),
  z.object({ action: z.literal("cloneTask"), id: required }),
  z.object({
    action: z.literal("editTask"),
    id: required,
    revision: z.number().int(),
    patch: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("name"), name: required.max(200) }),
      z.object({
        kind: z.literal("item"),
        itemId: required,
        stem: required,
        options: z.array(required).length(4),
      }),
      z.object({ kind: z.literal("story"), eventId: required, text: required }),
      z.object({
        kind: z.literal("outline"),
        eventId: required,
        description: required,
        direction: z.enum(["up", "down", "stay"]),
      }),
      z.object({ kind: z.literal("restore"), index: z.number().int().min(0) }),
    ]),
  }),
  z.object({
    action: z.literal("publish"),
    id: required,
    revision: z.number().int(),
  }),
  z.object({ action: z.literal("start"), id: required }),
]);
export type StudioAction = z.infer<typeof actionSchema>;
export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function fail(message: string, status = 400): never {
  throw new StudioError(message, status);
}
function getTask(s: StudioState, id: string) {
  return s.tasks.find((x) => x.id === id) ?? fail("任务不存在", 404);
}
function checkRevision(task: Task, revision: number) {
  if (task.revision !== revision)
    fail(
      "任务已在其他窗口更新。请重新加载后核对，未保存内容仍保留在本地。",
      409,
    );
}

/** All modifications are applied to a transaction-local copy by the repository. */
export function applyAction(state: StudioState, a: StudioAction) {
  const now = new Date().toISOString();
  let resultId = "";
  if (a.action === "saveSet") {
    const issues = validateRows(a.rows, a.usesFacets).filter(
      (x) => x.severity === "error",
    );
    if (issues.length)
      fail(
        issues.map((x) => `第${x.row}行 ${x.field}：${x.message}`).join("；"),
      );
    let set = state.itemSets.find((x) => x.id === a.id);
    const prev = set?.versions.at(-1);
    if (a.id && !set) fail("条目集不存在", 404);
    if (prev && a.baseVersion !== prev.id)
      fail("条目集已有新版本，请重新加载并比较", 409);
    const rows = a.rows.map((r) => {
      const old = prev?.rows.find((x) => x.sourceId === r.sourceId);
      if (old && (old.domain !== r.domain || old.facet !== r.facet))
        fail(`${r.sourceId} 的构念归属已改变，请分配新来源 ID 并记录替换关系`);
      return {
        ...r,
        revision: old
          ? old.text === r.text && old.definition === r.definition
            ? old.revision
            : old.revision + 1
          : 1,
        familyConfirmed: old?.text === r.text ? old.familyConfirmed : false,
        familyId: old?.text === r.text ? old.familyId : "",
      };
    });
    if (!set) {
      set = { id: randomUUID(), name: a.name, archived: false, versions: [] };
      state.itemSets.push(set);
    }
    set.name = a.name;
    set.versions.push({
      id: randomUUID(),
      number: set.versions.length + 1,
      createdAt: now,
      reason: a.reason,
      rows,
    });
    resultId = set.id;
  } else if (a.action === "archiveSet") {
    const set =
      state.itemSets.find((x) => x.id === a.id) ?? fail("条目集不存在", 404);
    set.archived = a.archived;
    resultId = set.id;
  } else if (a.action === "saveBlueprint") {
    const issues = validateBlueprint(a);
    if (issues.length) fail(issues.join("；"));
    let bp = state.blueprints.find((x) => x.id === a.id);
    if (a.id && !bp) fail("蓝图不存在", 404);
    if (bp && bp.versions.at(-1)?.id !== a.baseVersion)
      fail("蓝图已有新版本，请重新加载", 409);
    if (!bp) {
      bp = { id: randomUUID(), name: a.name, versions: [] };
      state.blueprints.push(bp);
    }
    bp.name = a.name;
    bp.versions.push({
      id: randomUUID(),
      number: bp.versions.length + 1,
      createdAt: now,
      units: a.units,
      usesFacets: a.usesFacets,
      instruction: a.instruction,
      levels: a.levels,
    });
    resultId = bp.id;
  } else if (a.action === "createTask") {
    const set =
      state.itemSets.find((x) => x.id === a.setId && !x.archived) ??
      fail("条目集不存在或已归档");
    const version =
      set.versions.find((x) => x.id === a.setVersion) ??
      fail("条目集版本不存在");
    const bp =
      state.blueprints.find((x) => x.id === a.blueprintId) ??
      fail("蓝图不存在");
    const bv =
      bp.versions.find((x) => x.id === a.blueprintVersion) ??
      fail("蓝图版本不存在");
    if (new Set(a.sourceIds).size !== a.sourceIds.length)
      fail("所选来源 ID 重复");
    const rows = version.rows.filter((r) => a.sourceIds.includes(r.sourceId));
    if (rows.length !== a.sourceIds.length) fail("所选来源不属于该条目集版本");
    const errors = [
      ...coverage(rows, bv),
      ...validateRows(rows, bv.usesFacets)
        .filter((x) => x.severity === "error")
        .map((x) => `${x.row}行：${x.message}`),
    ];
    if (errors.length) fail(errors.join("；"));
    const id = randomUUID();
    state.tasks.unshift({
      id,
      name: a.name,
      context: a.context,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      status: "draft",
      origin: "研究者创建；未发生在线模型调用",
      run: null,
      staleIds: [],
      outlineConfirmed: false,
      history: [],
      input: structuredClone({
        itemSetId: set.id,
        itemSetName: set.name,
        itemSetVersion: version.id,
        itemSetVersionNumber: version.number,
        blueprintId: bp.id,
        blueprintName: bp.name,
        blueprintVersion: bv.id,
        blueprintVersionNumber: bv.number,
        rows,
        units: bv.units,
        usesFacets: bv.usesFacets,
        instruction: bv.instruction,
        levels: bv.levels,
        frozenAt: now,
        config: {
          preset: "未配置",
          connected: false as const,
          budget: a.budget,
          maxRevisions: a.maxRevisions,
        },
      }),
    });
    resultId = id;
  } else if (a.action === "openCase") {
    const existing = state.tasks.find((x) => x.id === "saved-university-case");
    if (existing) return existing.id;
    const set = state.itemSets[0],
      version = set.versions.at(-1)!,
      bp = state.blueprints[0],
      bv = bp.versions.at(-1)!;
    const run = platformRun(recordedMaterial());
    const id = "saved-university-case";
    state.tasks.unshift({
      id,
      name: run.story.title,
      context: "大学",
      createdAt: now,
      updatedAt: now,
      revision: 1,
      status: "materials",
      origin:
        "导入材料；本任务未发生在线模型调用。维度按来源中明确的复合 facet 标签前缀拆分，原始 JSON 未修改。旧版本全文未完整存档，修改片段见修订记录。来源构念定义与作答说明须在新生成任务前复核。",
      run,
      staleIds: [],
      outlineConfirmed: true,
      history: [],
      input: structuredClone({
        itemSetId: set.id,
        itemSetName: set.name,
        itemSetVersion: version.id,
        itemSetVersionNumber: version.number,
        blueprintId: bp.id,
        blueprintName: bp.name,
        blueprintVersion: bv.id,
        blueprintVersionNumber: bv.number,
        rows: version.rows,
        units: bv.units,
        usesFacets: bv.usesFacets,
        instruction: bv.instruction,
        levels: bv.levels,
        frozenAt: now,
        config: {
          preset: "既有材料配置",
          connected: false as const,
          budget: null,
          maxRevisions: 3,
        },
      }),
    });
    resultId = id;
  } else if (a.action === "importCase") {
    const data = a.payload as { local_overlay?: { stale?: boolean } } | null;
    if (data?.local_overlay?.stale)
      fail(
        "文件包含本地修改草稿，不能当成未修改案例导入。请保留该文件，使用版本化迁移方式处理。",
      );
    const parsed = safeParseDemoRun(a.payload);
    if (!parsed.ok)
      fail(
        "仅支持 sjt-run/1 已保存材料：" + parsed.issues.slice(0, 5).join("；"),
      );
    const run = platformRun(structuredClone(parsed.run));
    const setId = randomUUID(),
      setVersion = randomUUID(),
      bpId = randomUUID(),
      bpVersion = randomUUID();
    const rows: SourceRecord[] = run.source_items.map((i) => ({
      sourceId: i.source_item_id,
      revision: 1,
      text: i.text,
      domain: i.domain,
      facet: i.facet,
      definition:
        run.run.config_snapshot.facet_definition ||
        "原文件未提供单独构念定义，创建新生成任务前请补全",
      reverseFlag: i.reverse_flag,
      familyId:
        run.items.find((x) => x.source_item_id === i.source_item_id)
          ?.item_family_id ?? "",
      familyConfirmed: false,
      notes: i.note,
    }));
    const units: Unit[] = [];
    for (const row of rows) {
      let unit = units.find(
        (u) => u.domain === row.domain && u.facet === row.facet,
      );
      if (!unit) {
        unit = {
          domain: row.domain,
          facet: row.facet,
          definition: row.definition,
          target: 0,
        };
        units.push(unit);
      }
      unit.target++;
    }
    const instruction = "请核对原始材料的作答说明后使用；本导入未补造原说明。",
      levels = "四选项候选行为水平沿用原文件，未作计分校准。";
    state.itemSets.push({
      id: setId,
      name: run.story.title + " · 导入来源",
      archived: false,
      versions: [
        {
          id: setVersion,
          number: 1,
          createdAt: now,
          reason: "由已有材料作为独立副本导入；家族映射待确认",
          rows,
        },
      ],
    });
    state.blueprints.push({
      id: bpId,
      name: run.story.title + " · 导入蓝图",
      versions: [
        {
          id: bpVersion,
          number: 1,
          createdAt: now,
          units,
          usesFacets: rows.some((r) => r.facet),
          instruction,
          levels,
        },
      ],
    });
    const id = randomUUID();
    state.tasks.unshift({
      id,
      name: run.story.title,
      context: run.run.context_id === "university" ? "大学" : "旅行",
      createdAt: now,
      updatedAt: now,
      revision: 1,
      status: "materials",
      origin:
        "从 sjt-run/1 文件导入为新副本；本任务未发生在线调用。原 run_id：" +
        run.run.run_id,
      run,
      staleIds: [],
      outlineConfirmed: true,
      history: [],
      input: structuredClone({
        itemSetId: setId,
        itemSetName: run.story.title + " · 导入来源",
        itemSetVersion: setVersion,
        itemSetVersionNumber: 1,
        blueprintId: bpId,
        blueprintName: run.story.title + " · 导入蓝图",
        blueprintVersion: bpVersion,
        blueprintVersionNumber: 1,
        rows,
        units,
        usesFacets: rows.some((r) => r.facet),
        instruction,
        levels,
        frozenAt: now,
        config: {
          preset: "导入材料配置",
          connected: false as const,
          budget: null,
          maxRevisions: run.run.config_snapshot.max_revisions,
        },
      }),
    });
    resultId = id;
  } else if (a.action === "cloneTask") {
    const original = getTask(state, a.id);
    const copy = structuredClone(original);
    copy.id = randomUUID();
    copy.name += " · 新候选";
    copy.createdAt = copy.updatedAt = now;
    copy.revision = 1;
    copy.status = copy.run ? "needs_review" : "draft";
    copy.origin = `基于任务 ${original.id} 新建；未发生在线调用`;
    copy.history = [];
    copy.staleIds = copy.run?.items.map((i) => i.item_id) ?? [];
    state.tasks.unshift(copy);
    resultId = copy.id;
  } else if (a.action === "start") {
    getTask(state, a.id);
    fail(
      "模型尚未连接，任务输入已保存。请先在项目设置中配置连接；本阶段不执行在线生成。",
      422,
    );
  } else if (a.action === "editTask") {
    const task = getTask(state, a.id);
    checkRevision(task, a.revision);
    if (task.status === "published" && a.patch.kind !== "name")
      fail("已入库版本不可修改，请基于此版创建新候选", 409);
    const p = a.patch;
    const before = structuredClone(task.run);
    const stale = [...task.staleIds];
    if (p.kind === "name") task.name = p.name;
    else if (!task.run) fail("当前任务尚无生成内容");
    else if (p.kind === "item") {
      const item =
        task.run.items.find((i) => i.item_id === p.itemId) ??
        fail("题目不存在", 404);
      const old = JSON.stringify([item.stem, item.options.map((o) => o.text)]);
      if (old === JSON.stringify([p.stem, p.options])) return task.id;
      item.stem = p.stem;
      item.options.forEach((o, i) => (o.text = p.options[i]));
      task.staleIds = [...new Set([...task.staleIds, item.item_id])];
    } else if (p.kind === "story") {
      const segment =
        task.run.story.segments.find((e) => e.event_id === p.eventId) ??
        fail("事件不存在", 404);
      if (segment.text === p.text) return task.id;
      segment.text = p.text;
      task.run.story.text = task.run.story.segments
        .map((x) => x.text)
        .join("\n\n");
      task.staleIds = task.run.items.map((i) => i.item_id);
    } else if (p.kind === "outline") {
      const events = task.run.outline.events.sort((x, y) => x.order - y.order);
      const at = events.findIndex((e) => e.event_id === p.eventId);
      if (at < 0) fail("事件不存在");
      events[at].description = p.description;
      const to =
        p.direction === "up" ? at - 1 : p.direction === "down" ? at + 1 : at;
      if (to >= 0 && to < events.length)
        [events[at], events[to]] = [events[to], events[at]];
      events.forEach((e, i) => (e.order = i + 1));
      task.staleIds = task.run.items.map((i) => i.item_id);
      task.outlineConfirmed = false;
    } else if (p.kind === "restore") {
      const old = task.history[p.index] ?? fail("历史版本不存在");
      task.run = structuredClone(old.run);
      task.staleIds = task.run?.items.map((i) => i.item_id) ?? [];
      task.outlineConfirmed = false;
    }
    if (p.kind !== "name") {
      task.history.push({
        at: now,
        reason: p.kind,
        run: before,
        staleIds: stale,
      });
      task.status = "needs_review";
    }
    task.revision++;
    task.updatedAt = now;
    resultId = task.id;
  } else if (a.action === "publish") {
    const task = getTask(state, a.id);
    const fingerprint = createHash("sha256")
      .update(contentFingerprint(task.run) + JSON.stringify(task.input))
      .digest("hex");
    const existing = state.publications.find(
      (p) => p.taskId === task.id && p.fingerprint === fingerprint,
    );
    if (existing) return existing.id;
    checkRevision(task, a.revision);
    const errors = publicationChecks(task);
    if (errors.length) fail(errors.join("；"));
    task.status = "published";
    task.updatedAt = now;
    task.revision++;
    const id = randomUUID();
    state.publications.unshift({
      id,
      taskId: task.id,
      createdAt: now,
      fingerprint,
      task: structuredClone(task),
    });
    resultId = id;
  }
  state.revision++;
  return resultId;
}
