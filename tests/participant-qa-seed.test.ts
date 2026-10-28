// @vitest-environment node
import { it,expect } from "vitest";
import { mkdirSync,readFileSync,writeFileSync } from "node:fs";
import path from "node:path";
import { StudioRepository } from "@/lib/studio/repository";
import { ParticipantRepository } from "@/lib/participant/repository";
import { storeImage } from "@/lib/assessment/media";
it("仅显式指定隔离目录时准备浏览器验收数据",async()=>{
 const dir=process.env.SJT_PARTICIPANT_QA_DIR;if(!dir){expect(true).toBe(true);return;}
 if(!dir.includes("phase3-qa-"))throw new Error("必须使用独立验收目录");
 mkdirSync(dir,{recursive:true});const file=path.join(dir,"studio.sqlite");process.env.SJT_ASSET_DIR=path.join(dir,"assets");
 const studio=new StudioRepository(file),task=studio.execute({action:"openCase"}).resultId,pub=studio.execute({action:"publish",id:task,revision:1}).resultId;studio.close();
 const r=new ParticipantRepository(file);try{
 r.execute({action:"saveProfile",profile:{kind:"audience",name:"大学生",description:"隔离验收身份",enabled:true}});
 const {profiles}=r.execute({action:"saveProfile",profile:{kind:"context",name:"大学学习",description:"隔离验收情景",enabled:true}}),[a,c]=profiles;
 r.execute({action:"setLink",audienceId:a.id,contextId:c.id,enabled:true});
 const asset=await storeImage(r,readFileSync("C:/Users/lenovo/Desktop/问卷平台设计/frontend/assets/images/大学背景.png"),"校园背景");
 const created=r.create(pub,"校园故事 · 正式流程验收"),draft=created.test.draft;
 const saved=r.save(created.test.id,1,{...draft,description:"独立验收测验，不属于正式研究数据。",consent:"本测验仅用于平台功能验收，不收集正式研究数据。",selection:{audienceId:a.id,contextId:c.id,audienceRevision:1,contextRevision:1},coverAssetId:asset.id,chapters:draft.chapters.map(c=>({...c,backgroundAssetId:asset.id}))});
 const release=r.publish(saved.test.id,saved.test.revision);r.setAvailability(saved.test.id,0,release.id,true);writeFileSync(path.join(dir,"fixture.json"),JSON.stringify({testId:saved.test.id,releaseId:release.id}));
 }finally{r.close();}
});
