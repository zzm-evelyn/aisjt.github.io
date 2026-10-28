"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { adminJson,jsonBody } from "./api";
import type { TestDetail } from "@/lib/assessment/test-model";
import type { Availability } from "@/lib/participant/model";
type RecordSummary={id:string;participantCode:string;releaseNumber:number;status:string;answered:number;updatedAt:string;completedAt:string|null};
type Data={availability:Availability;records:RecordSummary[]};
export function ParticipationSettings({id,releases,disabled}:{id:string;releases:TestDetail["releases"];disabled:boolean}){
  const [data,setData]=useState<Data|null>(null),[selected,setSelected]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{adminJson<Data>(`/api/admin/tests/${id}/availability`).then(d=>{setData(d);setSelected(d.availability.releaseId??"");}).catch(e=>setError(e.message));},[id]);
  async function change(open:boolean){if(!data)return;setBusy(true);setError("");try{
    const releaseId=open?(selected||releases[0]?.id):data.availability.releaseId;if(!releaseId)return;
    const result=await adminJson<Data>(`/api/admin/tests/${id}/availability`,jsonBody("PUT",{revision:data.availability.revision,releaseId,acceptingNew:open}));setData(result);setSelected(result.availability.releaseId??"");
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="participation-settings"><h3>用户端入口</h3><p>开放后，用户可以在情景选择页开始作答。停止新作答后，已开始的用户仍可继续原版本。</p>{error&&<p className="v3-error" role="alert">{error}</p>}
    <p className="v3-tag">{data?.availability.acceptingNew?`已开放 V${releases.find(r=>r.id===data.availability.releaseId)?.number??""}`:"尚未开放新作答"}</p>
    <label>开放版本<select value={selected||releases[0]?.id||""} disabled={disabled||busy} onChange={e=>setSelected(e.target.value)}>{!releases.length&&<option value="">请先保存发布版本</option>}{releases.map(r=><option value={r.id} key={r.id}>V{r.number}</option>)}</select></label>
    <div className="v3-button-row"><button className="v3-primary" disabled={disabled||busy||!data||!releases.length} onClick={()=>change(true)}>开放所选版本</button><button className="v3-secondary" disabled={disabled||busy||!data?.availability.acceptingNew} onClick={()=>change(false)}>停止新作答</button>{data?.availability.acceptingNew&&<Link className="v3-secondary" href={`/test/${id}`} target="_blank" rel="noreferrer">打开用户端 ↗</Link>}</div>
    <h3>作答记录</h3><p>这里只显示正式用户端记录，后台预览不会计入。</p>{!data?<p>正在读取…</p>:!data.records.length?<p className="v3-muted">暂时没有正式作答记录。</p>:<div className="v3-table-scroll"><table><thead><tr><th>参与者编号</th><th>版本</th><th>状态</th><th>已保存题数</th><th>最近保存</th></tr></thead><tbody>{data.records.map(record=><tr key={record.id}><td>{record.participantCode}</td><td>V{record.releaseNumber}</td><td>{record.status==="submitted"?"已提交":"作答中"}</td><td>{record.answered}</td><td>{new Date(record.updatedAt).toLocaleString("zh-CN")}</td></tr>)}</tbody></table></div>}
    <button className="v3-secondary" disabled={busy} onClick={()=>{setError("");adminJson<Data>(`/api/admin/tests/${id}/availability`).then(setData).catch(e=>setError(e.message));}}>刷新作答记录</button>
  </div>;
}
