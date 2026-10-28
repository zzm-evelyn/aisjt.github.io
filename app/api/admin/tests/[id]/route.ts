import { withTests,readJson } from "@/lib/assessment/admin-http";
import { AssessmentError } from "@/lib/assessment/repository";
import { testDraftSchema } from "@/lib/assessment/test-model";
import { z } from "zod";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){return withTests(request,async r=>r.detail((await context.params).id));}
export async function PUT(request:Request,context:Context){return withTests(request,async r=>{
  const parsed=z.object({revision:z.number().int().positive(),draft:testDraftSchema}).strict().safeParse(await readJson(request));
  if(!parsed.success)throw new AssessmentError("配置格式不正确，请核对名称、章节和图片设置");
  return r.save((await context.params).id,parsed.data.revision,parsed.data.draft);
});}
