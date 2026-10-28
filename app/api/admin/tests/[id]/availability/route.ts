import { withParticipants } from "@/lib/participant/http";
import { readJson } from "@/lib/assessment/admin-http";
import { AssessmentError } from "@/lib/assessment/repository";
import { z } from "zod";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return withParticipants(request,async r=>{const {id}=await context.params;return {availability:r.availability(id),records:r.records(id)};},true);}
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){return withParticipants(request,async r=>{
 const parsed=z.object({revision:z.number().int().nonnegative(),releaseId:z.string().uuid(),acceptingNew:z.boolean()}).strict().safeParse(await readJson(request));if(!parsed.success)throw new AssessmentError("开放设置格式不正确");const {id}=await context.params;
 return {availability:r.setAvailability(id,parsed.data.revision,parsed.data.releaseId,parsed.data.acceptingNew),records:r.records(id)};
},true);}
