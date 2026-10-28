"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { adminJson } from "./api";
import { AssessmentPlayer } from "./player";
import type { Presentation } from "@/lib/assessment/test-model";
export function TestPreview({id}:{id:string}) {
  const [data,setData]=useState<{version:number|null;presentation:Presentation}|null>(null),[error,setError]=useState("");
  useEffect(()=>{const release=new URLSearchParams(location.search).get("release");adminJson<{version:number|null;presentation:Presentation}>(`/api/admin/tests/${id}/preview`+(release?`?release=${encodeURIComponent(release)}`:"")).then(setData).catch(e=>setError(e.message));},[id]);
  return <><header className="assessment-preview-bar"><Link href={`/assessments/${id}`}>← 返回测验配置</Link><span>作答预览 · {data?.version?`发布版 V${data.version}`:"已保存配置"} · 不记录回答</span></header>{error?<main className="v3-main"><p className="v3-error" role="alert">{error}</p></main>:data?<AssessmentPlayer view={data.presentation}/>:<p className="v3-main">正在读取预览…</p>}</>;
}
