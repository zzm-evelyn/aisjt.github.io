import { withTests,readJson } from "@/lib/assessment/admin-http";
import { AssessmentError } from "@/lib/assessment/repository";
import { readImage } from "@/lib/assessment/media";
import { z } from "zod";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return withTests(request,async r=>{
  const parsed=z.object({revision:z.number().int().positive()}).strict().safeParse(await readJson(request));
  if(!parsed.success)throw new AssessmentError("请先保存最新配置");
  const {id}=await context.params;
  const existing=r.releaseForRevision(id,parsed.data.revision);if(existing)return existing;
  const detail=r.detail(id),draft=detail.test.draft;
  const ids=[...new Set([draft.coverAssetId,...draft.chapters.map(c=>c.backgroundAssetId)].filter((x):x is string=>!!x))];
  for(const assetId of ids){const asset=r.asset(assetId);if(!asset)throw new AssessmentError("图片不存在",409);await readImage(asset);}
  return r.publish(id,parsed.data.revision);
});}
