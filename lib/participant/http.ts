import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/session";
import { AssessmentError } from "@/lib/assessment/repository";
import { ParticipantRepository } from "./repository";
import { browserCookie,retentionSeconds } from "./model";
export function participantToken(request:Request){return request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith(browserCookie+"="))?.slice(browserCookie.length+1)??"";}
export function browserResponse(request:Request,token:string){const response=NextResponse.json({ok:true});response.cookies.set(browserCookie,token,{httpOnly:true,sameSite:"strict",secure:new URL(request.url).protocol==="https:",path:"/",maxAge:retentionSeconds});return response;}
export async function withParticipants(request:Request,operation:(repository:ParticipantRepository,token:string)=>unknown|Promise<unknown>,admin=false){
  if(admin){const denied=guard(request);if(denied)return denied;}
  if(!["GET","HEAD"].includes(request.method)&&request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"请求来源不匹配"},{status:403});
  let repository:ParticipantRepository|undefined;
  try{
    repository=new ParticipantRepository();const value=await operation(repository,participantToken(request));
    const response=value instanceof Response?value:Response.json(value);response.headers.set("Cache-Control","private, no-store");response.headers.set("X-Content-Type-Options","nosniff");return response;
  }catch(e){return Response.json({error:e instanceof AssessmentError?e.message:"暂时无法保存或读取，请稍后重试"},{status:e instanceof AssessmentError?e.status:500,headers:{"Cache-Control":"no-store"}});}finally{repository?.close();}
}
