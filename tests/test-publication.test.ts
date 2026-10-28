// @vitest-environment node
import { describe,it,expect,afterEach,vi } from "vitest";
import { mkdtempSync,rmSync,mkdirSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scryptSync,createHash } from "node:crypto";
import { contentFingerprint,unitKey,type StudioState } from "@/lib/studio/model";
import { login,cookieName } from "@/lib/auth/session";
import sharp from "sharp";
import { StudioRepository } from "@/lib/studio/repository";
import { TestRepository } from "@/lib/assessment/test-repository";
import { presentation,playerSteps } from "@/lib/assessment/test-model";
import { encodeImage,storeImage,readImage } from "@/lib/assessment/media";
import { GET as testsGET,POST as testsPOST } from "@/app/api/admin/tests/route";
import { GET as assetGET } from "@/app/api/admin/assets/[id]/route";
import { POST as releasePOST } from "@/app/api/admin/tests/[id]/releases/route";

const folders:string[]=[];
afterEach(()=>{vi.unstubAllEnvs();folders.splice(0).forEach(d=>rmSync(d,{recursive:true,force:true}));});
function fixture(directory?:string) {
  const dir=directory??mkdtempSync(path.join(tmpdir(),"sjt-test-publish-"));if(!directory)folders.push(dir);mkdirSync(dir,{recursive:true});
  const filename=path.join(dir,"studio.sqlite");vi.stubEnv("SJT_DATABASE_PATH",filename);vi.stubEnv("SJT_ASSET_DIR",path.join(dir,"assets"));
  const studio=new StudioRepository(filename),taskId=studio.execute({action:"openCase"}).resultId;
  const publicationId=studio.execute({action:"publish",id:taskId,revision:1}).resultId;studio.close();
  const r=new TestRepository(filename);
  r.execute({action:"saveProfile",profile:{kind:"audience",name:"验收身份",description:"隔离测试角色",enabled:true}});
  const catalog=r.execute({action:"saveProfile",profile:{kind:"context",name:"验收校园",description:"隔离测试环境",enabled:true}});
  const [a,c]=catalog.profiles;r.execute({action:"setLink",audienceId:a.id,contextId:c.id,enabled:true});
  const created=r.create(publicationId,"校园情景测验");
  const configured=r.save(created.test.id,1,{...created.test.draft,introduction:"请进入故事，并根据自己的实际倾向作出选择。",consent:"这是本机隔离验收，不收集正式参与者数据。",selection:{audienceId:a.id,contextId:c.id,audienceRevision:1,contextRevision:1}});
  return {dir,filename,r,configured,publicationId};
}
describe("测验配置与发布版本",()=>{
  it("从完整材料创建独立草稿，旧研究状态不改变",()=>{const {r,configured,publicationId}=fixture();try{expect(configured.material.content.items).toHaveLength(60);expect(configured.material.publicationId).toBe(publicationId);expect(configured.test.revision).toBe(2);expect(r.publications()).toHaveLength(1);expect(r.list()).toHaveLength(1);}finally{r.close();}});
  it("拒绝未入库来源且事务不残留草稿",()=>{const {r}=fixture();try{expect(()=>r.create("missing","错误来源")).toThrow("已入库");expect(r.list()).toHaveLength(1);}finally{r.close();}});
  it("保存时检查修订，冲突不会覆盖新配置",()=>{const {r,configured}=fixture();try{r.save(configured.test.id,2,{...configured.test.draft,title:"新标题"});expect(()=>r.save(configured.test.id,2,configured.test.draft)).toThrow("其他窗口");expect(r.detail(configured.test.id).test.draft.title).toBe("新标题");}finally{r.close();}});
  it("拒绝事件遗漏、重复、倒序和章节ID重复",()=>{const {r,configured:d}=fixture();try{const chapters=d.test.draft.chapters;for(const bad of [chapters.slice(1),[...chapters,chapters[0]],[...chapters].reverse(),chapters.map((c,i)=>i===1?{...c,id:chapters[0].id}:c)])expect(()=>r.save(d.test.id,2,{...d.test.draft,chapters:bad})).toThrow();expect(r.detail(d.test.id).test.revision).toBe(2);}finally{r.close();}});
  it("支持合并相邻章节，60题仍完整且顺序相同",()=>{const {r,configured:d}=fixture();try{const [first,second,...rest]=d.test.draft.chapters;const merged=r.save(d.test.id,2,{...d.test.draft,chapters:[{...first,eventIds:[...first.eventIds,...second.eventIds]},...rest]});expect(playerSteps(presentation(merged.test.draft,merged.material.content)).map(s=>s.item.itemId)).toEqual(playerSteps(presentation(d.test.draft,d.material.content)).map(s=>s.item.itemId));}finally{r.close();}});
  it("八题材料也可配置与发布，题量没有写死为60",()=>{const {r}=fixture();try{
    const state=JSON.parse(r.db.prepare("SELECT payload FROM studio_state WHERE id=1").get()!.payload as string) as StudioState;
    const source=structuredClone(state.publications[0]),task=source.task,run=task.run!;
    run.items=run.items.slice(0,8);const ids=new Set(run.items.map(i=>i.item_id)),sources=new Set(run.items.map(i=>i.source_item_id));
    task.input.rows=task.input.rows.filter(row=>sources.has(row.sourceId));
    task.input.units=task.input.units.map(u=>({...u,target:task.input.rows.filter(row=>unitKey(row.domain,row.facet)===unitKey(u.domain,u.facet)).length})).filter(u=>u.target>0);
    run.outline.events=run.outline.events.map(e=>({...e,item_ids:e.item_ids.filter(id=>ids.has(id))})).filter(e=>e.item_ids.length);
    const events=new Set(run.outline.events.map(e=>e.event_id));run.story.segments=run.story.segments.filter(s=>events.has(s.event_id));run.story.text=run.story.segments.map(s=>s.text).join("\n\n");
    source.id="isolated-eight-items";source.fingerprint=createHash("sha256").update(contentFingerprint(run)+JSON.stringify(task.input)).digest("hex");state.publications.push(source);
    r.db.prepare("UPDATE studio_state SET payload=? WHERE id=1").run(JSON.stringify(state));
    const created=r.create(source.id,"八题验收"),selection=r.detail(r.list().find(t=>t.title==="校园情景测验")!.id).test.draft.selection;
    const saved=r.save(created.test.id,1,{...created.test.draft,selection,consent:"隔离验收"});const release=r.publish(saved.test.id,saved.test.revision);
    expect(release.payload.content.items).toHaveLength(8);expect(playerSteps(presentation(release.payload.draft,release.payload.content))).toHaveLength(8);
  }finally{r.close();}});
  it("缺失身份、说明或无效图片不能发布/保存",()=>{const {r,configured:d}=fixture();try{const noIdentity=r.save(d.test.id,2,{...d.test.draft,selection:null});expect(()=>r.publish(d.test.id,noIdentity.test.revision)).toThrow("身份");const noConsent=r.save(d.test.id,3,{...d.test.draft,consent:""});expect(()=>r.publish(d.test.id,noConsent.test.revision)).toThrow("参与说明");expect(()=>r.save(d.test.id,4,{...d.test.draft,coverAssetId:"11111111-1111-4111-8111-111111111111"})).toThrow("图片不存在");}finally{r.close();}});
  it("发布幂等、后续编辑生成V2，V1内容不变",()=>{const {r,configured:d}=fixture();try{const one=r.publish(d.test.id,2),frozen=JSON.stringify(one);expect(r.publish(d.test.id,2).id).toBe(one.id);const edited=r.save(d.test.id,2,{...d.test.draft,title:"第二版名称"});const two=r.publish(d.test.id,edited.test.revision);expect(two.number).toBe(2);expect(r.publish(d.test.id,2).id).toBe(one.id);expect(two.payload.draft.title).toBe("第二版名称");expect(JSON.stringify(r.getRelease(one.id,d.test.id))).toBe(frozen);expect(r.detail(d.test.id).releases).toHaveLength(2);}finally{r.close();}});
  it("数据库禁止改写与删除已发布快照",()=>{const {r,configured:d}=fixture();try{const p=r.publish(d.test.id,2);expect(()=>r.db.prepare("UPDATE test_releases SET payload_json='{}' WHERE id=?").run(p.id)).toThrow("不可修改");expect(()=>r.db.prepare("DELETE FROM test_releases WHERE id=?").run(p.id)).toThrow("不可删除");expect(()=>r.db.prepare("DELETE FROM test_materials WHERE id=?").run(d.test.materialId)).toThrow("不可删除");}finally{r.close();}});
  it("身份说明更新后旧发布不变，新发布要求重新核对",()=>{const {r,configured:d}=fixture();try{const one=r.publish(d.test.id,2),a=r.read().profiles[0];r.execute({action:"saveProfile",profile:{...a,description:"更新身份说明"}});expect(r.getRelease(one.id,d.test.id).payload.contextSnapshot.audience.description).toBe("隔离测试角色");expect(()=>r.save(d.test.id,2,d.test.draft)).toThrow("已更新");}finally{r.close();}});
  it("停用情境不破坏旧发布，阻止新配置使用",()=>{const {r,configured:d}=fixture();try{const one=r.publish(d.test.id,2),c=r.read().profiles[1];r.execute({action:"saveProfile",profile:{...c,enabled:false}});expect(r.getRelease(one.id,d.test.id).payload.contextSnapshot.context.enabled).toBe(true);expect(()=>r.save(d.test.id,2,d.test.draft)).toThrow("不可用");}finally{r.close();}});
  it("重启读取发布与素材引用，材料JSON保持一致",()=>{const {r,configured:d,filename}=fixture();const one=r.publish(d.test.id,2);r.close();const reopened=new TestRepository(filename);try{expect(reopened.getRelease(one.id,d.test.id)).toEqual(one);expect(reopened.detail(d.test.id).material).toEqual(d.material);}finally{reopened.close();}});
  it("预览内容不包含来源文本、模型评分或选项分值",()=>{const {r,configured:d}=fixture();try{const one=r.publish(d.test.id,2),view=presentation(one.payload.draft,one.payload.content,one.payload.contextSnapshot);const serialized=JSON.stringify(view);expect(serialized).not.toMatch(/source_item_id|candidate_level|review_reports|scoring_key|"facet"/);expect(playerSteps(view)).toHaveLength(60);}finally{r.close();}});
});
describe("图片处理与权限",()=>{
  it("真实解码、转WebP、去元信息并限制尺寸",async()=>{const source=await sharp({create:{width:3000,height:1800,channels:3,background:"#24608c"}}).jpeg().toBuffer();const image=await encodeImage(source);expect(image.width).toBeLessThanOrEqual(2560);expect(image.height).toBeLessThanOrEqual(1600);const metadata=await sharp(image.data).metadata();expect(metadata.format).toBe("webp");expect(metadata.exif).toBeUndefined();});
  it("拒绝伪装图片、SVG与过大输入",async()=>{await expect(encodeImage(Buffer.from("not-an-image"))).rejects.toThrow("无法读取");await expect(encodeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'))).rejects.toThrow("JPG");await expect(encodeImage(Buffer.alloc(8_000_001))).rejects.toThrow("8MB");});
  it("同一图片去重、文件损坏可检测，引用固定",async()=>{const {r,configured:d}=fixture();try{const buffer=await sharp({create:{width:64,height:40,channels:3,background:"#356e9a"}}).png().toBuffer();const asset=await storeImage(r,buffer,"校园背景");expect((await storeImage(r,buffer,"同一图片")).id).toBe(asset.id);const updated=r.save(d.test.id,2,{...d.test.draft,coverAssetId:asset.id});const release=r.publish(d.test.id,updated.test.revision);expect(release.payload.draft.coverAssetId).toBe(asset.id);writeFileSync(path.join(process.env.SJT_ASSET_DIR!,asset.hash+".webp"),"damaged");await expect(readImage(asset)).rejects.toThrow("完整性");}finally{r.close();}});
  it("新增管理与图片接口拒绝匿名请求",async()=>{const req=new Request("http://localhost:3000/api/admin/tests");expect((await testsGET(req)).status).toBe(401);expect((await testsPOST(new Request(req,{method:"POST"}))).status).toBe(401);expect((await assetGET(req,{params:Promise.resolve({id:"missing"})})).status).toBe(401);expect((await releasePOST(new Request(req,{method:"POST"}),{params:Promise.resolve({id:"missing"})})).status).toBe(401);});
  it("发布接口在图片文件缺失时拒绝提交且不残留发布记录",async()=>{
    const {r,configured:d,dir}=fixture();try{
      const config=path.join(dir,"auth.json"),salt="route-test";writeFileSync(config,JSON.stringify({salt,hash:scryptSync("test-password",salt,64).toString("hex")}));vi.stubEnv("SJT_ADMIN_CONFIG_PATH",config);
      const token=login("test-password").token!;
      const asset=r.addAsset({id:"11111111-1111-4111-8111-111111111111",hash:"a".repeat(64),width:10,height:10,bytes:100,alt:"missing",createdAt:new Date().toISOString()});
      const saved=r.save(d.test.id,2,{...d.test.draft,coverAssetId:asset.id});
      const response=await releasePOST(new Request("http://localhost:3000/api/admin/tests/x/releases",{method:"POST",headers:{origin:"http://localhost:3000",cookie:`${cookieName}=${token}`,"content-type":"application/json"},body:JSON.stringify({revision:saved.test.revision})}),{params:Promise.resolve({id:d.test.id})});
      expect(response.status).toBe(409);expect(r.detail(d.test.id).releases).toHaveLength(0);
    }finally{r.close();}
  });
});

it("可按明确环境变量准备隔离浏览器验收数据库",async()=>{
  const dir=process.env.SJT_PHASE2_QA_DIR;if(!dir)return;
  const {r}=fixture(dir);try{
    const salt="local-qa-only",password="local-phase2-acceptance-only";
    writeFileSync(path.join(dir,"auth.json"),JSON.stringify({salt,hash:scryptSync(password,salt,64).toString("hex")}));
    const buffer=await sharp({create:{width:1600,height:900,channels:3,background:"#3e7795"}}).png().toBuffer();
    writeFileSync(path.join(dir,"upload-test.png"),buffer);
  }finally{r.close();}
});
