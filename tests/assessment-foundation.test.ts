// @vitest-environment node
import { describe,it,expect,vi,afterEach } from "vitest";
import { mkdtempSync,writeFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scryptSync,createHash } from "node:crypto";
import { AssessmentRepository } from "@/lib/assessment/repository";
import { StudioRepository } from "@/lib/studio/repository";
import { authenticated,guard,login,logout,cookieName } from "@/lib/auth/session";
import { adaptPublication } from "@/lib/assessment/material";
import { contentFingerprint } from "@/lib/studio/model";
import type { Publication } from "@/lib/studio/model";

const temp:string[]=[];
afterEach(()=>{vi.unstubAllEnvs(); for(const dir of temp.splice(0))rmSync(dir,{recursive:true,force:true});});
function configured() {
  const dir=mkdtempSync(path.join(tmpdir(),"sjt-foundation-"));temp.push(dir);
  vi.stubEnv("SJT_DATABASE_PATH",path.join(dir,"test.sqlite"));
  const config=path.join(dir,"auth.json"),password="test-only-password-123";
  writeFileSync(config,JSON.stringify({salt:"test-salt",hash:scryptSync(password,"test-salt",64).toString("hex")}));
  vi.stubEnv("SJT_ADMIN_CONFIG_PATH",config);return {dir,password};
}
function request(token="",method="GET",origin="http://localhost:3000") {return new Request("http://localhost:3000/api/studio",{method,headers:{cookie:`${cookieName}=${token}`,origin}});}
describe("管理认证边界",()=>{
  it("拒绝未登录与伪造令牌",()=>{configured();expect(guard(request())?.status).toBe(401);expect(authenticated(request("a".repeat(64)))).toBe(false);});
  it("登录、同源写入、跨站拦截和注销",()=>{const {password}=configured();const result=login(password);expect(result.status).toBe(200);expect(authenticated(request(result.token))).toBe(true);expect(guard(request(result.token,"POST"))).toBe(null);expect(guard(request(result.token,"POST","https://other.example"))?.status).toBe(403);logout(request(result.token));expect(authenticated(request(result.token))).toBe(false);});
  it("失败登录限流且配置缺失不放行",()=>{configured();for(let i=0;i<10;i++)expect(login("wrong").status).toBe(401);expect(login("wrong").status).toBe(429);vi.stubEnv("SJT_ADMIN_CONFIG_PATH","missing-config");expect(login("wrong").status).toBe(503);});
  it("过期会话被拒绝",()=>{const {password}=configured();const result=login(password);const r=new AssessmentRepository();r.db.prepare("UPDATE admin_sessions SET expires=0").run();r.close();expect(authenticated(request(result.token))).toBe(false);});
});
describe("身份情境与兼容迁移",()=>{
  it("新增、关系、修订冲突、停用和冻结副本",()=>{
    const r=new AssessmentRepository(":memory:");
    try{
      r.execute({action:"saveProfile",profile:{kind:"audience",name:"大学生",description:"角色说明",enabled:true}});
      let s=r.execute({action:"saveProfile",profile:{kind:"context",name:"大学学习",description:"环境要求",enabled:true}});
      const [a,c]=s.profiles;r.execute({action:"setLink",audienceId:a.id,contextId:c.id,enabled:true});
      const selection={audienceId:a.id,contextId:c.id,audienceRevision:1,contextRevision:1};
      const frozen=r.snapshot(selection);
      s=r.execute({action:"saveProfile",profile:{...c,description:"新说明"}});
      expect(frozen.context.description).toBe("环境要求");expect(s.profiles[1].revision).toBe(2);
      expect(()=>r.snapshot(selection)).toThrow("更新");
      expect(()=>r.execute({action:"saveProfile",profile:{...c,name:"过时修改"}})).toThrow("更新");
      expect(()=>r.execute({action:"saveProfile",profile:{kind:"context",name:"大学学习",description:"",enabled:true}})).toThrow("已存在");
      r.execute({action:"saveProfile",profile:{...s.profiles[1],enabled:false}});
      expect(()=>r.snapshot({...selection,contextRevision:3})).toThrow("不可用");
    }finally{r.close();}
  });
  it("数据库重启不丢配置，旧状态和发布快照保持不变",()=>{
    const {dir}=configured(),file=path.join(dir,"test.sqlite");
    const studio=new StudioRepository(file),before=studio.read();studio.close();
    const r=new AssessmentRepository(file);r.execute({action:"saveProfile",profile:{kind:"audience",name:"在职人员",description:"",enabled:true}});r.close();
    const again=new StudioRepository(file);expect(again.read()).toEqual(before);again.close();
    const catalog=new AssessmentRepository(file);expect(catalog.read().profiles[0].name).toBe("在职人员");catalog.close();
  });
  it("任务创建事务冻结已核对配置，配置更新不改变任务",()=>{
    configured();const studio=new StudioRepository();const r=new AssessmentRepository();
    try{
      r.execute({action:"saveProfile",profile:{kind:"audience",name:"大学生",description:"角色",enabled:true}});
      const s=r.execute({action:"saveProfile",profile:{kind:"context",name:"大学",description:"旧环境",enabled:true}});
      const [a,c]=s.profiles;r.execute({action:"setLink",audienceId:a.id,contextId:c.id,enabled:true});
      const state=studio.read(),set=state.itemSets[0],sv=set.versions.at(-1)!,bp=state.blueprints[0],bv=bp.versions.at(-1)!;
      const action={action:"createTask" as const,name:"冻结验收",context:"大学",setId:set.id,setVersion:sv.id,blueprintId:bp.id,blueprintVersion:bv.id,budget:null,maxRevisions:3,sourceIds:sv.rows.map(x=>x.sourceId),contextSelection:{audienceId:a.id,contextId:c.id,audienceRevision:1,contextRevision:1}};
      const out=studio.execute(action);r.execute({action:"saveProfile",profile:{...c,description:"新环境"}});
      expect(studio.read().tasks.find(t=>t.id===out.resultId)?.input.contextSnapshot?.context.description).toBe("旧环境");
      expect(()=>studio.execute(action)).toThrow("更新");
    }finally{r.close();studio.close();}
  });
});
describe("材料白名单适配",()=>{
  function fixture():Publication {
    const r=new StudioRepository(":memory:");const id=r.execute({action:"openCase"}).resultId;
    const task=r.read().tasks.find(t=>t.id===id)!;task.staleIds=[];task.outlineConfirmed=true;
    r.close();return {id:"publication-test",taskId:task.id,createdAt:"test",fingerprint:createHash("sha256").update(contentFingerprint(task.run)+JSON.stringify(task.input)).digest("hex"),task};
  }
  it("60题、四选项、稳定引用且不含后台评分/构念/来源",()=>{
    const p=fixture(),before=JSON.stringify(p),adapted=adaptPublication(p);
    expect(adapted.content.items).toHaveLength(60);expect(adapted.content.items.every(i=>i.options.length===4)).toBe(true);
    expect(Object.keys(adapted.content.items[0]).sort()).toEqual(["eventId","itemId","options","stem"]);
    expect(Object.keys(adapted.content.items[0].options[0]).sort()).toEqual(["optionId","text"]);
    expect(JSON.stringify(adapted.content)).not.toMatch(/candidate_level|review_reports|source_item_id|facet|scoring_key/);
    expect(JSON.stringify(p)).toBe(before);expect(adaptPublication(p).contentHash).toBe(adapted.contentHash);
  });
  it("拒绝失效评分材料和错误事件引用",()=>{
    const p=fixture();p.task.staleIds=[p.task.run!.items[0].item_id];expect(()=>adaptPublication(p)).toThrow("发布检查");
    p.task.staleIds=[];p.task.run!.outline.events[0].item_ids.push(p.task.run!.items[0].item_id);expect(()=>adaptPublication(p)).toThrow();
  });
});
