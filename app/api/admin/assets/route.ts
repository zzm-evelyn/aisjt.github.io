import { withTests,boundedBody } from "@/lib/assessment/admin-http";
import { AssessmentError } from "@/lib/assessment/repository";
import { storeImage } from "@/lib/assessment/media";
export const runtime="nodejs";
export async function GET(request:Request){return withTests(request,r=>r.assets());}
export async function POST(request:Request){return withTests(request,async r=>{
  const raw=await boundedBody(request,8_100_000);
  const data=await new Request(request.url,{method:"POST",headers:{"content-type":request.headers.get("content-type")??""},body:raw}).formData();
  const file=data.get("file"),alt=data.get("alt");
  if(!(file instanceof File))throw new AssessmentError("请选择图片文件");
  return storeImage(r,Buffer.from(await file.arrayBuffer()),typeof alt==="string"?alt:"");
});}
