import { withParticipants } from "@/lib/participant/http";
import { readJson } from "@/lib/assessment/admin-http";
import { startSchema } from "@/lib/participant/model";
import { AssessmentError } from "@/lib/assessment/repository";
export const runtime="nodejs";
export async function GET(request:Request){return withParticipants(request,(r,token)=>({sessions:token?r.listSessions(token):[]}));}
export async function POST(request:Request){return withParticipants(request,async(r,token)=>{
 const parsed=startSchema.safeParse(await readJson(request));if(!parsed.success)throw new AssessmentError("请核对说明并同意后开始");return r.start(token,parsed.data);
});}
