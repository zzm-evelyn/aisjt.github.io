import { withParticipants } from "@/lib/participant/http";
import { readImage } from "@/lib/assessment/media";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string;assetId:string}>}){return withParticipants(request,async(r,token)=>{
 const {id,assetId}=await context.params;const bytes=await readImage(r.sessionAsset(token,id,assetId));return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"image/webp"}});
});}
