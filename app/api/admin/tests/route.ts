import { withTests,readJson } from "@/lib/assessment/admin-http";
import { AssessmentError } from "@/lib/assessment/repository";
import { z } from "zod";
export const runtime="nodejs";
export async function GET(request:Request){return withTests(request,r=>({tests:r.list(),publications:r.publications()}));}
export async function POST(request:Request){return withTests(request,async r=>{
  const parsed=z.object({publicationId:z.string().min(1),title:z.string().trim().min(1).max(120)}).strict().safeParse(await readJson(request));
  if(!parsed.success)throw new AssessmentError("请选择材料并填写测验名称");
  return r.create(parsed.data.publicationId,parsed.data.title);
});}
