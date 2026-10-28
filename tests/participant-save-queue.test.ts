import { it,expect } from "vitest";
import { ParticipantSaveQueue } from "@/lib/participant/save-queue";
import type { AnswerInput,SaveResult } from "@/lib/participant/model";
function ok(a:AnswerInput):SaveResult{return {answer:{itemId:a.itemId,optionId:a.optionId,revision:a.expectedRevision+1,savedAt:"now"},acceptedRevision:a.expectedRevision+1,replayed:false,status:"in_progress"};}
it("串行保存同题快速改选，后一次使用已确认修订号",async()=>{
  let release!:()=>void;const sent:AnswerInput[]=[];
  const q=new ParticipantSaveQueue({answers:[],send:async a=>{sent.push({...a});if(sent.length===1)await new Promise<void>(resolve=>{release=resolve;});return ok(a);}});
  q.enqueue("i1","a");q.enqueue("i1","b");q.enqueue("i1","c");release();await q.flush();
  expect(sent.map(a=>a.optionId)).toEqual(["a","c"]);expect(sent.map(a=>a.expectedRevision)).toEqual([0,1]);expect(q.snapshot().pending).toHaveLength(0);
});
it("保存失败后重试保留请求ID，且未确认时flush不能成功",async()=>{
  const sent:AnswerInput[]=[];let fail=true;
  const q=new ParticipantSaveQueue({answers:[],send:async a=>{sent.push({...a});if(fail)throw new Error("offline");return ok(a);}});
  q.enqueue("i1","a");await expect(q.flush()).rejects.toThrow("offline");expect(q.snapshot().pending).toHaveLength(1);
  fail=false;await q.retry();expect(sent[1].requestId).toBe(sent[0].requestId);expect(q.snapshot().status).toBe("saved");
});
it("恢复暂存时使用原请求与修订，不能静默覆盖其他窗口",async()=>{
  let stored="";const store={load:()=>stored,save:(value:string)=>{stored=value;}};
  const q=new ParticipantSaveQueue({answers:[],store,send:async()=>{throw new Error("offline");}});q.enqueue("i1","a");await expect(q.flush()).rejects.toThrow();
  const restored=new ParticipantSaveQueue({answers:[{itemId:"i1",optionId:"b",revision:2,savedAt:"later"}],store,send:async a=>({answer:{itemId:"i1",optionId:"b",revision:2,savedAt:"later"},acceptedRevision:a.expectedRevision+1,replayed:true,status:"in_progress"})});
  await expect(restored.flush()).rejects.toThrow("其他窗口");expect(restored.snapshot().status).toBe("conflict");
});
it("选择使用服务端答案后移除冲突暂存",async()=>{
  const q=new ParticipantSaveQueue({answers:[],send:async()=>{throw Object.assign(new Error("conflict"),{status:409});}});q.enqueue("i1","a");await expect(q.flush()).rejects.toThrow();
  q.resolve("server",[{itemId:"i1",optionId:"b",revision:1,savedAt:"now"}]);await q.flush();expect(q.snapshot().pending).toHaveLength(0);expect(q.snapshot().answers[0].optionId).toBe("b");
});
it("用户明确保留本页选择后才能以新请求和最新修订重试",async()=>{
  let fail=true;const sent:AnswerInput[]=[];const q=new ParticipantSaveQueue({answers:[],send:async a=>{sent.push({...a});if(fail)throw Object.assign(new Error("conflict"),{status:409});return ok(a);}});
  q.enqueue("i1","a");await expect(q.flush()).rejects.toThrow();fail=false;q.resolve("mine",[{itemId:"i1",optionId:"b",revision:3,savedAt:"now"}]);await q.flush();expect(sent[1].expectedRevision).toBe(3);expect(sent[1].requestId).not.toBe(sent[0].requestId);
});
