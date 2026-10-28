import { AssessmentError } from "@/lib/assessment/repository";
import { guard } from "@/lib/auth/session";
import { getRepository } from "@/lib/studio/repository";
import { actionSchema, StudioError } from "@/lib/studio/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = guard(request); if (denied) return denied;
  try {
    return Response.json(getRepository().read(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "数据读取失败，请检查服务器存储" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  const denied = guard(request); if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "不允许跨站写入" }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 8_000_000)
    return Response.json({ error: "请求过大" }, { status: 413 });
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error: parsed.error.issues
            .map((i) => `${i.path.join(".")}：${i.message}`)
            .join("；"),
        },
        { status: 400 },
      );
    return Response.json(getRepository().execute(parsed.data));
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof StudioError || e instanceof AssessmentError
            ? e.message
            : "操作失败，未写入数据库，请检查后重试",
      },
      { status: e instanceof StudioError || e instanceof AssessmentError ? e.status : 500 },
    );
  }
}
