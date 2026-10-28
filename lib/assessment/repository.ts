import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { catalogAction, selectionSchema, type Catalog, type Profile, type ContextSnapshot } from "./model";

export class AssessmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function databasePath() {
  return process.env.SJT_DATABASE_PATH ?? path.join(process.cwd(), "data/studio/studio.sqlite");
}
export class AssessmentRepository {
  db: DatabaseSync;
  constructor(filename = databasePath(), connection?: DatabaseSync, skipMigration = false) {
    if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });
    this.db = connection ?? new DatabaseSync(filename);
    if(skipMigration) return;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS assessment_meta(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
      INSERT OR IGNORE INTO assessment_meta VALUES(1,0);
      CREATE TABLE IF NOT EXISTS assessment_profiles(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('audience','context')), name TEXT NOT NULL, description TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), revision INTEGER NOT NULL, UNIQUE(kind,name));
      CREATE TABLE IF NOT EXISTS audience_contexts(audience_id TEXT NOT NULL REFERENCES assessment_profiles(id), context_id TEXT NOT NULL REFERENCES assessment_profiles(id), PRIMARY KEY(audience_id,context_id));
      CREATE TABLE IF NOT EXISTS assessment_audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL, action TEXT NOT NULL, target_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_migrations(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO assessment_migrations VALUES(1);`);
  }
  read(): Catalog {
    return {
      revision: (this.db.prepare("SELECT revision FROM assessment_meta WHERE id=1").get() as {revision:number}).revision,
      profiles: this.db.prepare("SELECT * FROM assessment_profiles ORDER BY rowid").all().map(r => ({...r, enabled: !!r.enabled})) as Profile[],
      links: this.db.prepare("SELECT audience_id AS audienceId,context_id AS contextId FROM audience_contexts").all() as Catalog["links"],
    };
  }
  execute(input: unknown) {
    const parsed = catalogAction.safeParse(input);
    if (!parsed.success) throw new AssessmentError("配置格式不正确");
    const a = parsed.data;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const s = this.read(); let target = "";
      if (a.action === "saveProfile") {
        const p = a.profile, previous = s.profiles.find(x => x.id === p.id);
        if (p.id && !previous) throw new AssessmentError("配置不存在",404);
        if (previous && (previous.revision !== p.revision || previous.kind !== p.kind)) throw new AssessmentError("配置已更新，请刷新核对",409);
        if (s.profiles.some(x => x.id !== p.id && x.kind === p.kind && x.name === p.name)) throw new AssessmentError("同类名称已存在",409);
        target = previous?.id ?? randomUUID();
        this.db.prepare(`INSERT INTO assessment_profiles VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,enabled=excluded.enabled,revision=excluded.revision`).run(target,p.kind,p.name,p.description,Number(p.enabled),(previous?.revision ?? 0)+1);
      } else {
        const audience = s.profiles.find(x=>x.id===a.audienceId && x.kind==="audience");
        const context = s.profiles.find(x=>x.id===a.contextId && x.kind==="context");
        if (!audience || !context) throw new AssessmentError("身份或情境不存在");
        if (a.enabled && (!audience.enabled || !context.enabled)) throw new AssessmentError("请先启用身份和情境");
        if(a.enabled) this.db.prepare("INSERT OR IGNORE INTO audience_contexts VALUES(?,?)").run(a.audienceId,a.contextId);
        else this.db.prepare("DELETE FROM audience_contexts WHERE audience_id=? AND context_id=?").run(a.audienceId,a.contextId);
        target = a.audienceId+":"+a.contextId;
      }
      this.db.prepare("UPDATE assessment_meta SET revision=revision+1 WHERE id=1").run();
      this.db.prepare("INSERT INTO assessment_audit(at,action,target_id) VALUES(?,?,?)").run(new Date().toISOString(),a.action,target);
      const result = this.read(); this.db.exec("COMMIT"); return result;
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
  snapshot(input: unknown): ContextSnapshot {
    const selection = selectionSchema.parse(input), s = this.read();
    const audience = s.profiles.find(x=>x.id===selection.audienceId && x.kind==="audience" && x.enabled);
    const context = s.profiles.find(x=>x.id===selection.contextId && x.kind==="context" && x.enabled);
    if(!audience || !context || !s.links.some(x=>x.audienceId===audience.id && x.contextId===context.id)) throw new AssessmentError("所选身份与情境当前不可用",409);
    if(audience.revision!==selection.audienceRevision || context.revision!==selection.contextRevision) throw new AssessmentError("身份或情境说明已更新，请刷新核对",409);
    return structuredClone({audience,context,frozenAt:new Date().toISOString()});
  }
  close() {this.db.close();}
}
