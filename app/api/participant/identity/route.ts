import { withParticipants,browserResponse } from "@/lib/participant/http";
export const runtime="nodejs";
export async function POST(request:Request){return withParticipants(request,(r,token)=>browserResponse(request,r.issueBrowser(token)));}
