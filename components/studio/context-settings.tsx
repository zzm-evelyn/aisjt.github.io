"use client";
import * as React from "react";
import type { Catalog,Profile } from "@/lib/assessment/model";
export function ContextSettings() {
  const [data,setData]=React.useState<Catalog|null>(null),[error,setError]=React.useState(""),[busy,setBusy]=React.useState(false);
  const [editing,setEditing]=React.useState<Profile|null>(null),[kind,setKind]=React.useState<"audience"|"context">("audience"),[name,setName]=React.useState(""),[description,setDescription]=React.useState("");
  React.useEffect(()=>{fetch("/api/admin/catalog").then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error);setData(x);}).catch(e=>setError(e.message));},[]);
  async function act(body:unknown) {setBusy(true);setError("");try{const r=await fetch("/api/admin/catalog",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw new Error(x.error);setData(x);return true;}catch(e){setError(e instanceof Error?e.message:"保存失败");return false;}finally{setBusy(false);}}
  return <section className="v3-section"><h2>身份与情境</h2><p>先定义适用身份、情境及其对应关系。已有任务的冻结说明不随这里的修改而改变。</p>
    {error&&<p className="v3-error" role="alert">{error}</p>}
    <form onSubmit={async e=>{e.preventDefault();if(await act({action:"saveProfile",profile:{id:editing?.id,revision:editing?.revision,kind,name,description,enabled:editing?.enabled??true}})){setEditing(null);setName("");setDescription("");}}}>
      <div className="v3-form-grid"><label>配置类型<select value={kind} disabled={!!editing} onChange={e=>setKind(e.target.value as typeof kind)}><option value="audience">身份</option><option value="context">情境</option></select></label>
      <label>名称<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} /></label></div>
      <label>角色说明／环境要求<textarea maxLength={4000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} /></label>
      <button className="v3-primary" disabled={busy||!data}>{editing?"保存修改":"新增配置"}</button>{editing&&<button type="button" className="v3-secondary" onClick={()=>{setEditing(null);setName("");setDescription("");}}>取消修改</button>}
    </form>
    {(["audience","context"] as const).map(k=><div key={k}><h3>{k==="audience"?"身份列表":"情境列表"}</h3>{data?.profiles.filter(p=>p.kind===k).map(p=><article className="v3-resource" key={p.id}><strong>{p.name}</strong> · V{p.revision} · {p.enabled?"已启用":"已停用"}<p>{p.description||"尚未填写说明"}</p><button className="v3-secondary" disabled={busy} onClick={()=>{setEditing(p);setKind(p.kind);setName(p.name);setDescription(p.description);}}>编辑</button><button className="v3-secondary" disabled={busy} onClick={()=>act({action:"saveProfile",profile:{...p,enabled:!p.enabled}})}>{p.enabled?"停用":"启用"}</button></article>)}</div>)}
    <h3>适用关系</h3><p>勾选身份可以使用的情境。停用配置后不能用于新任务，历史引用保留。</p>
    {data?.profiles.filter(p=>p.kind==="audience").map(a=><div className="v3-resource" key={a.id}><strong>{a.name}</strong>{data.profiles.filter(p=>p.kind==="context").map(c=><label className="v3-check" key={c.id}><input type="checkbox" disabled={busy||!a.enabled||!c.enabled} checked={data.links.some(l=>l.audienceId===a.id&&l.contextId===c.id)} onChange={e=>act({action:"setLink",audienceId:a.id,contextId:c.id,enabled:e.target.checked})}/>{c.name}</label>)}</div>)}
    {!data?.profiles.length&&<p className="v3-muted">尚未配置。可以先新增身份和情境，再设置适用关系。</p>}
  </section>;
}
