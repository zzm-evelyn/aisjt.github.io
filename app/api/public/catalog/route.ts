import { withParticipants } from "@/lib/participant/http";
export const runtime="nodejs";
export async function GET(request:Request){return withParticipants(request,r=>r.catalog());}
