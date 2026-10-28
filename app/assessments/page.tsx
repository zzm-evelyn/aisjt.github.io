"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { Shell,ErrorBox } from "@/components/studio/shell";
import { adminJson } from "@/components/assessment/api";
type Summary={id:string;title:string;description:string;revision:number;releases:number;updatedAt:string};
export default function Assessments(){
  const [tests,setTests]=useState<Summary[]|null>(null),[error,setError]=useState("");
  useEffect(()=>{adminJson<{tests:Summary[]}>("/api/admin/tests").then(x=>setTests(x.tests)).catch(e=>setError(e.message));},[]);
  return <Shell><div className="v3-top"><div><p className="v3-kicker">测验管理</p><h1>把研究材料变成作答体验</h1><p>配置身份、章节与画面，保存可追溯的测验发布版本。</p></div><Link className="v3-primary" href="/assessments/new">创建测验</Link></div><ErrorBox message={error}/>
  {!tests?<p>正在读取测验…</p>:!tests.length?<section className="v3-section"><h2>从已入库材料开始</h2><p>选择一套材料，配置作答说明、章节和背景图片，再预览并发布。</p><Link className="v3-secondary" href="/assessments/new">选择材料</Link></section>:tests.map(t=><article className="v3-section" key={t.id}><div className="v3-section-title"><div><h2>{t.title}</h2><p>{t.description||"尚未填写测验简介"}</p></div><span className="v3-tag">{t.releases?`${t.releases} 个发布版本`:"配置中"}</span></div><p className="v3-muted">最近保存：{new Date(t.updatedAt).toLocaleString("zh-CN")}</p><Link className="v3-primary" href={`/assessments/${t.id}`}>配置测验</Link> <Link className="v3-secondary" href={`/assessments/${t.id}/preview`}>作答预览</Link></article>)}
  </Shell>;
}
