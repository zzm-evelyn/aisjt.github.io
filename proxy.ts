import { NextResponse, type NextRequest } from "next/server";
import { authenticated } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const p=request.nextUrl.pathname;
  if(p==="/admin/login" || p.startsWith("/api/auth/") || p==="/test" || p.startsWith("/test/") || p.startsWith("/api/public/") || p.startsWith("/api/participant/")) return NextResponse.next();
  if(authenticated(request)) return NextResponse.next();
  if(p.startsWith("/api/")) return NextResponse.json({error:"请先登录管理端"},{status:401,headers:{"Cache-Control":"no-store"}});
  const url=new URL("/admin/login",request.url);
  url.searchParams.set("next",p+request.nextUrl.search);
  return NextResponse.redirect(url);
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp|css|js)$).*)"]};
