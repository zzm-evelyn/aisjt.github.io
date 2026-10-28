"use client";
import { useState } from "react";
export default function LoginPage() {
  const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  return <main className="v3-main" style={{maxWidth:520,margin:"60px auto",width:"100%"}}><section className="v3-section">
    <p className="v3-kicker">管理端</p><h1>情景判断测验生成平台</h1><p>登录后管理研究输入、生成任务与测验材料。</p>
    <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{
      const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});const data=await r.json();if(!r.ok)throw new Error(data.error);
      const next=new URLSearchParams(location.search).get("next")??"/";
      location.assign(next.startsWith("/")&&!next.startsWith("//")&&!next.includes("\\")?next:"/");
    }catch(e){setError(e instanceof Error?e.message:"登录失败");}finally{setBusy(false);}}}>
    <label>管理员密码<input type="password" autoComplete="current-password" value={password} maxLength={256} onChange={e=>setPassword(e.target.value)} required /></label>
    {error&&<p className="v3-error" role="alert">{error}</p>}
    <button className="v3-primary" disabled={busy}>{busy?"正在登录…":"登录"}</button></form>
    <p className="v3-muted">首次使用请在本机运行 npm run admin:init。账户凭据仅保存在本机。</p>
  </section></main>;
}
