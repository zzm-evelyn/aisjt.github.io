import { withParticipants } from "@/lib/participant/http";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return withParticipants(request,async(r,token)=>r.content(token,(await context.params).id));}
