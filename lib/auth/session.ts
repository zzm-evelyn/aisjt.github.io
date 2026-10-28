import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AssessmentRepository } from "@/lib/assessment/repository";

export const cookieName = "sjt_admin_session";
type Credentials = { salt: string; hash: string };
function credentials(): Credentials | null {
  try {
    const c = JSON.parse(readFileSync(/* turbopackIgnore: true */ process.env.SJT_ADMIN_CONFIG_PATH ?? path.join(process.cwd(),".local/admin-auth.json"),"utf8"));
    return typeof c.salt === "string" && /^[a-f0-9]{128}$/.test(c.hash) ? c : null;
  } catch { return null; }
}
export function authConfigured() { return credentials() !== null; }
function open() {
  const r = new AssessmentRepository();
  r.db.exec(`CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_login_attempts(id INTEGER PRIMARY KEY, at INTEGER NOT NULL);`);
  return r;
}
function digest(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function tokenFrom(request: Request) {
  return request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1) ?? "";
}
export function authenticated(request: Request) {
  const token=tokenFrom(request); if(!/^[a-f0-9]{64}$/.test(token) || !authConfigured()) return false;
  const r=open(); try {
    return !!r.db.prepare("SELECT 1 FROM admin_sessions WHERE token_hash=? AND expires>?").get(digest(token),Date.now());
  } finally {r.close();}
}
export function login(password: string) {
  const c=credentials(); if(!c) return {status:503, error:"请先在本机初始化管理员账户"};
  const r=open(); try {
    const now=Date.now();
    r.db.exec("BEGIN IMMEDIATE");
    r.db.prepare("DELETE FROM admin_login_attempts WHERE at<?").run(now-600_000);
    const count=(r.db.prepare("SELECT COUNT(*) AS n FROM admin_login_attempts").get() as {n:number}).n;
    if(count>=10) {r.db.exec("COMMIT"); return {status:429,error:"登录尝试较多，请十分钟后重试"};}
    r.db.prepare("INSERT INTO admin_login_attempts(at) VALUES(?)").run(now);
    r.db.exec("COMMIT");
    const actual=scryptSync(password,c.salt,64);
    if(!timingSafeEqual(actual,Buffer.from(c.hash,"hex"))) return {status:401,error:"密码不正确"};
    const token=randomBytes(32).toString("hex");
    r.db.prepare("DELETE FROM admin_sessions WHERE expires<=?").run(now);
    r.db.prepare("INSERT INTO admin_sessions VALUES(?,?)").run(digest(token),now+8*3600_000);
    return {status:200,token};
  } finally {r.close();}
}
export function logout(request: Request) {
  const r=open(); try {r.db.prepare("DELETE FROM admin_sessions WHERE token_hash=?").run(digest(tokenFrom(request)));} finally {r.close();}
}
export function guard(request: Request): Response | null {
  if(!authenticated(request)) return Response.json({error:"请先登录管理端"},{status:401,headers:{"Cache-Control":"no-store"}});
  if(!["GET","HEAD"].includes(request.method)) {
    const origin=request.headers.get("origin");
    if(!origin || origin!==new URL(request.url).origin) return Response.json({error:"请求来源不匹配"},{status:403});
  }
  return null;
}
