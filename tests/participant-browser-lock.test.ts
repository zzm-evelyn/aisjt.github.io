import { it,expect,vi } from "vitest";
import { participantLock } from "@/lib/participant/browser-lock";
it("同浏览器身份初始化与会话开始串行执行，迟到初始化不能替换已使用凭据",async()=>{
 const tails=new Map<string,Promise<unknown>>();
 vi.stubGlobal("navigator",{locks:{request:(name:string,_options:unknown,work:()=>Promise<unknown>)=>{const next=(tails.get(name)??Promise.resolve()).then(work);tails.set(name,next.catch(()=>{}));return next;}}});
 try{const events:string[]=[];let release!:()=>void;
 const a=participantLock("identity",async()=>{events.push("identity A");await new Promise<void>(r=>{release=r;});events.push("start A");});
 await Promise.resolve();const b=participantLock("identity",async()=>{events.push("reuse A");events.push("start B");});
 await Promise.resolve();expect(events).toEqual(["identity A"]);release();await Promise.all([a,b]);expect(events).toEqual(["identity A","start A","reuse A","start B"]);
 }finally{vi.unstubAllGlobals();}
});
it("浏览器不支持跨窗口锁时明确失败，不能冒险创建另一凭据",async()=>{
 vi.stubGlobal("navigator",{});try{await expect(participantLock("identity",async()=>true)).rejects.toThrow("当前浏览器");}finally{vi.unstubAllGlobals();}
});
