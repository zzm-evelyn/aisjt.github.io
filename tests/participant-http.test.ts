// @vitest-environment node
import { it,expect,afterEach,vi } from "vitest";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { GET as catalog } from "@/app/api/public/catalog/route";
import { POST as identity } from "@/app/api/participant/identity/route";
import { POST as start } from "@/app/api/participant/sessions/route";
import { GET as sessionGET } from "@/app/api/participant/sessions/[id]/route";
import { GET as availability } from "@/app/api/admin/tests/[id]/availability/route";
import { GET as welcome } from "@/app/api/public/tests/[id]/route";
import { ParticipantRepository } from "@/lib/participant/repository";
import { StudioRepository } from "@/lib/studio/repository";
const folders:string[]=[];afterEach(()=>{vi.unstubAllEnvs();folders.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true}));});
function setup(){const folder=mkdtempSync(path.join(tmpdir(),"sjt-participant-http-"));folders.push(folder);vi.stubEnv("SJT_DATABASE_PATH",path.join(folder,"test.sqlite"));}
it("公开目录匿名可读，浏览器凭据通过HttpOnly Cookie发放而非JSON返回",async()=>{setup();const response=await catalog(new Request("http://localhost:3000/api/public/catalog"));expect(response.status).toBe(200);expect(await response.json()).toEqual({tests:[]});const id=await identity(new Request("http://localhost:3000/api/participant/identity",{method:"POST",headers:{origin:"http://localhost:3000"}}));expect(await id.json()).toEqual({ok:true});expect(id.headers.get("set-cookie")).toMatch(/HttpOnly/i);expect(id.headers.get("set-cookie")).toMatch(/SameSite=strict/i);expect(id.headers.get("cache-control")).toContain("no-store");});
it("跨站创建凭据被拒绝，匿名不能访问个人会话和管理接口",async()=>{setup();expect((await identity(new Request("http://localhost:3000/api/participant/identity",{method:"POST",headers:{origin:"https://other.example"}}))).status).toBe(403);const req=new Request("http://localhost:3000/api/participant/sessions/unknown"),params={params:Promise.resolve({id:"unknown"})};expect((await sessionGET(req,params)).status).toBe(401);expect((await availability(req,params)).status).toBe(401);});
it("正式开始接口不能在没有凭据时绕过浏览器初始化",async()=>{setup();const response=await start(new Request("http://localhost:3000/api/participant/sessions",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({testId:randomUUID(),expectedReleaseId:randomUUID(),requestId:randomUUID(),participantCode:"",consent:true})}));expect(response.status).toBe(401);});
it("公开说明仅返回开场和参与说明，不提前发送全套题目与后台数据",async()=>{setup();const studio=new StudioRepository(),task=studio.execute({action:"openCase"}).resultId,publication=studio.execute({action:"publish",id:task,revision:1}).resultId;studio.close();const r=new ParticipantRepository();let testId="";try{
 r.execute({action:"saveProfile",profile:{kind:"audience",name:"大学生",description:"角色",enabled:true}});const profiles=r.execute({action:"saveProfile",profile:{kind:"context",name:"大学",description:"环境",enabled:true}}).profiles;const [a,c]=profiles;r.execute({action:"setLink",audienceId:a.id,contextId:c.id,enabled:true});const created=r.create(publication,"说明检查");testId=created.test.id;const saved=r.save(testId,1,{...created.test.draft,consent:"研究说明",selection:{audienceId:a.id,contextId:c.id,audienceRevision:1,contextRevision:1}});const release=r.publish(testId,saved.test.revision);r.setAvailability(testId,0,release.id,true);
 }finally{r.close();}
 const response=await welcome(new Request(`http://localhost:3000/api/public/tests/${testId}`),{params:Promise.resolve({id:testId})}),body=await response.json();expect(response.status).toBe(200);expect(Object.keys(body).sort()).toEqual(["consent","instruction","introduction","test"]);expect(JSON.stringify(body)).not.toMatch(/review_reports|candidate_level|"items"|"chapters"/);
});
