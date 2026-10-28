import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seedState } from "./seed";
import { applyAction, StudioError, type StudioAction } from "./service";
import { AssessmentRepository } from "@/lib/assessment/repository";
import type { StudioState } from "./model";

export class StudioRepository {
  private db: DatabaseSync;
  private filename: string;
  constructor(
    filename = process.env.SJT_DATABASE_PATH ??
      path.join(process.cwd(), "data", "studio", "studio.sqlite"),
  ) {
    this.filename = filename;
    if (filename !== ":memory:")
      mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS studio_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS change_log (id INTEGER PRIMARY KEY, at TEXT NOT NULL, action TEXT NOT NULL, result_id TEXT NOT NULL)",
    );
    if (!this.db.prepare("SELECT id FROM studio_state WHERE id=1").get())
      this.db
        .prepare("INSERT OR IGNORE INTO studio_state(id,payload) VALUES(1,?)")
        .run(JSON.stringify(seedState()));

    new AssessmentRepository(this.filename, this.db);
    const state = this.read();
    if (state.seedFormat !== 2) {
      const seed = seedState();
      const set = state.itemSets.find((s) => s.id === "bfi-source");
      const bp = state.blueprints.find((b) => b.id === "bfi-blueprint");
      if (set)
        set.versions.push({
          ...seed.itemSets[0].versions[0],
          id: "bfi-source-structured-v2",
          number: set.versions.length + 1,
          reason:
            "按既有复合 facet 标签明确前缀拆分五大维度；原版本与已冻结任务保留",
        });
      if (bp)
        bp.versions.push({
          ...seed.blueprints[0].versions[0],
          id: "bfi-blueprint-structured-v2",
          number: bp.versions.length + 1,
        });
      state.seedFormat = 2;
      this.db
        .prepare("UPDATE studio_state SET payload=? WHERE id=1")
        .run(JSON.stringify(state));
    }
  }
  read(): StudioState {
    return JSON.parse(
      (
        this.db
          .prepare("SELECT payload FROM studio_state WHERE id=1")
          .get() as { payload: string }
      ).payload,
    );
  }
  execute(a: StudioAction) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const state = this.read();
      let contextSnapshot;
      if (a.action === "createTask" && a.contextSelection) {
        const catalog = new AssessmentRepository(this.filename, this.db, true);
        contextSnapshot = catalog.snapshot(a.contextSelection);
        if (a.context !== contextSnapshot.context.name) throw new StudioError("目标情境与关联配置不一致",409);
      }
      const resultId = applyAction(state, a);
      if (contextSnapshot) {
        const created = state.tasks.find(t => t.id === resultId)!;
        created.input.contextSnapshot = contextSnapshot;
      }
      this.db
        .prepare("UPDATE studio_state SET payload=? WHERE id=1")
        .run(JSON.stringify(state));
      this.db
        .prepare("INSERT INTO change_log(at,action,result_id) VALUES(?,?,?)")
        .run(new Date().toISOString(), a.action, resultId);
      this.db.exec("COMMIT");
      return { state, resultId };
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
let repository: StudioRepository | undefined;
export const getRepository = () =>
  repository ?? (repository = new StudioRepository());
