"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { participantJson,participantBody } from "@/components/participant/api";
import { participantLock } from "@/lib/participant/browser-lock";
import type { PublicCatalog,SessionView } from "@/lib/participant/model";
export default function TestCatalog(){
  const [catalog,setCatalog]=useState<PublicCatalog|null>(null),[sessions,setSessions]=useState<Omit<SessionView,"answers">[]>([]),[error,setError]=useState(""),[audience,setAudience]=useState(""),[context,setContext]=useState("");
  useEffect(()=>{Promise.all([participantJson<PublicCatalog>("/api/public/catalog"),participantLock("identity",()=>participantJson("/api/participant/identity",participantBody("POST",{}))).then(()=>participantJson<{sessions:Omit<SessionView,"answers">[]}>("/api/participant/sessions"))]).then(([c,s])=>{setCatalog(c);setSessions(s.sessions);}).catch(e=>setError(e.message));},[]);
  const audiences=[...new Map(catalog?.tests.map(t=>[t.audienceId,{id:t.audienceId,name:t.audience}])).values()];
  const contexts=[...new Map(catalog?.tests.filter(t=>t.audienceId===audience).map(t=>[t.contextId,{id:t.contextId,name:t.context}])).values()];
  const filtered=catalog?.tests.filter(t=>t.audienceId===audience&&(!context||t.contextId===context))??[];
  return <main className="participant-catalog"><header className="participant-brand">情景判断测验</header><section className="participant-intro"><p>从熟悉的身份出发</p><h1>走进情景，做出你的选择。</h1><div>选择适用的身份与情景，在故事中完成测验。</div></section>
    {error&&<div className="participant-notice" role="alert">{error} <button onClick={()=>location.reload()}>重新读取</button></div>}
    {sessions.length>0&&<section className="participant-panel"><h2>本浏览器中的作答</h2>{sessions.map(s=><article className="participant-resume" key={s.id}><div><strong>{s.title}</strong><p>编号 {s.participantCode} · {s.status==="submitted"?"已提交":`已保存 ${s.answered} / ${s.total} 题`}</p></div><Link className="participant-button secondary" href={`/test/session/${s.id}${s.status==="submitted"?"/complete":""}`}>{s.status==="submitted"?"查看完成状态":"继续作答"}</Link></article>)}</section>}
    <section className="participant-panel"><h2>选择身份与情景</h2>{!catalog&&!error?<p>正在读取可用测验…</p>:catalog?.tests.length===0?<p>目前暂无开放测验，请稍后再来。</p>:<><div className="participant-filter"><label>适用身份<select value={audience} onChange={e=>{setAudience(e.target.value);setContext("");}}><option value="">请选择你的适用身份</option>{audiences.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>情景<select value={context} disabled={!audience} onChange={e=>setContext(e.target.value)}><option value="">全部适用情景</option>{contexts.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label></div>
    {!audience?<p className="participant-muted">选择身份后，查看可以参加的情景测验。</p>:<div className="participant-card-grid">{filtered.map(t=><article className="participant-test-card" key={t.testId}><div className="participant-cover" style={t.coverAssetId?{backgroundImage:`linear-gradient(0deg,#0c2a4766,transparent),url(/api/public/assets/${t.coverAssetId})`}:{}}/><div><p className="participant-muted">{t.audience} · {t.context} · {t.itemCount} 题</p><h3>{t.title}</h3><p>{t.description}</p><Link className="participant-button" href={`/test/${t.testId}`}>进入此情景 →</Link></div></article>)}</div>}</> }</section><footer className="participant-muted">请按自己的真实倾向作答。完成后可确认提交。</footer>
  </main>;
}
