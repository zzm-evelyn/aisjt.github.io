import { guard } from "@/lib/auth/session";
import { getRepository } from "@/lib/studio/repository";
import { adaptPublication } from "@/lib/assessment/material";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const denied=guard(request);if(denied)return denied;
  const {id}=await context.params;
  const publication=getRepository().read().publications.find(p=>p.id===id);
  if(!publication)return Response.json({error:"已入库材料不存在"},{status:404});
  try{return Response.json(adaptPublication(publication),{headers:{"Cache-Control":"no-store"}});}catch(e){return Response.json({error:e instanceof Error?e.message:"材料校验失败"},{status:409});}
}
