import { randomUUID,createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { AssessmentRepository,AssessmentError,databasePath } from "./repository";
import { adaptPublication } from "./material";
import { checkChapters,testDraftSchema,type TestRecord,type TestDetail,type Material,type TestRelease,type ReleaseContent,type Asset } from "./test-model";
import type { Publication,StudioState } from "@/lib/studio/model";

export class TestRepository extends AssessmentRepository {
  constructor(filename=databasePath(),connection?:DatabaseSync) {
    super(filename,connection);
    this.db.exec(`CREATE TABLE IF NOT EXISTS test_materials(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,adapted_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_tests(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,material_id TEXT NOT NULL REFERENCES test_materials(id),draft_json TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS test_assets(id TEXT PRIMARY KEY,hash TEXT NOT NULL UNIQUE,width INTEGER NOT NULL,height INTEGER NOT NULL,bytes INTEGER NOT NULL,alt TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS test_releases(id TEXT PRIMARY KEY,test_id TEXT NOT NULL REFERENCES assessment_tests(id),number INTEGER NOT NULL,draft_revision INTEGER NOT NULL,fingerprint TEXT NOT NULL,created_at TEXT NOT NULL,payload_json TEXT NOT NULL,UNIQUE(test_id,number),UNIQUE(test_id,draft_revision));
      CREATE TRIGGER IF NOT EXISTS immutable_material_update BEFORE UPDATE ON test_materials BEGIN SELECT RAISE(ABORT,'材料快照不可修改'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_material_delete BEFORE DELETE ON test_materials BEGIN SELECT RAISE(ABORT,'材料快照不可删除'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_release_update BEFORE UPDATE ON test_releases BEGIN SELECT RAISE(ABORT,'测验发布版本不可修改'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_release_delete BEFORE DELETE ON test_releases BEGIN SELECT RAISE(ABORT,'测验发布版本不可删除'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_asset_update BEFORE UPDATE ON test_assets BEGIN SELECT RAISE(ABORT,'已保存图片不可替换'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_asset_delete BEFORE DELETE ON test_assets BEGIN SELECT RAISE(ABORT,'已保存图片不可删除'); END;
      INSERT OR IGNORE INTO assessment_migrations VALUES(2);`);
  }
  private transaction<T>(operation:()=>T):T {
    this.db.exec("BEGIN IMMEDIATE");
    try{const result=operation();this.db.exec("COMMIT");return result;}catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  private audit(action:string,id:string) {
    this.db.prepare("INSERT INTO assessment_audit(at,action,target_id) VALUES(?,?,?)").run(new Date().toISOString(),action,id);
  }
  private record(row:Record<string,unknown>):TestRecord {
    return {id:row.id as string,revision:row.revision as number,materialId:row.material_id as string,draft:JSON.parse(row.draft_json as string),archived:!!row.archived,createdAt:row.created_at as string,updatedAt:row.updated_at as string};
  }
  private release(row:Record<string,unknown>):TestRelease {
    return {id:row.id as string,testId:row.test_id as string,number:row.number as number,draftRevision:row.draft_revision as number,fingerprint:row.fingerprint as string,createdAt:row.created_at as string,payload:JSON.parse(row.payload_json as string)};
  }
  publications() {
    if(!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='studio_state'").get())return [];
    const row=this.db.prepare("SELECT payload FROM studio_state WHERE id=1").get();
    const state=row?JSON.parse(row.payload as string) as StudioState:null;
    return (state?.publications??[]).map(p=>({id:p.id,title:p.task.run?.story.title??p.task.name,itemCount:p.task.run?.items.length??0,createdAt:p.createdAt}));
  }
  list() {
    return this.db.prepare("SELECT * FROM assessment_tests ORDER BY updated_at DESC,id").all().map(row=>{
      const t=this.record(row);
      return {id:t.id,title:t.draft.title,description:t.draft.description,revision:t.revision,updatedAt:t.updatedAt,archived:t.archived,
        releases:(this.db.prepare("SELECT COUNT(*) AS n FROM test_releases WHERE test_id=?").get(t.id) as {n:number}).n};
    });
  }
  detail(id:string):TestDetail {
    const row=this.db.prepare("SELECT * FROM assessment_tests WHERE id=?").get(id);
    if(!row)throw new AssessmentError("测验不存在",404);
    const test=this.record(row);
    const materialRow=this.db.prepare("SELECT adapted_json FROM test_materials WHERE id=?").get(test.materialId);
    if(!materialRow)throw new AssessmentError("材料快照不存在",409);
    const material=JSON.parse(materialRow.adapted_json as string) as Material;
    const releases=this.db.prepare("SELECT * FROM test_releases WHERE test_id=? ORDER BY number DESC").all(id).map(r=>{
      const {payload: _payload,...summary}=this.release(r);void _payload;return summary;
    });
    return {test,material,releases};
  }
  create(publicationId:string,title:string) {
    if(!title.trim()||title.length>120)throw new AssessmentError("请填写 120 字以内的测验名称");
    return this.transaction(()=>{
      const stateRow=this.db.prepare("SELECT payload FROM studio_state WHERE id=1").get();
      const p=stateRow?(JSON.parse(stateRow.payload as string) as StudioState).publications.find(p=>p.id===publicationId):null;
      if(!p)throw new AssessmentError("请选择已入库的材料",404);
      let material:Material;
      try{material=adaptPublication(p);}catch(e){throw new AssessmentError(e instanceof Error?e.message:"材料校验失败",409);}
      const stored=this.db.prepare("SELECT id,adapted_json FROM test_materials WHERE publication_id=?").get(p.id);
      if(stored && JSON.stringify(material)!==stored.adapted_json)throw new AssessmentError("原材料与已冻结副本不一致",409);
      const materialId=stored?.id as string??randomUUID();
      if(!stored)this.db.prepare("INSERT INTO test_materials VALUES(?,?,?,?)").run(materialId,p.id,JSON.stringify(p),JSON.stringify(material));
      const draft=testDraftSchema.parse({title:title.trim(),description:"",introduction:"",instruction:material.content.instruction,consent:"",selection:null,coverAssetId:null,
        chapters:material.content.events.map((e,i)=>({id:randomUUID(),title:`第 ${i+1} 章`,eventIds:[e.eventId],backgroundAssetId:null,overlay:0.55,position:"center"})),rules:{allowBack:true,requireAll:true,feedback:"completion"}});
      try{checkChapters(draft,material);}catch(e){throw new AssessmentError((e as Error).message,409);}
      const id=randomUUID(),now=new Date().toISOString();
      this.db.prepare("INSERT INTO assessment_tests VALUES(?,1,?,?,0,?,?)").run(id,materialId,JSON.stringify(draft),now,now);
      this.audit("createTest",id);return this.detail(id);
    });
  }
  private validate(draft:TestRecord["draft"],material:Material) {
    try{checkChapters(draft,material);}catch(e){throw new AssessmentError((e as Error).message);}
    for(const id of [draft.coverAssetId,...draft.chapters.map(c=>c.backgroundAssetId)])if(id&&!this.asset(id))throw new AssessmentError("所选图片不存在，请重新选择");
    return draft.selection?this.snapshot(draft.selection):null;
  }
  save(id:string,revision:number,input:unknown) {
    const parsed=testDraftSchema.safeParse(input);
    if(!parsed.success)throw new AssessmentError("配置格式不正确："+parsed.error.issues.map(i=>i.message).join("；"));
    return this.transaction(()=>{
      const current=this.detail(id);
      if(current.test.revision!==revision)throw new AssessmentError("测验已在其他窗口更新，请重新加载后核对",409);
      this.validate(parsed.data,current.material);
      this.db.prepare("UPDATE assessment_tests SET draft_json=?,revision=revision+1,updated_at=? WHERE id=?").run(JSON.stringify(parsed.data),new Date().toISOString(),id);
      this.audit("saveTest",id);return this.detail(id);
    });
  }
  publish(id:string,revision:number):TestRelease {
    return this.transaction(()=>{
      const current=this.detail(id);
      const existing=this.releaseForRevision(id,revision);
      if(existing)return existing;
      if(current.test.revision!==revision)throw new AssessmentError("配置已更新，请先核对最新版本",409);
      const {draft,materialId}=current.test;
      if(current.test.archived)throw new AssessmentError("已归档测验不能发布",409);
      const identity=this.validate(draft,current.material);
      if(!identity)throw new AssessmentError("请选择适用身份与情境");
      if(!draft.instruction.trim()||!draft.consent.trim())throw new AssessmentError("发布前请填写作答说明和参与说明");
      const stored=this.db.prepare("SELECT source_json,adapted_json FROM test_materials WHERE id=?").get(materialId)!;
      const verified=adaptPublication(JSON.parse(stored.source_json as string) as Publication);
      if(JSON.stringify(verified)!==stored.adapted_json)throw new AssessmentError("材料副本完整性检查失败",409);
      const payload:ReleaseContent={schemaVersion:1,draft:structuredClone(draft),contextSnapshot:identity,content:verified.content};
      const fingerprint=createHash("sha256").update(JSON.stringify({draft,materialHash:verified.contentHash,audience:identity.audience,context:identity.context})).digest("hex");
      const number=current.releases.length+1,releaseId=randomUUID(),createdAt=new Date().toISOString();
      this.db.prepare("INSERT INTO test_releases VALUES(?,?,?,?,?,?,?)").run(releaseId,id,number,revision,fingerprint,createdAt,JSON.stringify(payload));
      this.audit("releaseTest",releaseId);
      return {id:releaseId,testId:id,number,draftRevision:revision,fingerprint,createdAt,payload};
    });
  }
  releaseForRevision(testId:string,revision:number) {
    const row=this.db.prepare("SELECT * FROM test_releases WHERE test_id=? AND draft_revision=?").get(testId,revision);
    return row?this.release(row):null;
  }
  getRelease(id:string,testId:string) {
    const row=this.db.prepare("SELECT * FROM test_releases WHERE id=? AND test_id=?").get(id,testId);
    if(!row)throw new AssessmentError("发布版本不存在",404);
    return this.release(row);
  }
  assets():Asset[] {
    return this.db.prepare("SELECT id,hash,width,height,bytes,alt,created_at AS createdAt FROM test_assets ORDER BY created_at DESC,id").all() as Asset[];
  }
  asset(id:string):Asset|null {
    return (this.db.prepare("SELECT id,hash,width,height,bytes,alt,created_at AS createdAt FROM test_assets WHERE id=?").get(id) as Asset|undefined)??null;
  }
  addAsset(asset:Asset) {
    return this.transaction(()=>{
      const old=this.db.prepare("SELECT id FROM test_assets WHERE hash=?").get(asset.hash);
      if(old)return this.asset(old.id as string)!;
      this.db.prepare("INSERT INTO test_assets VALUES(?,?,?,?,?,?,?)").run(asset.id,asset.hash,asset.width,asset.height,asset.bytes,asset.alt,asset.createdAt);
      this.audit("uploadTestImage",asset.id);return asset;
    });
  }
}
