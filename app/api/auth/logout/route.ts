import { NextResponse } from "next/server";
import { guard,logout,cookieName } from "@/lib/auth/session";
export const runtime="nodejs";
export async function POST(request:Request) {
  const denied=guard(request); if(denied) return denied;
  logout(request);
  const response=NextResponse.json({ok:true}); response.cookies.set(cookieName,"",{httpOnly:true,sameSite:"strict",path:"/",maxAge:0}); return response;
}
