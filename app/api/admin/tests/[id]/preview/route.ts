import { withTests } from "@/lib/assessment/admin-http";
import { presentation } from "@/lib/assessment/test-model";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return withTests(request,async r=>{
  const {id}=await context.params,releaseId=new URL(request.url).searchParams.get("release");
  if(releaseId){const release=r.getRelease(releaseId,id);return {version:release.number,presentation:presentation(release.payload.draft,release.payload.content,release.payload.contextSnapshot)};}
  const detail=r.detail(id),draft=detail.test.draft;
  return {version:null,presentation:presentation(draft,detail.material.content,draft.selection?r.snapshot(draft.selection):undefined)};
});}
