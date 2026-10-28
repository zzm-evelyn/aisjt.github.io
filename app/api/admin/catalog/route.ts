import { guard } from "@/lib/auth/session";
import { AssessmentRepository, AssessmentError } from "@/lib/assessment/repository";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const denied=guard(request);if(denied)return denied;
  const r=new AssessmentRepository();try{return Response.json(r.read(),{headers:{"Cache-Control":"no-store"}});}finally{r.close();}
}
export async function POST(request:Request) {
  const denied=guard(request);if(denied)return denied;
  if(Number(request.headers.get("content-length")??0)>32000)return Response.json({error:"请求过大"},{status:413});
  const r=new AssessmentRepository();try{return Response.json(r.execute(await request.json()));}catch(e){return Response.json({error:e instanceof AssessmentError?e.message:"保存失败"},{status:e instanceof AssessmentError?e.status:400});}finally{r.close();}
}
