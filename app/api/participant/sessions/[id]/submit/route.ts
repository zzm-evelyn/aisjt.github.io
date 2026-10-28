import { withParticipants } from "@/lib/participant/http";
import { readJson } from "@/lib/assessment/admin-http";
import { AssessmentError } from "@/lib/assessment/repository";
import { z } from "zod";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return withParticipants(request,async(r,token)=>{
 const parsed=z.object({requestId:z.string().uuid()}).strict().safeParse(await readJson(request));if(!parsed.success)throw new AssessmentError("提交格式不正确");return r.submit(token,(await context.params).id,parsed.data.requestId);
});}
