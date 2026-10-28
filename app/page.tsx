"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpRight, Files, ChevronRight } from "lucide-react";
import { Shell, ErrorBox } from "@/components/studio/shell";
import { useStudio, safeAction } from "@/components/studio/use-studio";
export default function TaskCenter() {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importError, setImportError] = React.useState("");
  const { data, error, busy, act } = useStudio();
  const open = () =>
    safeAction(
      act({ action: "openCase" }).then((x) => {
        router.push("/workspace?task=" + x.resultId);
      }),
    );
  const tasks = data?.tasks ?? [];
  const attention = tasks.filter(
    (t) => t.status === "needs_review" || t.status === "draft",
  );
  return (
    <Shell>
      <div className="v3-top">
        <div>
          <p className="v3-kicker">研究工作空间</p>
          <h1>任务中心</h1>
          <p>从一组条目开始，持续开发可追溯的情景测验。</p>
        </div>
        <Link className="v3-primary" href="/tasks/new">
          <Plus size={17} />
          新建任务
        </Link>
      </div>
      <ErrorBox message={error || importError} />
      <input
        type="file"
        accept=".json"
        ref={fileRef}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 5000000) throw new Error("文件超过 5MB");
            const r = await act({
              action: "importCase",
              payload: JSON.parse(await file.text()),
            });
            router.push("/workspace?task=" + r.resultId);
          } catch (e) {
            setImportError(e instanceof Error ? e.message : String(e));
          }
        }}
      />
      <div className="v3-summary">
        <div>
          <strong>{attention.length}</strong>
          <span>需要处理</span>
        </div>
        <div>
          <strong>{tasks.length}</strong>
          <span>开发任务</span>
        </div>
        <div>
          <strong>{data?.publications.length ?? 0}</strong>
          <span>已入库版本</span>
        </div>
      </div>
      <section className="v3-section">
        <div className="v3-section-title">
          <h2>需要你处理</h2>
          <span>按任务保存状态继续</span>
        </div>
        {!data ? (
          <p className="v3-empty">正在读取任务…</p>
        ) : !attention.length ? (
          <div className="v3-empty">
            暂无待处理事项。你可以创建任务，或打开已有案例查阅材料。
          </div>
        ) : (
          attention.map((t) => (
            <Link
              className="v3-task-row"
              href={"/workspace?task=" + t.id}
              key={t.id}
            >
              <div className="v3-task-icon">
                <Files size={19} />
              </div>
              <div>
                <strong>{t.name}</strong>
                <p>
                  {t.context} · {t.input.rows.length} 条来源 ·{" "}
                  {t.input.units.reduce((n, u) => n + u.target, 0)} 道目标题目
                </p>
              </div>
              <span className="v3-tag attention">
                {t.status === "draft"
                  ? "模型未连接 · 输入已保存"
                  : `${t.staleIds.length} 题需复核`}
              </span>
              <ChevronRight size={17} />
            </Link>
          ))
        )}
      </section>
      <section className="v3-section">
        <div className="v3-section-title">
          <h2>最近任务</h2>
          <div className="v3-button-row">
            <button
              type="button"
              className="v3-text-button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              导入已有材料 JSON
            </button>
            <button
              type="button"
              className="v3-text-button"
              disabled={busy}
              onClick={open}
            >
              打开已有案例 <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        {!tasks.length ? (
          <div className="v3-empty">
            先在项目设置中导入条目集、配置蓝图，再创建你的第一个任务。
            <Link href="/settings">管理条目集与蓝图 →</Link>
          </div>
        ) : (
          tasks.map((t) => (
            <Link
              className="v3-task-row"
              href={"/workspace?task=" + t.id}
              key={t.id}
            >
              <div>
                <strong>{t.name}</strong>
                <p>
                  {t.context} · 输入已冻结 ·{" "}
                  {new Date(t.updatedAt).toLocaleString("zh-CN")}
                </p>
              </div>
              <span className="v3-tag">
                {t.status === "published"
                  ? "已入库"
                  : t.status === "materials"
                    ? "已有材料"
                    : t.status === "draft"
                      ? "草稿"
                      : "待复核"}
              </span>
              <ChevronRight size={17} />
            </Link>
          ))
        )}
      </section>
      <footer className="v3-muted">
        任务和来源版本由本机服务保存。切换页面或刷新不会改变已冻结的输入。
      </footer>
    </Shell>
  );
}
