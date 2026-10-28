"use client";
import * as React from "react";
import type { Catalog } from "@/lib/assessment/model";
import type { z } from "zod";
import type { selectionSchema } from "@/lib/assessment/model";
export type ContextSelection=z.infer<typeof selectionSchema>;
export function ContextPicker({value,onChange}:{value?:ContextSelection;onChange:(value:ContextSelection|undefined,name?:string)=>void}) {
  const [data,setData]=React.useState<Catalog|null>(null),[audience,setAudience]=React.useState(value?.audienceId??""),[error,setError]=React.useState("");
  React.useEffect(()=>{fetch("/api/admin/catalog").then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error);setData(x);}).catch(e=>setError(e.message));},[]);
  return <div className="v3-resource"><h3>关联身份与情境（选填）</h3><p>选中后，角色说明与环境要求会随任务输入一起冻结。</p>{error&&<p role="alert" className="v3-error">{error}</p>}<div className="v3-form-grid"><label>适用身份<select value={audience} onChange={e=>{setAudience(e.target.value);onChange(undefined);}}><option value="">暂不关联</option>{data?.profiles.filter(p=>p.kind==="audience"&&p.enabled).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>关联情境<select key={audience} disabled={!audience} value={value?.contextId??""} onChange={e=>{const a=data?.profiles.find(p=>p.id===audience),c=data?.profiles.find(p=>p.id===e.target.value);if(a&&c)onChange({audienceId:a.id,contextId:c.id,audienceRevision:a.revision,contextRevision:c.revision},c.name);else onChange(undefined);}}><option value="">请选择情境</option>{data?.profiles.filter(p=>p.kind==="context"&&p.enabled&&data.links.some(l=>l.audienceId===audience&&l.contextId===p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div></div>;
}
