"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { playerSteps,type Presentation } from "@/lib/assessment/test-model";
import { ParticipantSaveQueue } from "@/lib/participant/save-queue";
import { participantLock } from "@/lib/participant/browser-lock";
import type { SessionView,SaveResult } from "@/lib/participant/model";
import { participantJson,participantBody } from "./api";
type QueueSnapshot=ReturnType<ParticipantSaveQueue["snapshot"]>;
export function ParticipantAnswerPage({id}:{id:string}){
  const router=useRouter(),[session,setSession]=React.useState<SessionView|null>(null),[view,setView]=React.useState<Presentation|null>(null),[index,setIndex]=React.useState(0),[snapshot,setSnapshot]=React.useState<QueueSnapshot|null>(null),[error,setError]=React.useState(""),[busy,setBusy]=React.useState(false),[review,setReview]=React.useState(false);
  const queue=React.useRef<ParticipantSaveQueue|null>(null),storageKey=React.useRef("");
  React.useEffect(()=>{
    let active=true;let q:ParticipantSaveQueue|undefined;
    const controller=new AbortController();let release=()=>{};
    void participantLock(`session:${id}`,async()=>{
    if(!active)return;setError("");
    await Promise.all([participantJson<SessionView>(`/api/participant/sessions/${id}`),participantJson<Presentation>(`/api/participant/sessions/${id}/content`)]).then(([s,v])=>{
      if(!active)return;if(s.status==="submitted"){router.replace(`/test/session/${id}/complete`);return;}
      setSession(s);setView(v);setIndex(s.currentIndex);const key=`sjt-participant-outbox:${s.id}:${s.releaseId}`;storageKey.current=key;
      q=new ParticipantSaveQueue({answers:s.answers,store:{load:()=>localStorage.getItem(key),save:value=>localStorage.setItem(key,value)},send:a=>participantJson<SaveResult>(`/api/participant/sessions/${id}/responses`,participantBody("PUT",a)),onChange:()=>{if(active&&q)setSnapshot(q.snapshot());}});
      queue.current=q;setSnapshot(q.snapshot());void q.flush().catch(()=>{});
    }).catch(e=>{if(active)setError(e.message);});
    if(active)await new Promise<void>(resolve=>{release=resolve;});
    },controller.signal).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;controller.abort();q?.destroy();if(q)void q.flush().catch(()=>{}).finally(()=>release());else release();queue.current=null;};
  },[id,router]);
  React.useEffect(()=>{const stop=(e:BeforeUnloadEvent)=>{if(queue.current?.snapshot().pending.length){e.preventDefault();}};const online=()=>{const q=queue.current;if(q&&q.snapshot().status==="error")void q.retry().catch(()=>{});};window.addEventListener("beforeunload",stop);window.addEventListener("online",online);return()=>{window.removeEventListener("beforeunload",stop);window.removeEventListener("online",online);};},[]);
  const steps=React.useMemo(()=>view?playerSteps(view):[],[view]),step=steps[index];
  async function move(next:number){if(!queue.current)return;setBusy(true);setError("");try{await queue.current.flush();const s=await participantJson<SessionView>(`/api/participant/sessions/${id}/position`,participantBody("PUT",{index:next}));queue.current.resolve("server",s.answers);setSession(s);setIndex(s.currentIndex);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function resolve(choice:"server"|"mine"){
    if(!queue.current)return;setBusy(true);setError("");try{const s=await participantJson<SessionView>(`/api/participant/sessions/${id}`);if(s.status==="submitted"){router.replace(`/test/session/${id}/complete`);return;}queue.current.resolve(choice,s.answers);setSession(s);await queue.current.flush();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function prepareSubmit(){setBusy(true);setError("");try{await queue.current?.flush();setReview(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function submit(){setBusy(true);setError("");try{
    await queue.current?.flush();let requestId=crypto.randomUUID();const key=storageKey.current+":submit";try{const old=localStorage.getItem(key);if(old)requestId=old;else localStorage.setItem(key,requestId);}catch{}
    const s=await participantJson<SessionView>(`/api/participant/sessions/${id}/submit`,participantBody("POST",{requestId}));if(s.status!=="submitted")throw new Error("提交尚未确认，请重试");
    try{localStorage.removeItem(storageKey.current);localStorage.removeItem(key);}catch{}router.replace(`/test/session/${id}/complete`);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const selected=step?(snapshot?.pending.filter(p=>p.itemId===step.item.itemId).at(-1)?.optionId??snapshot?.answers.find(a=>a.itemId===step.item.itemId)?.optionId):undefined;
  const saved=snapshot?.answers.length??0,status=snapshot?.status;
  const background=step?.chapter.backgroundAssetId?{backgroundImage:`linear-gradient(rgba(10,30,55,${step.chapter.overlay}),rgba(10,30,55,${step.chapter.overlay})),url(/api/participant/sessions/${id}/assets/${step.chapter.backgroundAssetId})`,backgroundPosition:step.chapter.position}:{};
  return <div className="assessment-player participant-answer" style={background}><header className="assessment-player-top"><Link href="/test" onClick={e=>{if(snapshot?.pending.length&&!window.confirm("还有回答未同步，暂时离开后请用本浏览器继续。确定离开？"))e.preventDefault();}}>← 情景选择</Link><span>{session?`编号 ${session.participantCode}`:"情景判断测验"}</span></header>
    {error&&<div className="participant-notice" role="alert">{error} <button onClick={()=>location.reload()}>重新读取</button></div>}
    {!view||!session||!snapshot?<p>正在恢复本次作答；若另一窗口正在作答，请先关闭那个窗口。</p>:<>
    {snapshot.recoveryWarning&&<div className="participant-notice" role="alert">{snapshot.recoveryWarning}</div>}
    <div className={`participant-save-status ${status==="saved"?"saved":""}`} role="status">{status==="saved"?"已保存":status==="saving"?"正在保存…":status==="conflict"?"回答有更新，请核对":status==="error"?"尚未同步，请重试":"正在恢复未同步回答…"}</div>
    {(status==="error"||status==="conflict")&&<div className="participant-notice" role="alert"><p>{snapshot.error}</p>{status==="conflict"?<div><button disabled={busy} onClick={()=>resolve("server")}>使用已保存答案</button> <button disabled={busy} onClick={()=>resolve("mine")}>保留本页选择并重新保存</button></div>:<button disabled={busy} onClick={()=>{setError("");void queue.current?.retry().catch(()=>{});}}>重试保存</button>}</div>}
    {review?<section className="assessment-welcome"><h1>确认提交</h1><div className="assessment-reading"><p>已保存 {saved} / {steps.length} 道题。</p><p>提交后，本次回答将固定保存，不能再修改。</p><p>请确认这是你希望提交的选择。</p></div><button className="assessment-action" disabled={busy||saved!==steps.length||snapshot.pending.length>0} onClick={submit}>{busy?"正在确认提交…":"确认提交"}</button> <button className="participant-light-button" disabled={busy} onClick={()=>setReview(false)}>返回作答</button></section>:step&&<main className="assessment-session"><div className="assessment-progress"><div><span>{step.chapter.title}</span><span>已保存 {saved} / {steps.length}</span></div><progress max={steps.length} value={saved} aria-label="作答进度"/></div>
      <section className="assessment-question-card"><p className="assessment-eyebrow">{view.title} · 第 {index+1} 题</p><h1>{step.chapter.title}</h1><div className="assessment-story v3-preserve-lines">{step.story}</div>
      {index>0&&<details className="assessment-history"><summary>回顾前文</summary>{[...new Set(steps.slice(0,index).map(s=>s.eventId))].filter(eventId=>eventId!==step.eventId).map(eventId=><p key={eventId} className="v3-preserve-lines">{view.content.story.segments.filter(s=>s.eventId===eventId).map(s=>s.text).join("\n\n")}</p>)}</details>}
      <h2 className="assessment-question">{step.item.stem}</h2><div className="assessment-options" role="group" aria-label="请选择最符合你的行为">{step.item.options.map((option,i)=><button key={option.optionId} aria-label={`${String.fromCharCode(65+i)} ${option.text}`} aria-pressed={selected===option.optionId} disabled={busy||status==="conflict"||status==="error"} onClick={()=>{setError("");queue.current?.enqueue(step.item.itemId,option.optionId);}}><span>{String.fromCharCode(65+i)}</span><span>{option.text}</span></button>)}</div>
      <div className="assessment-step-actions">{view.rules.allowBack&&<button disabled={busy||index===0} onClick={()=>move(index-1)}>上一题</button>}<button className="assessment-action" disabled={!selected||busy||status==="conflict"||status==="error"} onClick={()=>index===steps.length-1?prepareSubmit():move(index+1)}>{busy?"正在保存…":index===steps.length-1?"检查并提交":"下一题 →"}</button></div></section></main>}
    </>}
  </div>;
}
