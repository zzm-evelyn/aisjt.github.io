import { withParticipants } from "@/lib/participant/http";
import { readJson } from "@/lib/assessment/admin-http";
import { answerSchema } from "@/lib/participant/model";
import { AssessmentError } from "@/lib/assessment/repository";
export const runtime="nodejs";
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){return withParticipants(request,async(r,token)=>{
 const parsed=answerSchema.safeParse(await readJson(request));if(!parsed.success)throw new AssessmentError("回答格式不正确");return r.saveAnswer(token,(await context.params).id,parsed.data);
});}
