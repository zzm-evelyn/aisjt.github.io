"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { participantJson } from "./api";
import type { SessionView } from "@/lib/participant/model";
export function ParticipantComplete({id}:{id:string}){
  const [session,setSession]=useState<SessionView|null>(null),[error,setError]=useState("");
  useEffect(()=>{participantJson<SessionView>(`/api/participant/sessions/${id}`).then(setSession).catch(e=>setError(e.message));},[id]);
  return <main className="assessment-player"><header className="assessment-player-top"><Link href="/test">情景判断测验</Link></header><section className="assessment-welcome">{error?<div className="participant-notice" role="alert">{error}</div>:!session?<p>正在确认提交状态…</p>:session.status!=="submitted"?<><h1>本次作答尚未提交</h1><Link className="participant-button" href={`/test/session/${id}`}>继续作答</Link></>:<><p className="assessment-eyebrow">感谢参与</p><h1>提交成功</h1><div className="assessment-reading"><h2>{session.title}</h2><p>参与者编号：{session.participantCode}</p><p>已提交 {session.answered} 道题。</p><p>提交时间：{session.completedAt?new Date(session.completedAt).toLocaleString("zh-CN"):""}</p><p>本次回答已保存，你可以关闭此页面。</p></div><Link className="participant-button" href="/test">返回情景选择</Link></>}</section></main>;
}
