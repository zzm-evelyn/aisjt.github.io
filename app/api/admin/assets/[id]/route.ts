import { guard } from "@/lib/auth/session";
import { TestRepository } from "@/lib/assessment/test-repository";
import { AssessmentError } from "@/lib/assessment/repository";
import { readImage } from "@/lib/assessment/media";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  const denied=guard(request);if(denied)return denied;
  const r=new TestRepository();try{
    const asset=r.asset((await context.params).id);if(!asset)throw new AssessmentError("图片不存在",404);
    const bytes=await readImage(asset);
    return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":"inline"}});
  }catch(e){return Response.json({error:e instanceof AssessmentError?e.message:"图片读取失败"},{status:e instanceof AssessmentError?e.status:500});}finally{r.close();}
}
