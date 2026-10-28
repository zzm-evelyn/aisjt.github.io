import { guard } from "@/lib/auth/session";
import scenarios from "@/data/runs/university-single-scenarios.json";
export const runtime="nodejs";
export async function GET(request:Request) {
  const denied=guard(request);if(denied)return denied;
  return Response.json(scenarios,{headers:{"Cache-Control":"no-store"}});
}
