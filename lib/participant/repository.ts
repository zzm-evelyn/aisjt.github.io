import { randomBytes,randomUUID,createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { TestRepository } from "@/lib/assessment/test-repository";
import { AssessmentError,databasePath } from "@/lib/assessment/repository";
import { presentation,playerSteps,type TestRelease } from "@/lib/assessment/test-model";
import { answerSchema,startSchema,retentionSeconds,type StartInput,type AnswerInput,type Answer,type SessionView,type SaveResult,type Availability,type PublicTest,type PublicCatalog } from "./model";
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
type Row={id:string;test_id:string;release_id:string;browser_hash:string;participant_code:string;status:SessionView["status"];current_index:number;created_at:string;updated_at:string;expires_at:number;completed_at:string|null};

export class ParticipantRepository extends TestRepository {
  constructor(filename=databasePath(),connection?:DatabaseSync){
    super(filename,connection);
    this.db.exec(`CREATE TABLE IF NOT EXISTS test_availability(test_id TEXT PRIMARY KEY REFERENCES assessment_tests(id),release_id TEXT NOT NULL REFERENCES test_releases(id),accepting_new INTEGER NOT NULL CHECK(accepting_new IN (0,1)),revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS participant_browsers(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS participant_sessions(id TEXT PRIMARY KEY,test_id TEXT NOT NULL REFERENCES assessment_tests(id),release_id TEXT NOT NULL REFERENCES test_releases(id),browser_hash TEXT NOT NULL REFERENCES participant_browsers(token_hash),participant_code TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('in_progress','submitted')),current_index INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,expires_at INTEGER NOT NULL,completed_at TEXT,start_request_id TEXT NOT NULL,start_payload_hash TEXT NOT NULL,consented_at TEXT NOT NULL,UNIQUE(browser_hash,start_request_id));
      CREATE INDEX IF NOT EXISTS participant_sessions_browser ON participant_sessions(browser_hash,updated_at);
      CREATE TABLE IF NOT EXISTS participant_answers(session_id TEXT NOT NULL REFERENCES participant_sessions(id),item_id TEXT NOT NULL,option_id TEXT NOT NULL,revision INTEGER NOT NULL,saved_at TEXT NOT NULL,PRIMARY KEY(session_id,item_id));
      CREATE TABLE IF NOT EXISTS participant_answer_events(session_id TEXT NOT NULL REFERENCES participant_sessions(id),request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,item_id TEXT NOT NULL,accepted_revision INTEGER NOT NULL,at TEXT NOT NULL,PRIMARY KEY(session_id,request_id));
      CREATE TABLE IF NOT EXISTS participant_submissions(id TEXT PRIMARY KEY,session_id TEXT NOT NULL UNIQUE REFERENCES participant_sessions(id),request_id TEXT NOT NULL,answers_json TEXT NOT NULL,fingerprint TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS immutable_submission_update BEFORE UPDATE ON participant_submissions BEGIN SELECT RAISE(ABORT,'提交快照不可修改'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_submission_delete BEFORE DELETE ON participant_submissions BEGIN SELECT RAISE(ABORT,'提交快照不可删除'); END;
      CREATE TRIGGER IF NOT EXISTS submitted_answer_update BEFORE UPDATE ON participant_answers WHEN (SELECT status FROM participant_sessions WHERE id=OLD.session_id)='submitted' BEGIN SELECT RAISE(ABORT,'已提交回答不可修改'); END;
      CREATE TRIGGER IF NOT EXISTS submitted_answer_insert BEFORE INSERT ON participant_answers WHEN (SELECT status FROM participant_sessions WHERE id=NEW.session_id)='submitted' BEGIN SELECT RAISE(ABORT,'已提交回答不可修改'); END;
      CREATE TRIGGER IF NOT EXISTS submitted_answer_delete BEFORE DELETE ON participant_answers WHEN (SELECT status FROM participant_sessions WHERE id=OLD.session_id)='submitted' BEGIN SELECT RAISE(ABORT,'已提交回答不可删除'); END;
      INSERT OR IGNORE INTO assessment_migrations VALUES(3);`);
  }
  private atomic<T>(operation:()=>T):T {this.db.exec("BEGIN IMMEDIATE");try{const value=operation();this.db.exec("COMMIT");return value;}catch(e){this.db.exec("ROLLBACK");throw e;}}
  private browserHash(token:string){
    if(!/^[a-f0-9]{64}$/.test(token))throw new AssessmentError("作答凭据不存在，请从测验入口开始",401);
    const hash=digest(token),row=this.db.prepare("SELECT expires_at FROM participant_browsers WHERE token_hash=?").get(hash);
    if(!row||Number(row.expires_at)<=Date.now())throw new AssessmentError("作答凭据已失效，请从测验入口开始",401);
    return hash;
  }
  issueBrowser(current?:string):string {
    if(current){try{const hash=this.browserHash(current);this.db.prepare("UPDATE participant_browsers SET expires_at=? WHERE token_hash=?").run(Date.now()+retentionSeconds*1000,hash);return current;}catch{}}
    const token=randomBytes(32).toString("hex");this.db.prepare("INSERT INTO participant_browsers VALUES(?,?)").run(digest(token),Date.now()+retentionSeconds*1000);return token;
  }
  availability(testId:string):Availability {
    this.detail(testId);const row=this.db.prepare("SELECT * FROM test_availability WHERE test_id=?").get(testId);
    return {testId,releaseId:row?.release_id as string??null,acceptingNew:!!row?.accepting_new,revision:row?.revision as number??0};
  }
  setAvailability(testId:string,revision:number,releaseId:string,acceptingNew:boolean):Availability {
    return this.atomic(()=>{
      const current=this.availability(testId);if(current.revision!==revision)throw new AssessmentError("开放设置已更新，请刷新核对",409);
      const release=this.getRelease(releaseId,testId);if(acceptingNew&&!this.releaseAvailable(release))throw new AssessmentError("适用身份或情境当前不可用",409);
      this.db.prepare("INSERT INTO test_availability VALUES(?,?,?,?) ON CONFLICT(test_id) DO UPDATE SET release_id=excluded.release_id,accepting_new=excluded.accepting_new,revision=excluded.revision").run(testId,releaseId,Number(acceptingNew),revision+1);
      this.db.prepare("INSERT INTO assessment_audit(at,action,target_id) VALUES(?,?,?)").run(new Date().toISOString(),acceptingNew?"openParticipantTest":"closeNewParticipantSessions",testId);
      return this.availability(testId);
    });
  }
  private releaseAvailable(release:TestRelease){
    const snapshot=release.payload.contextSnapshot,catalog=this.read();
    return catalog.profiles.some(p=>p.id===snapshot.audience.id&&p.kind==="audience"&&p.enabled)&&catalog.profiles.some(p=>p.id===snapshot.context.id&&p.kind==="context"&&p.enabled)&&catalog.links.some(l=>l.audienceId===snapshot.audience.id&&l.contextId===snapshot.context.id)&&!this.detail(release.testId).test.archived;
  }
  private summary(release:TestRelease):PublicTest {
    const p=release.payload;
    return {testId:release.testId,releaseId:release.id,releaseNumber:release.number,title:p.draft.title,description:p.draft.description,audienceId:p.contextSnapshot.audience.id,audience:p.contextSnapshot.audience.name,contextId:p.contextSnapshot.context.id,context:p.contextSnapshot.context.name,itemCount:p.content.items.length,coverAssetId:p.draft.coverAssetId};
  }
  catalog():PublicCatalog {
    const tests:PublicTest[]=[];
    for(const row of this.db.prepare("SELECT test_id,release_id FROM test_availability WHERE accepting_new=1 ORDER BY test_id").all()){
      const release=this.getRelease(row.release_id as string,row.test_id as string);if(this.releaseAvailable(release))tests.push(this.summary(release));
    }
    return {tests};
  }
  publicTest(testId:string){
    const summary=this.catalog().tests.find(t=>t.testId===testId);if(!summary)throw new AssessmentError("该测验当前未开放，请返回选择其他测验",404);
    const release=this.getRelease(summary.releaseId,testId);return {test:summary,introduction:release.payload.draft.introduction,instruction:release.payload.draft.instruction,consent:release.payload.draft.consent};
  }
  publicCover(assetId:string){if(!this.catalog().tests.some(t=>t.coverAssetId===assetId))throw new AssessmentError("封面不存在",404);return this.asset(assetId)!;}
  start(token:string,input:StartInput):SessionView {
    const parsed=startSchema.safeParse(input);if(!parsed.success)throw new AssessmentError("请核对测验与参与说明后开始");const a=parsed.data;
    return this.atomic(()=>{
      const browser=this.browserHash(token),payloadHash=digest(JSON.stringify(a));
      const previous=this.db.prepare("SELECT * FROM participant_sessions WHERE browser_hash=? AND start_request_id=?").get(browser,a.requestId);
      if(previous){if(previous.start_payload_hash!==payloadHash)throw new AssessmentError("重复请求内容不同，请重新开始",409);return this.session(token,previous.id as string);}
      const welcome=this.publicTest(a.testId);if(welcome.test.releaseId!==a.expectedReleaseId)throw new AssessmentError("测验版本已更新，请重新核对说明",409);
      const count=this.db.prepare("SELECT COUNT(*) AS n FROM participant_sessions WHERE browser_hash=? AND created_at>?").get(browser,new Date(Date.now()-86400_000).toISOString()) as {n:number};
      if(count.n>=20)throw new AssessmentError("本浏览器开始次数较多，请稍后再试",429);
      const id=randomUUID(),now=new Date().toISOString(),code=a.participantCode||`P-${id.slice(0,8)}`;
      const browserExpiry=this.db.prepare("SELECT expires_at FROM participant_browsers WHERE token_hash=?").get(browser)!.expires_at as number;
      this.db.prepare("INSERT INTO participant_sessions(id,test_id,release_id,browser_hash,participant_code,status,current_index,created_at,updated_at,expires_at,completed_at,start_request_id,start_payload_hash,consented_at) VALUES(?,?,?,?,?,'in_progress',0,?,?,?,NULL,?,?,?)").run(id,a.testId,a.expectedReleaseId,browser,code,now,now,browserExpiry,a.requestId,payloadHash,now);
      return this.session(token,id);
    });
  }
  private owned(token:string,id:string):Row {
    const browser=this.browserHash(token),row=this.db.prepare("SELECT * FROM participant_sessions WHERE id=? AND browser_hash=?").get(id,browser) as Row|undefined;
    if(!row)throw new AssessmentError("本浏览器中不存在这次作答",404);if(row.expires_at<=Date.now())throw new AssessmentError("本次作答的恢复期限已过",410);return row;
  }
  private definition(row:Row){return this.getRelease(row.release_id,row.test_id);}
  private ordered(row:Row){const release=this.definition(row);return playerSteps(presentation(release.payload.draft,release.payload.content,release.payload.contextSnapshot)).map(s=>s.item);}
  private answers(id:string):Answer[]{return this.db.prepare("SELECT item_id AS itemId,option_id AS optionId,revision,saved_at AS savedAt FROM participant_answers WHERE session_id=? ORDER BY item_id").all(id) as Answer[];}
  session(token:string,id:string):SessionView {
    const row=this.owned(token,id),release=this.definition(row),answers=this.answers(id),submitted=this.db.prepare("SELECT id FROM participant_submissions WHERE session_id=?").get(id);
    return {id:row.id,testId:row.test_id,releaseId:row.release_id,releaseNumber:release.number,title:release.payload.draft.title,participantCode:row.participant_code,status:row.status,currentIndex:row.current_index,answered:answers.length,total:release.payload.content.items.length,answers,createdAt:row.created_at,updatedAt:row.updated_at,completedAt:row.completed_at,submissionId:submitted?.id as string??null};
  }
  listSessions(token:string){const browser=this.browserHash(token);return this.db.prepare("SELECT id FROM participant_sessions WHERE browser_hash=? AND expires_at>? ORDER BY updated_at DESC LIMIT 20").all(browser,Date.now()).map(row=>{const {answers,...summary}=this.session(token,row.id as string);void answers;return summary;});}
  content(token:string,id:string){const row=this.owned(token,id),release=this.definition(row);return presentation(release.payload.draft,release.payload.content,release.payload.contextSnapshot);}
  saveAnswer(token:string,id:string,input:AnswerInput):SaveResult {
    const parsed=answerSchema.safeParse(input);if(!parsed.success)throw new AssessmentError("回答格式不正确");const a=parsed.data;
    return this.atomic(()=>{
      const row=this.owned(token,id),payloadHash=digest(JSON.stringify(a)),existing=this.db.prepare("SELECT * FROM participant_answer_events WHERE session_id=? AND request_id=?").get(id,a.requestId);
      if(existing){if(existing.payload_hash!==payloadHash)throw new AssessmentError("重复请求内容不同，请重新核对",409);return {answer:this.answers(id).find(v=>v.itemId===a.itemId)!,acceptedRevision:existing.accepted_revision as number,replayed:true,status:row.status};}
      if(row.status==="submitted")throw new AssessmentError("本次回答已提交，不能修改",409);
      const items=this.ordered(row),index=items.findIndex(i=>i.itemId===a.itemId),item=items[index];
      if(!item||!item.options.some(o=>o.optionId===a.optionId))throw new AssessmentError("题目或选项不属于本次测验");
      const answers=this.answers(id),firstMissing=items.findIndex(i=>!answers.some(v=>v.itemId===i.itemId));
      const allowBack=this.definition(row).payload.draft.rules.allowBack;
      if(!allowBack&&index!==row.current_index)throw new AssessmentError("请按当前题目作答，不允许返回修改",409);
      if(firstMissing>=0&&index>firstMissing)throw new AssessmentError("请先完成前面的题目",409);
      const old=answers.find(v=>v.itemId===a.itemId);if((old?.revision??0)!==a.expectedRevision)throw new AssessmentError("这道题已在其他窗口更新，请核对已保存的答案",409);
      const revision=(old?.revision??0)+1,now=new Date().toISOString();
      this.db.prepare("INSERT INTO participant_answers VALUES(?,?,?,?,?) ON CONFLICT(session_id,item_id) DO UPDATE SET option_id=excluded.option_id,revision=excluded.revision,saved_at=excluded.saved_at").run(id,a.itemId,a.optionId,revision,now);
      this.db.prepare("INSERT INTO participant_answer_events VALUES(?,?,?,?,?,?)").run(id,a.requestId,payloadHash,a.itemId,revision,now);
      this.db.prepare("UPDATE participant_sessions SET updated_at=? WHERE id=?").run(now,id);
      return {answer:{itemId:a.itemId,optionId:a.optionId,revision,savedAt:now},acceptedRevision:revision,replayed:false,status:row.status};
    });
  }
  navigate(token:string,id:string,index:number){
    return this.atomic(()=>{
      const row=this.owned(token,id);if(row.status==="submitted")throw new AssessmentError("本次回答已提交",409);
      const items=this.ordered(row);if(!Number.isInteger(index)||index<0||index>=items.length)throw new AssessmentError("题目位置不正确");
      if(!this.definition(row).payload.draft.rules.allowBack&&index<row.current_index)throw new AssessmentError("本测验不允许返回修改",409);
      const answers=this.answers(id),missing=items.findIndex(i=>!answers.some(a=>a.itemId===i.itemId));
      if(missing>=0&&index>missing)throw new AssessmentError("请先完成当前题目",409);
      this.db.prepare("UPDATE participant_sessions SET current_index=?,updated_at=? WHERE id=?").run(index,new Date().toISOString(),id);return this.session(token,id);
    });
  }
  submit(token:string,id:string,requestId:string):SessionView {
    if(!/^[a-f0-9-]{36}$/i.test(requestId))throw new AssessmentError("提交请求格式不正确");
    return this.atomic(()=>{
      const row=this.owned(token,id);if(row.status==="submitted")return this.session(token,id);
      const items=this.ordered(row),answers=this.answers(id),missing=items.filter(i=>!answers.some(a=>a.itemId===i.itemId&&i.options.some(o=>o.optionId===a.optionId)));
      if(missing.length)throw new AssessmentError(`尚有 ${missing.length} 道题未完成，请继续作答`,409);
      const json=JSON.stringify(items.map(i=>answers.find(a=>a.itemId===i.itemId)!)),now=new Date().toISOString();
      this.db.prepare("INSERT INTO participant_submissions VALUES(?,?,?,?,?,?)").run(randomUUID(),id,requestId,json,digest(json),now);
      this.db.prepare("UPDATE participant_sessions SET status='submitted',completed_at=?,updated_at=? WHERE id=?").run(now,now,id);return this.session(token,id);
    });
  }
  sessionAsset(token:string,id:string,assetId:string){const view=this.content(token,id);if(![view.coverAssetId,...view.chapters.map(c=>c.backgroundAssetId)].includes(assetId))throw new AssessmentError("本次作答不能读取这张图片",403);const asset=this.asset(assetId);if(!asset)throw new AssessmentError("图片不存在",404);return asset;}
  records(testId:string){this.detail(testId);return this.db.prepare("SELECT s.id,s.participant_code AS participantCode,s.release_id AS releaseId,r.number AS releaseNumber,s.status,s.created_at AS createdAt,s.updated_at AS updatedAt,s.completed_at AS completedAt,(SELECT COUNT(*) FROM participant_answers a WHERE a.session_id=s.id) AS answered FROM participant_sessions s JOIN test_releases r ON r.id=s.release_id WHERE s.test_id=? ORDER BY s.created_at DESC LIMIT 500").all(testId);}
}
