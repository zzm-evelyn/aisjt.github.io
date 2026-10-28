"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shell,ErrorBox } from "@/components/studio/shell";
import { adminJson,jsonBody } from "@/components/assessment/api";
import type { TestDetail } from "@/lib/assessment/test-model";
type Source={id:string;title:string;itemCount:number};
export default function NewAssessment(){
  const router=useRouter(),[sources,setSources]=useState<Source[]|null>(null),[source,setSource]=useState(""),[title,setTitle]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{adminJson<{publications:Source[]}>("/api/admin/tests").then(x=>{setSources(x.publications);const requested=new URLSearchParams(location.search).get("publication");if(requested&&x.publications.some(p=>p.id===requested)){setSource(requested);setTitle(x.publications.find(p=>p.id===requested)!.title);}}).catch(e=>setError(e.message));},[]);
  return <Shell><Link href="/assessments">← 测验管理</Link><div className="v3-top"><div><p className="v3-kicker">创建测验</p><h1>选择已入库材料</h1><p>原材料保持不变，测验使用独立的配置与发布版本。</p></div></div><ErrorBox message={error}/><section className="v3-section"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const detail=await adminJson<TestDetail>("/api/admin/tests",jsonBody("POST",{publicationId:source,title}));router.push(`/assessments/${detail.test.id}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
    <label>材料包<select value={source} required onChange={e=>{setSource(e.target.value);if(!title)setTitle(sources?.find(s=>s.id===e.target.value)?.title??"");}}><option value="">请选择已入库材料</option>{sources?.map(s=><option key={s.id} value={s.id}>{s.title} · {s.itemCount} 题</option>)}</select></label>
    {sources?.length===0&&<p>尚无已入库材料，请先在现有生成流程完成入库。</p>}
    <label>测验名称<input value={title} required maxLength={120} onChange={e=>setTitle(e.target.value)}/></label><button className="v3-primary" disabled={busy||!source||!title.trim()}>{busy?"正在创建…":"创建并配置"}</button>
  </form></section></Shell>;
}
