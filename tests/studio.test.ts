// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, unlinkSync, existsSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { StudioRepository } from "@/lib/studio/repository";
import { actionSchema } from "@/lib/studio/service";
import { loadRecordedRun } from "@/lib/demo/load";
import { publicationChecks } from "@/lib/studio/checks";
import {
  coverage,
  validateRows,
  versionDiff,
  type SourceRecord,
} from "@/lib/studio/model";
import { mappedRows, parseCsv } from "@/lib/studio/import";
import { DraftQueue, type DraftPatch } from "@/lib/studio/save-queue";
import { POST as importFile } from "@/app/api/studio/import/route";

vi.mock("@/lib/auth/session", () => ({ guard: () => null }));

const rows: SourceRecord[] = Array.from({ length: 8 }, (_, i) => ({
  sourceId: `custom-${i + 1}`,
  revision: 1,
  text: `来源文本${i + 1}`,
  domain: i < 4 ? "自定义维度A" : "自定义维度B",
  facet: "",
  definition: i < 4 ? "A 的行为构念定义" : "B 的行为构念定义",
  reverseFlag: null,
  familyId: "",
  familyConfirmed: false,
  notes: "",
}));
const units = [
  {
    domain: "自定义维度A",
    facet: "",
    definition: "A 的行为构念定义",
    target: 4,
  },
  {
    domain: "自定义维度B",
    facet: "",
    definition: "B 的行为构念定义",
    target: 4,
  },
];
function setup(repo: StudioRepository) {
  const setId = repo.execute({
    action: "saveSet",
    name: "自定义八条来源",
    reason: "初始版本",
    usesFacets: false,
    rows,
  }).resultId;
  const blueprintId = repo.execute({
    action: "saveBlueprint",
    name: "2维度8题",
    usesFacets: false,
    units,
    instruction: "选最可能采取的行为",
    levels: "四种候选行为水平，标签不对应分值",
  }).resultId;
  const s = repo.read();
  return {
    setId,
    blueprintId,
    setVersion: s.itemSets.find((x) => x.id === setId)!.versions[0].id,
    blueprintVersion: s.blueprints.find((x) => x.id === blueprintId)!
      .versions[0].id,
  };
}
function create(repo: StudioRepository, input: ReturnType<typeof setup>) {
  return repo.execute({
    action: "createTask",
    name: "新任务",
    context: "大学",
    ...input,
    budget: null,
    maxRevisions: 3,
    sourceIds: rows.map((r) => r.sourceId),
  }).resultId;
}
describe("V3 immutable inputs and persistence", () => {
  it("supports eight sources, two arbitrary dimensions and no facet", () => {
    const repo = new StudioRepository(":memory:");
    try {
      const input = setup(repo);
      const id = create(repo, input);
      const t = repo.read().tasks.find((x) => x.id === id)!;
      expect(t.input.rows).toHaveLength(8);
      expect(t.input.units).toHaveLength(2);
      expect(t.input.usesFacets).toBe(false);
      expect(t.run).toBeNull();
      expect(coverage(t.input.rows, t.input)).toEqual([]);
      expect(() => repo.execute({ action: "start", id })).toThrow(
        "模型尚未连接",
      );
    } finally {
      repo.close();
    }
  });
  it("V2 replacement leaves task A frozen at V1 and task B uses V2", () => {
    const repo = new StudioRepository(":memory:");
    try {
      const input = setup(repo);
      const a = create(repo, input);
      const changed = structuredClone(rows);
      changed[0].text = "修订后的来源措辞";
      repo.execute({
        action: "saveSet",
        id: input.setId,
        baseVersion: input.setVersion,
        name: "自定义八条来源",
        reason: "确认同一来源含义的措辞修订",
        usesFacets: false,
        rows: changed,
      });
      const v2 = repo.read().itemSets.find((x) => x.id === input.setId)!
        .versions[1];
      const b = create(repo, { ...input, setVersion: v2.id });
      const tasks = repo.read().tasks;
      expect(tasks.find((t) => t.id === a)!.input.rows[0].text).toBe(
        rows[0].text,
      );
      expect(tasks.find((t) => t.id === b)!.input.rows[0].text).toBe(
        changed[0].text,
      );
      expect(v2.rows[0].revision).toBe(2);
      expect(v2.rows[0].familyConfirmed).toBe(false);
      expect(versionDiff(rows, v2.rows).changed).toHaveLength(1);
    } finally {
      repo.close();
    }
  });
  it("archive and stale version conflicts never overwrite referenced material", () => {
    const repo = new StudioRepository(":memory:");
    try {
      const input = setup(repo);
      const id = create(repo, input);
      repo.execute({ action: "archiveSet", id: input.setId, archived: true });
      expect(
        repo.read().tasks.find((t) => t.id === id)!.input.rows,
      ).toHaveLength(8);
      expect(() => create(repo, input)).toThrow("归档");
      expect(() =>
        repo.execute({
          action: "saveSet",
          id: input.setId,
          baseVersion: "bad",
          name: "x",
          reason: "x",
          usesFacets: false,
          rows,
        }),
      ).toThrow("新版本");
    } finally {
      repo.close();
    }
  });
  it("blocks duplicate IDs, missing blueprint coverage and changed constructs under old IDs", () => {
    const duplicate = [...rows, { ...rows[0] }];
    expect(
      validateRows(duplicate, false).some((p) => p.severity === "error"),
    ).toBe(true);
    expect(coverage(rows.slice(1), { units, usesFacets: false })).toHaveLength(
      1,
    );
    const repo = new StudioRepository(":memory:");
    try {
      const input = setup(repo);
      const changed = structuredClone(rows);
      changed[0].domain = "完全不同构念";
      expect(() =>
        repo.execute({
          action: "saveSet",
          id: input.setId,
          baseVersion: input.setVersion,
          name: "x",
          reason: "替换",
          usesFacets: false,
          rows: changed,
        }),
      ).toThrow("新来源 ID");
      expect(
        repo.read().itemSets.find((s) => s.id === input.setId)!.versions,
      ).toHaveLength(1);
    } finally {
      repo.close();
    }
  });
  it("survives repository close/reopen and protects optimistic task revisions", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sjt-v3-test-"));
    const filename = path.join(dir, "test.sqlite");
    let repo = new StudioRepository(filename);
    try {
      const input = setup(repo);
      const id = create(repo, input);
      repo.execute({
        action: "editTask",
        id,
        revision: 1,
        patch: { kind: "name", name: "已保存名称" },
      });
      repo.close();
      repo = new StudioRepository(filename);
      expect(repo.read().tasks.find((t) => t.id === id)!.name).toBe(
        "已保存名称",
      );
      expect(() =>
        repo.execute({
          action: "editTask",
          id,
          revision: 1,
          patch: { kind: "name", name: "旧窗口" },
        }),
      ).toThrow("其他窗口");
      expect(repo.read().tasks.find((t) => t.id === id)!.name).toBe(
        "已保存名称",
      );
    } finally {
      repo.close();
      if (!path.resolve(filename).startsWith(path.resolve(dir) + path.sep))
        throw new Error("invalid test path");
      for (const suffix of ["", "-wal", "-shm"]) {
        const file = filename + suffix;
        if (existsSync(file)) unlinkSync(file);
      }
      rmdirSync(dir);
    }
  });
  it("edits one item invalidate that item; story edits conservatively invalidate the batch", () => {
    const repo = new StudioRepository(":memory:");
    try {
      const id = repo.execute({ action: "openCase" }).resultId;
      const task = repo.read().tasks.find((t) => t.id === id)!;
      const item = task.run!.items[0];
      repo.execute({
        action: "editTask",
        id,
        revision: 1,
        patch: {
          kind: "item",
          itemId: item.item_id,
          stem: item.stem + "（修订）",
          options: item.options.map((o) => o.text),
        },
      });
      let changed = repo.read().tasks.find((t) => t.id === id)!;
      expect(changed.staleIds).toEqual([item.item_id]);
      expect(changed.run!.reviews).toEqual(task.run!.reviews);
      expect(publicationChecks(changed).join("")).toContain("等待重新审查");
      const segment = changed.run!.story.segments[0];
      repo.execute({
        action: "editTask",
        id,
        revision: 2,
        patch: {
          kind: "story",
          eventId: segment.event_id,
          text: segment.text + "情景改动。",
        },
      });
      changed = repo.read().tasks.find((t) => t.id === id)!;
      expect(changed.staleIds).toHaveLength(60);
      expect(changed.history).toHaveLength(2);
    } finally {
      repo.close();
    }
  });
  it("publishes an immutable snapshot idempotently and requires a new candidate for edits", () => {
    const repo = new StudioRepository(":memory:");
    try {
      const id = repo.execute({ action: "openCase" }).resultId;
      const task = repo.read().tasks.find((t) => t.id === id)!;
      expect(publicationChecks(task)).toEqual([]);
      const publication = repo.execute({
        action: "publish",
        id,
        revision: 1,
      }).resultId;
      expect(
        repo.execute({ action: "publish", id, revision: 1 }).resultId,
      ).toBe(publication);
      expect(
        repo.execute({ action: "publish", id, revision: 2 }).resultId,
      ).toBe(publication);
      expect(repo.read().publications).toHaveLength(1);
      const item = task.run!.items[0];
      expect(() =>
        repo.execute({
          action: "editTask",
          id,
          revision: 2,
          patch: {
            kind: "item",
            itemId: item.item_id,
            stem: "overwrite",
            options: item.options.map((o) => o.text),
          },
        }),
      ).toThrow("不可修改");
      const copyId = repo.execute({ action: "cloneTask", id }).resultId;
      expect(
        repo.read().tasks.find((t) => t.id === copyId)!.staleIds,
      ).toHaveLength(60);
      expect(repo.read().publications[0].task.run!.items[0].stem).toBe(
        item.stem,
      );
    } finally {
      repo.close();
    }
  });
  it("imports saved cases as separate tasks and rejects edited overlays", () => {
    const repo = new StudioRepository(":memory:");
    try {
      const payload = loadRecordedRun();
      const a = repo.execute({ action: "importCase", payload }).resultId;
      const b = repo.execute({ action: "importCase", payload }).resultId;
      expect(a).not.toBe(b);
      expect(repo.read().tasks).toHaveLength(2);
      expect(() =>
        repo.execute({
          action: "importCase",
          payload: { ...payload, local_overlay: { stale: true } },
        }),
      ).toThrow("本地修改草稿");
    } finally {
      repo.close();
    }
  });
  it("rejects hot replacement of input via the task edit contract", () => {
    expect(
      actionSchema.safeParse({
        action: "editTask",
        id: "x",
        revision: 1,
        patch: { kind: "input", rows },
      }).success,
    ).toBe(false);
  });
});
describe("CSV and XLSX ingestion", () => {
  it("handles BOM, quoted commas, multiline cells and rejects unclosed quotes", () => {
    expect(parseCsv('\uFEFFid,text\r\na,"x,y\nz"')).toEqual([
      ["id", "text"],
      ["a", "x,y\nz"],
    ]);
    expect(() => parseCsv('id,text\na,"bad')).toThrow("未闭合");
  });
  it("maps named columns without inventing facets or family IDs", () => {
    const r = mappedRows(
      [
        ["id", "text", "domain", "definition"],
        ["s1", "t", "D", "定义"],
      ],
      {
        source_item_id: 0,
        source_text: 1,
        domain: 2,
        construct_definition: 3,
        facet: -1,
        reverse_flag: -1,
        notes: -1,
      },
    )[0];
    expect(r.facet).toBe("");
    expect(r.familyConfirmed).toBe(false);
  });
  it("reads a real XLSX workbook through the server import endpoint", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("条目");
    sheet.addRow([
      "source_item_id",
      "source_text",
      "domain",
      "construct_definition",
    ]);
    sheet.addRow(["s1", "中文条目", "维度A", "构念含义"]);
    const bytes = await workbook.xlsx.writeBuffer();
    const form = new FormData();
    form.append("file", new File([new Uint8Array(bytes)], "input.xlsx"));
    const response = await importFile(
      new Request("http://localhost/api/studio/import", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).grid[1]).toEqual([
      "s1",
      "中文条目",
      "维度A",
      "构念含义",
    ]);
  });
});
describe("serial autosave", () => {
  it("keeps distinct item edits and serializes revisions", async () => {
    const sent: DraftPatch[] = [];
    const revisions: number[] = [];
    const q = new DraftQueue(
      1,
      async (rev, p) => {
        sent.push(p);
        revisions.push(rev);
        return rev + 1;
      },
      () => {},
      () => {},
    );
    q.schedule({
      kind: "item",
      itemId: "a",
      stem: "a",
      options: ["a", "b", "c", "d"],
    });
    q.schedule({
      kind: "item",
      itemId: "b",
      stem: "b",
      options: ["a", "b", "c", "d"],
    });
    await q.flush();
    expect(sent).toHaveLength(2);
    expect(revisions).toEqual([1, 2]);
    expect(q.busy).toBe(false);
  });
  it("retains a recovery copy and pending edits on save failure", async () => {
    let saved: unknown = null;
    let status = "";
    let failing = true;
    const q = new DraftQueue(
      1,
      async (rev) => {
        if (failing) throw new Error("disk");
        return rev + 1;
      },
      (v) => (saved = v),
      (s) => (status = s),
    );
    q.schedule({ kind: "name", name: "draft" });
    await q.flush();
    expect(saved).not.toBeNull();
    expect(status).toContain("保存失败");
    expect(q.busy).toBe(true);
    failing = false;
    await q.flush();
    expect(saved).toBeNull();
    expect(status).toBe("已保存");
  });
});
