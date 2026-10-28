import { withParticipants } from "@/lib/participant/http";
import { readImage } from "@/lib/assessment/media";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return withParticipants(request,async r=>{
 const bytes=await readImage(r.publicCover((await context.params).id));return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"image/webp"}});
});}
