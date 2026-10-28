"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { participantJson,participantBody,ParticipantHttpError } from "./api";
import { participantLock } from "@/lib/participant/browser-lock";
import type { TestWelcome,SessionView } from "@/lib/participant/model";
export function ParticipantWelcome({id}:{id:string}){
  const router=useRouter(),[data,setData]=useState<TestWelcome|null>(null),[error,setError]=useState(""),[code,setCode]=useState(""),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[changed,setChanged]=useState(false);
  useEffect(()=>{participantJson<TestWelcome>(`/api/public/tests/${id}`).then(setData).catch(e=>setError(e.message));},[id]);
  async function begin(){if(!data)return;setBusy(true);setError("");try{
    await participantLock("identity",async()=>{
    await participantJson("/api/participant/identity",participantBody("POST",{}));
    const key=`sjt-participant-start:${id}:${data.test.releaseId}`;let requestId=crypto.randomUUID();
    try{const raw=localStorage.getItem(key);if(raw&&JSON.parse(raw).participantCode===code)requestId=JSON.parse(raw).requestId;else localStorage.setItem(key,JSON.stringify({requestId,participantCode:code}));}catch{}
    const session=await participantJson<SessionView>("/api/participant/sessions",participantBody("POST",{testId:id,expectedReleaseId:data.test.releaseId,requestId,participantCode:code,consent:true}));
    try{localStorage.removeItem(key);}catch{}router.push(`/test/session/${session.id}${session.status==="submitted"?"/complete":""}`);
    });
  }catch(e){setError((e as Error).message);if(e instanceof ParticipantHttpError&&e.status===409)setChanged(true);}finally{setBusy(false);}}
  const background=data?.test.coverAssetId?{backgroundImage:`linear-gradient(#0a1e378c,#0a1e378c),url(/api/public/assets/${data.test.coverAssetId})`}:{};
  return <div className="assessment-player participant-welcome" style={background}><header className="assessment-player-top"><Link href="/test">← 返回情景选择</Link><span>情景判断测验</span></header>{error&&<div className="participant-notice" role="alert">{error}{changed&&<button onClick={()=>location.reload()}>重新核对说明</button>}</div>}
  {!data?<p>正在读取测验说明…</p>:<section className="assessment-welcome"><p className="assessment-eyebrow">{data.test.audience} · {data.test.context} · {data.test.itemCount} 道题</p><h1>{data.test.title}</h1><p>{data.test.description}</p><div className="assessment-reading"><p className="v3-preserve-lines">{data.introduction}</p><h2>作答说明</h2><p className="v3-preserve-lines">{data.instruction}</p><h2>参与说明</h2><p className="v3-preserve-lines">{data.consent}</p><label className="participant-code">参与者编号（选填）<input maxLength={80} value={code} placeholder="留空将自动生成" onChange={e=>setCode(e.target.value)}/></label><label className="assessment-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>我已阅读参与说明，愿意参加</label><p className="participant-muted">开始后可在本浏览器继续未完成的作答。请保留本浏览器的站点数据。</p></div><button className="assessment-action" disabled={!consent||busy||changed} onClick={begin}>{busy?"正在准备…":"开始作答 →"}</button></section>}</div>;
}
