import { NextResponse } from "next/server";
import { login,cookieName } from "@/lib/auth/session";
export const runtime="nodejs";
export async function POST(request:Request) {
  if(request.headers.get("origin")!==new URL(request.url).origin) return Response.json({error:"请求来源不匹配"},{status:403});
  try {
    if(Number(request.headers.get("content-length")??0)>8192) return Response.json({error:"请求过大"},{status:413});
    const body=await request.json();
    if(typeof body.password!=="string" || body.password.length<1 || body.password.length>256) return Response.json({error:"请输入有效密码"},{status:400});
    const result=login(body.password);
    if(!result.token) return Response.json({error:result.error},{status:result.status});
    const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
    response.cookies.set(cookieName,result.token,{httpOnly:true,sameSite:"strict",secure:new URL(request.url).protocol==="https:",path:"/",maxAge:8*3600});
    return response;
  } catch {return Response.json({error:"登录暂不可用，请检查本机账户配置"},{status:500});}
}
