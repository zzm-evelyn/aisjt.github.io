import { withParticipants } from "@/lib/participant/http";
import { readJson } from "@/lib/assessment/admin-http";
import { AssessmentError } from "@/lib/assessment/repository";
import { z } from "zod";
export const runtime="nodejs";
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){return withParticipants(request,async(r,token)=>{
 const parsed=z.object({index:z.number().int().nonnegative()}).strict().safeParse(await readJson(request));if(!parsed.success)throw new AssessmentError("题目位置不正确");return r.navigate(token,(await context.params).id,parsed.data.index);
});}
