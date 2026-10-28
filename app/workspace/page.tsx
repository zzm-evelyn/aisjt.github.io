"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Shell, ErrorBox } from "@/components/studio/shell";
import { useStudio, safeAction } from "@/components/studio/use-studio";
import { publicationChecks } from "@/lib/studio/checks";
import { RUBRIC_DIMENSIONS } from "@/lib/types/domain";
import { DraftQueue, type Recovery } from "@/lib/studio/save-queue";
import type { Task } from "@/lib/studio/model";
import type { StudioAction } from "@/lib/studio/service";
import { downloadJson } from "@/lib/storage/exchange";
import { Printable } from "@/components/studio/printable";

import { useSingleScenarios } from "@/components/studio/use-single-scenarios";
import { GenerationFlow } from "@/components/studio/generation-flow";

const stages = ["测量目标", "情景与题目", "审查与修订", "题目入库"];
export default function Workspace() {
  return (
    <React.Suspense fallback={<p>正在加载任务…</p>}>
      <WorkspaceRoute />
    </React.Suspense>
  );
}
function WorkspaceRoute() {
  const query = useSearchParams();
  return <WorkspaceBody key={query.get("task") ?? "no-task"} />;
}
function WorkspaceBody() {
  const {data:singleScenarios,error:scenarioError,loading:scenarioLoading}=useSingleScenarios();
  const router = useRouter();
  const query = useSearchParams();
  const id = query.get("task");
  const { data, error, busy, act } = useStudio();
  const task = data?.tasks.find((t) => t.id === id);
  const [editing, setEditing] = React.useState(false);
  const [stage, setStage] = React.useState(0);
  const [sub, setSub] = React.useState("inputs");
  function goStage(next: number) {
    setStage(next);
    setSub(["inputs", "outline", "issues", "release"][next]);
  }
  const [selected, setSelected] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [issueOnly, setIssueOnly] = React.useState(false);
  const [evidence, setEvidence] = React.useState(false);
  const [saveState, setSaveState] = React.useState("已保存");
  const [recovery, setRecovery] = React.useState<Recovery | null>(null);
  const queueRef = React.useRef<DraftQueue | null>(null);
  const actRef = React.useRef(act);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    actRef.current = act;
    if (task && !queueRef.current) {
      queueRef.current = new DraftQueue(
        task.revision,
        async (revision, patch) => {
          const r = await actRef.current({
            action: "editTask",
            id: task.id,
            revision,
            patch,
          });
          return r.state.tasks.find((t) => t.id === task.id)!.revision;
        },
        (value) => {
          try {
            if (value)
              localStorage.setItem(
                "sjt:recovery:" + task.id,
                JSON.stringify(value),
              );
            else {
              localStorage.removeItem("sjt:recovery:" + task.id);
              setRecovery(null);
            }
          } catch {
            setSaveState("本地恢复副本保存失败，请等待服务器保存");
          }
        },
        setSaveState,
      );
    }
    if (task && queueRef.current && !queueRef.current.busy)
      queueRef.current.revision = task.revision;
  }, [act, task]);
  React.useEffect(() => {
    if (!id) return;
    queueMicrotask(() => {
      try {
        const local = localStorage.getItem("sjt:recovery:" + id);
        if (local) setRecovery(JSON.parse(local));
      } catch {}
    });
  }, [id]);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void queueRef.current?.flush();
    },
    [],
  );
  function schedule(
    patch: Extract<StudioAction, { action: "editTask" }>["patch"],
  ) {
    queueRef.current?.schedule(patch);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void queueRef.current?.flush(), 650);
  }
  React.useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (queueRef.current?.busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  if (!id)
    return (
      <Shell>
        <div className="v3-empty">
          <h1>先选择一个任务</h1>
          <Link className="v3-primary" href="/">
            返回任务中心
          </Link>
        </div>
      </Shell>
    );
  if (!task)
    return (
      <Shell>
        <ErrorBox message={error} />
        <p className="v3-empty">{data ? "任务不存在" : "正在读取任务…"}</p>
        <Link href="/">返回任务中心</Link>
      </Shell>
    );
  const run = task.run;
  const current =
    run?.items.find((i) => i.item_id === selected) ?? run?.items[0];
  const source = task.input.rows.find(
    (r) => r.sourceId === current?.source_item_id,
  );
  const scenario = source && singleScenarios.items.find(i => i.sourceId === source.sourceId && i.sourceText.normalize("NFKC").replace(/[\p{P}\p{Z}\s_]/gu, "") === source.text.normalize("NFKC").replace(/[\p{P}\p{Z}\s_]/gu, ""));
  const checks = publicationChecks(task);
  const frozen = task.status === "published";
  const pending = saveState !== "已保存" || recovery !== null;
  const changed = task.staleIds;
  const filtered = (run?.items ?? []).filter(
    (i) =>
      (!domain || i.domain === domain) &&
      (!issueOnly || changed.includes(i.item_id)) &&
      `${i.stem} ${i.item_id} ${i.facet}`.includes(search),
  );
  const latest = Math.max(0, ...(run?.reviews.map((r) => r.attempt) ?? []));
  const reviews = run?.reviews.filter((r) => r.attempt === latest) ?? [];
  const behavior = run?.stages
    .flatMap((s) =>
      Array.isArray(s.output?.behavioral_targets)
        ? (s.output!.behavioral_targets as {
            source_item_id: string;
            behavioral_description: string;
          }[])
        : [],
    )
    .filter((b) => b.source_item_id === source?.sourceId)
    .at(-1);
  if (run && !editing) return <Shell><ErrorBox message={error} /><GenerationFlow task={task} busy={busy || pending} onEdit={()=>setEditing(true)} onPublish={()=>safeAction(act({action:"publish", id:task.id, revision:task.revision}))}/></Shell>;
  return (
    <Shell>
      {run && <button className="v3-text-button" onClick={()=>setEditing(false)}>← 返回生成流程</button>}
      <div className="v3-task-top">
        <div>
          <Link href="/" className="v3-back">
            ← 任务中心
          </Link>
          <h1>{task.name}</h1>
          <p>
            {task.context} · {task.input.rows.length} 条来源 ·{" "}
            <span role="status">{saveState}</span> ·{" "}
            {frozen
              ? "已入库版本"
              : task.status === "needs_review"
                ? "待复核"
                : "候选草稿"}
          </p>
        </div>
        <details className="v3-task-menu">
          <summary>任务操作</summary>
          <Link href={"/tasks/new?from=" + task.id}>
            更换来源：基于此任务新建
          </Link>
          <button
            disabled={busy || pending}
            onClick={() =>
              safeAction(
                act({ action: "cloneTask", id: task.id }).then((r) => {
                  router.push("/workspace?task=" + r.resultId);
                }),
              )
            }
          >
            基于此版继续编辑
          </button>
          <button
            onClick={() => {
              setSub("print");
              setStage(3);
            }}
          >
            作答材料预览
          </button>
        </details>
      </div>
      <ErrorBox message={error} />
      {recovery && (
        <div className="v3-error">
          检测到未保存的本地恢复副本（任务 r{recovery.revision}）。
          <button className="v3-text-button" onClick={()=>downloadJson(recovery,"sjt-draft-recovery.json")}>下载恢复副本</button>
          <button className="v3-text-button" onClick={()=>{localStorage.removeItem("sjt:recovery:"+task.id);setRecovery(null);}}>放弃本地恢复副本，采用服务器内容</button>
          <button
            className="v3-text-button"
            onClick={() => {
              if (recovery.revision !== task.revision) {
                alert(
                  "服务器版本已变化。请先复制恢复内容与现有版本比较，避免覆盖。",
                );
                return;
              }
              recovery.patches.forEach((p) => schedule(p));
            }}
          >
            重新提交恢复内容
          </button>
          <details>
            <summary>查看并复制恢复内容</summary>
            <pre>{JSON.stringify(recovery.patches, null, 2)}</pre>
          </details>
        </div>
      )}
      <nav className="v3-stage-nav">
        {stages.map((s, i) => (
          <button
            key={s}
            aria-current={stage === i ? "step" : undefined}
            onClick={() => goStage(i)}
          >
            <span>{i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
      {!run ? (
        <section className="v3-section">
          <h2>输入已可靠保存</h2>
          <p>本任务尚无生成结果。模型未连接，不能开始在线生成。</p>
          <InputEvidence task={task} />
          <div className="v3-action-bar">
            <Link className="v3-primary" href="/settings">
              查看项目设置
            </Link>
            <button className="v3-secondary" disabled>
              生成单个情景
            </button>
          </div>
        </section>
      ) : (
        <div className={"v3-workspace " + (evidence ? "has-evidence" : "")}>
          <aside className="v3-directory">
            <h2>题目目录</h2>
            <input
              aria-label="搜索题目"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索题目 / ID / 子维度"
            />
            <select
              aria-label="筛选维度"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              <option value="">全部维度</option>
              {[...new Set(run.items.map((i) => i.domain))].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <label className="v3-check">
              <input
                type="checkbox"
                checked={issueOnly}
                onChange={(e) => setIssueOnly(e.target.checked)}
              />
              仅看待评分题目
            </label>
            <div className="v3-directory-list">
              {filtered.map((i, n) => (
                <button
                  key={i.item_id}
                  aria-current={
                    current?.item_id === i.item_id ? "true" : undefined
                  }
                  onClick={() => {
                    setSelected(i.item_id);
                    setSub("items");
                  }}
                >
                  <small>
                    {String(n + 1).padStart(2, "0")} · {i.item_id}
                    {changed.includes(i.item_id) ? " · 需复核" : ""}
                  </small>
                  <span>{i.stem}</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="v3-content">
            <div className="v3-content-tools">
              <nav className="v3-tabs">
                {(stage === 0
                  ? [
                      ["inputs", "条目与蓝图"],
                      ["behavior", "单个情景生成"],
                    ]
                  : stage === 1
                    ? [
                        ["outline", "事件大纲"],
                        ["story", "故事阅读"],
                        ["items", "题目编辑"],
                      ]
                    : stage === 2
                      ? [
                          ["issues", "需要处理"],
                          ["scores", "评分矩阵"],
                          ["history", "版本差异"],
                        ]
                      : [
                          ["release", "发布检查"],
                          ["print", "作答预览"],
                        ]
                ).map(([id, title]) => (
                  <button
                    key={id}
                    aria-pressed={sub === id}
                    onClick={() => setSub(id)}
                  >
                    {title}
                  </button>
                ))}
              </nav>
              <button
                className="v3-text-button"
                onClick={() => setEvidence(!evidence)}
              >
                {evidence ? "关闭依据" : "查看依据"}
              </button>
            </div>
            {stage === 0 ? (
              <>
                {sub === "behavior" ? (
                  <div className="v3-readable">
                    <h2>单个情景生成</h2>
                    <p>{source?.text}</p>
                    {scenarioLoading ? <p>正在读取单个情景材料…</p> : scenarioError ? <p role="alert">{scenarioError}</p> : scenario ? <><p>{scenario.scenario}</p><h3>{scenario.stem}</h3>{scenario.options.map((o,i)=><p key={i}>{String.fromCharCode(65+i)}. {o.replace(/^[A-D][.．、]\s*/, "")}</p>)}<small>{singleScenarios.filename} · {singleScenarios.sheet} · 第 {scenario.sheetRow} 行</small></> : <p>{behavior?.behavioral_description ?? "此条目未单独保存情景生成记录。"}</p>}
                  </div>
                ) : (
                  <InputEvidence task={task} />
                )}
              </>
            ) : stage === 1 ? (
              <>
                {sub === "outline" ? (
                  <>
                    <h2>事件大纲</h2>
                    <p className="v3-muted">
                      调整事件顺序后，需要重新生成故事并评分。
                    </p>
                    {run.outline.events.map((e, i) => (
                      <OutlineRow
                        key={e.event_id}
                        event={e}
                        index={i}
                        count={run.outline.events.length}
                        frozen={frozen || !!recovery}
                        onSave={(p) => schedule(p)}
                      />
                    ))}
                    <button disabled className="v3-secondary">
                      确认大纲并生成初稿 · 模型未连接
                    </button>
                  </>
                ) : sub === "story" ? (
                  <div className="v3-story-reader">
                    <h2>{run.story.title}</h2>
                    <p>{task.input.instruction}</p>
                    {run.story.segments.map((segment) => (
                      <article key={segment.event_id}>
                        <StoryEditor
                          key={segment.event_id}
                          text={segment.text}
                          frozen={frozen || !!recovery}
                          onSave={(text) =>
                            schedule({
                              kind: "story",
                              eventId: segment.event_id,
                              text,
                            })
                          }
                        />
                        {run.items
                          .filter((i) => i.event_id === segment.event_id)
                          .map((i) => (
                            <div className="v3-reader-question" key={i.item_id}>
                              <strong>{i.stem}</strong>
                              {i.options.map((o, n) => (
                                <p key={o.option_id}>
                                  {String.fromCharCode(65 + n)}. {o.text}
                                </p>
                              ))}
                            </div>
                          ))}
                      </article>
                    ))}
                  </div>
                ) : (
                  current && (
                    <ItemEditor
                      key={current.item_id + ":" + task.id}
                      task={task}
                      locked={!!recovery}
                      item={current}
                      onSave={schedule}
                    />
                  )
                )}
              </>
            ) : stage === 2 ? (
              <>
                {sub === "history" ? (
                  <>
                    <h2>版本变更</h2>
                    <p>
                      旧版全文未保存的部分不会重构为完整旧版。恢复草稿不会继承旧评分。
                    </p>
                    {task.history.map((h, i) => (
                      <details key={i}>
                        <summary>
                          {new Date(h.at).toLocaleString("zh-CN")} · {h.reason}
                        </summary>
                        <p>
                          {
                            h.run?.items.find(
                              (x) => x.item_id === current?.item_id,
                            )?.stem
                          }
                        </p>
                        <button
                          disabled={frozen || pending}
                          className="v3-secondary"
                          onClick={() =>
                            schedule({ kind: "restore", index: i })
                          }
                        >
                          以此历史内容创建草稿
                        </button>
                      </details>
                    ))}
                    {run.revisions.map((r) => (
                      <details key={r.revision_id}>
                        <summary>
                          {r.from_version} → {r.to_version} ·{" "}
                          {r.changed_item_ids.length} 题变更
                        </summary>
                        <p>{r.reason}</p>
                        <div className="v3-before-after">
                          <div>
                            <h3>修改前</h3>
                            <p>{r.before_text}</p>
                          </div>
                          <div>
                            <h3>修改后</h3>
                            <p>{r.after_text}</p>
                          </div>
                        </div>
                      </details>
                    ))}
                  </>
                ) : sub === "scores" ? (
                  <>
                    <h2>三路独立评分</h2>
                    <p>
                      {run.items.length - changed.length} 题未发生本地改动 ·{" "}
                      {changed.length} 题待重新评分
                    </p>
                    <div className="v3-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>题目</th>
                            {["review_a", "review_b", "review_c"].map((s) => (
                              <th key={s}>模型 {s.at(-1)?.toUpperCase()}</th>
                            ))}
                            <th>版本状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((i) => (
                            <tr key={i.item_id}>
                              <td>
                                <button
                                  className="v3-text-button"
                                  onClick={() => {
                                    setSelected(i.item_id);
                                    setEvidence(true);
                                  }}
                                >
                                  {i.item_id}
                                </button>
                              </td>
                              {["review_a", "review_b", "review_c"].map((s) => (
                                <td key={s}>
                                  {RUBRIC_DIMENSIONS.map((d) => (
                                    <span className="v3-score-cell" key={d.key}>
                                      {d.label}{" "}
                                      {reviews.find(
                                        (r) => r.reviewer_slot === s,
                                      )?.item_scores?.[i.item_id]?.[d.key] ??
                                        "缺失"}
                                    </span>
                                  ))}
                                </td>
                              ))}
                              <td>
                                {changed.includes(i.item_id)
                                  ? "待重新评分"
                                  : "原版记录"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>需要处理</h2>
                    {changed.length > 0 && (
                      <div className="v3-error">
                        {changed.length}{" "}
                        道题已修改，等待重新评分。
                      </div>
                    )}
                    {!changed.length && (
                      <p className="v3-success">当前草稿没有新增的内容变更。</p>
                    )}
                    {run.review_reports.map((r) => (
                      <details key={r.report_id}>
                        <summary>
                          {r.reviewed_version} · {r.summary}
                        </summary>
                        {r.issues.map((p) => (
                          <button
                            key={p.issue_id}
                            className="v3-issue-row"
                            onClick={() => {
                              setSelected(p.scenario_id);
                              setEvidence(true);
                            }}
                          >
                            <strong>
                              {p.scenario_id} · {p.category}
                            </strong>
                            <span>{p.problem}</span>
                            <small>
                              历史版本 {r.reviewed_version}{" "}
                              的原始问题记录，不代表当前版本仍有同样问题
                            </small>
                          </button>
                        ))}
                      </details>
                    ))}
                    <button className="v3-secondary" disabled>
                      补齐审查与评分 · 模型未连接
                    </button>
                  </>
                )}
              </>
            ) : sub === "print" ? (
              <Printable task={task} />
            ) : (
              <>
                <h2>发布检查</h2>
                <ul className="v3-release-checks">
                  {checks.length ? (
                    checks.map((c, i) => (
                      <li key={i} className="blocked">
                        需要处理 · {c}
                      </li>
                    ))
                  ) : (
                    <li className="passed">
                      来源与蓝图、四选项结构、版本引用、三路评分与保存检查通过。
                    </li>
                  )}
                </ul>
                <p>
                  整批入库保存不可变内容包。未通过时可继续保存草稿，不能绕过规则发布。
                </p>
                <div className="v3-action-bar">
                  <button
                    className="v3-primary"
                    disabled={busy || pending || !!checks.length || frozen}
                    onClick={() =>
                      safeAction(
                        act({
                          action: "publish",
                          id: task.id,
                          revision: task.revision,
                        }),
                      )
                    }
                  >
                    {frozen ? "已入库" : "确认入库"}
                  </button>
                  <Link href="/library">查看题目库 →</Link>
                </div>
              </>
            )}
            <footer className="v3-flow-footer" aria-label="流程操作">
              <div aria-live="polite">
                <strong>第 {stage + 1} 步 / 4 · {stages[stage]}</strong>
                <p>{[
                  "核对来源条目、测量蓝图和单个情景后，继续查看事件大纲。",
                  sub === "outline" ? "核对事件顺序与覆盖范围，下一步阅读故事。修改后的大纲需重新生成与评价。" : sub === "story" ? "阅读故事并核对情境，下一步查看题干和四个选项。" : "核对题干与四个选项后，继续查看审查结果和三路评分。",
                  sub === "scores" ? "核对三路评分后，进入入库检查；评分未完成或存在问题时仍不能入库。" : "先查看需要处理的问题，再查看三路独立评分。",
                  frozen ? "此版本已入库，可前往题目库查看和导出。" : "检查全部通过且草稿保存完成后，点击上方“确认入库”。",
                ][stage]}</p>
              </div>
              <div className="v3-action-bar">
                {stage > 0 && <button className="v3-secondary" onClick={() => goStage(stage - 1)}>上一步：{stages[stage - 1]}</button>}
                {stage === 0 ? <button className="v3-primary" onClick={() => goStage(1)}>下一步：查看事件大纲 →</button>
                  : stage === 1 ? <button className="v3-primary" onClick={() => {
                    if (sub === "outline") setSub("story");
                    else if (sub === "story") setSub("items");
                    else goStage(2);
                  }}>{sub === "outline" ? "下一步：阅读故事 →" : sub === "story" ? "下一步：核对题目 →" : "下一步：审查与评分 →"}</button>
                  : stage === 2 ? <button className="v3-primary" onClick={() => sub === "scores" ? goStage(3) : setSub("scores")}>{sub === "scores" ? "下一步：检查并入库 →" : "下一步：查看三 AI 评分 →"}</button>
                  : frozen ? <Link className="v3-primary" href="/library">前往题目库 →</Link>
                  : sub === "print" ? <button className="v3-primary" onClick={() => setSub("release")}>返回入库检查 →</button> : null}
              </div>
            </footer>
          </section>
          {evidence && (
            <aside className="v3-evidence">
              <div className="v3-section-title">
                <h2>题目依据</h2>
                <button
                  onClick={() => setEvidence(false)}
                  aria-label="关闭证据面板"
                >
                  ×
                </button>
              </div>
              <h3>{current?.item_id}</h3>
              <h4>来源与版本</h4>
              <p>
                {source?.sourceId} · r{source?.revision}
              </p>
              <p>{source?.text}</p>
              <p className="v3-muted">
                {task.input.itemSetName} ·{" "}
                {task.input.itemSetVersionNumber
                  ? "V" + task.input.itemSetVersionNumber
                  : "已冻结版本"}
              </p>
              <h4>目标构念</h4>
              <p>
                {source?.domain} / {source?.facet || "无子维度"}
              </p>
              <p>{source?.definition}</p>
              <h4>单个情景</h4>
              <p>{scenario?.scenario ?? behavior?.behavioral_description ?? "未单独存档"}</p>
              <h4>关联情景</h4>
              <p>
                {
                  run.story.segments.find(
                    (s) => s.event_id === current?.event_id,
                  )?.text
                }
              </p>
              <h4>当前评分状态</h4>
              <p>
                {current && changed.includes(current.item_id)
                  ? "内容已修改，等待重新评分"
                  : "已有版本评分记录，详见评分矩阵"}
              </p>
              <h4>三路评分 · 当前版本记录</h4>
              {reviews.map((r) => (
                <p key={r.review_id}>
                  {r.reviewer_slot.replace("review_", "").toUpperCase()}：
                  {RUBRIC_DIMENSIONS.map(
                    (d) =>
                      d.label +
                      " " +
                      (r.item_scores?.[current?.item_id ?? ""]?.[d.key] ??
                        "缺失"),
                  ).join(" / ")}
                </p>
              ))}
              <h4>关联修订</h4>
              {run.revisions
                .filter((r) =>
                  r.changed_item_ids.includes(current?.item_id ?? ""),
                )
                .map((r) => (
                  <p key={r.revision_id}>
                    {r.from_version} → {r.to_version} · {r.reason}
                  </p>
                ))}
              <h4>原始审查依据</h4>
              {run.review_reports.flatMap((r) =>
                r.issues
                  .filter((i) => i.scenario_id === current?.item_id)
                  .map((i) => (
                    <p key={r.report_id + i.issue_id}>
                      {r.reviewed_version} · {i.problem}
                    </p>
                  )),
              )}
              <h4>材料来源</h4>
              <p>{task.origin}</p>
            </aside>
          )}
        </div>
      )}
      <details className="v3-records">
        <summary>任务输入快照与来源记录</summary>
        <p>
          流程：来源条目 → 单个情景生成 → 大纲确认 → 故事生成 → 审查智能体 → 修订判断 →
          三模型评分 → 未达标返回修订判断与生成智能体 → 复评达标 → 整批入库。
        </p>
        <InputEvidence task={task} />
        <p>{task.origin}</p>
        <p>
          输入冻结时间：{new Date(task.input.frozenAt).toLocaleString("zh-CN")}
        </p>
        <pre>{JSON.stringify(task.input, null, 2)}</pre>
      </details>
    </Shell>
  );
}
function InputEvidence({ task }: { task: Task }) {
  return (
    <div>
      <h2>条目与蓝图</h2>
      <p>
        {task.input.itemSetName} ·{" "}
        {task.input.itemSetVersionNumber
          ? "V" + task.input.itemSetVersionNumber
          : "已冻结版本"}
      </p>
      <p>
        {task.input.blueprintName} ·{" "}
        {task.input.blueprintVersionNumber
          ? "V" + task.input.blueprintVersionNumber
          : "已冻结版本"}
      </p>
      <p>{task.input.instruction}</p>
      <div className="v3-table-scroll">
        <table>
          <thead>
            <tr>
              <th>来源 / 修订</th>
              <th>条目</th>
              <th>测量单元</th>
              <th>构念定义</th>
              <th>家族映射</th>
            </tr>
          </thead>
          <tbody>
            {task.input.rows.map((r) => (
              <tr key={r.sourceId}>
                <td>
                  {r.sourceId} / r{r.revision}
                </td>
                <td>{r.text}</td>
                <td>
                  {r.domain} / {r.facet || "—"}
                </td>
                <td>{r.definition}</td>
                <td>{r.familyConfirmed ? r.familyId : "未确认，不自动配对"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ItemEditor({
  task,
  item,
  onSave,
  locked=false,
}: {
  task: Task;
  locked?: boolean;
  item: NonNullable<Task["run"]>["items"][number];
  onSave: (p: Extract<StudioAction, { action: "editTask" }>["patch"]) => void;
}) {
  const [stem, setStem] = React.useState(item.stem);
  const [options, setOptions] = React.useState(item.options.map((o) => o.text));
  const frozen = task.status === "published" || locked;
  return (
    <div className="v3-readable">
      <p className="v3-kicker">{item.item_id}</p>
      <h2>题目编辑</h2>
      <p className="v3-muted">
        修改题干或选项后需要重新评分，历史记录会保留。
      </p>
      <label>
        题干
        <textarea
          readOnly={frozen}
          value={stem}
          onChange={(e) => {
            setStem(e.target.value);
            onSave({
              kind: "item",
              itemId: item.item_id,
              stem: e.target.value,
              options,
            });
          }}
        />
      </label>
      {options.map((text, i) => (
        <label key={item.options[i].option_id}>
          选项 {String.fromCharCode(65 + i)}
          <textarea
            readOnly={frozen}
            value={text}
            onChange={(e) => {
              const next = options.map((t, n) =>
                n === i ? e.target.value : t,
              );
              setOptions(next);
              onSave({
                kind: "item",
                itemId: item.item_id,
                stem,
                options: next,
              });
            }}
          />
        </label>
      ))}
      <details>
        <summary>候选行为水平（内部记录）</summary>
        {item.options.map((o) => (
          <p key={o.option_id}>
            {o.option_id}：{o.candidate_level ?? "未标注"}
          </p>
        ))}
      </details>
    </div>
  );
}
function StoryEditor({
  text,
  frozen,
  onSave,
}: {
  text: string;
  frozen: boolean;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(text);
  return (
    <div>
      <p className="v3-story-text">{text}</p>
      {!frozen && (
        <button className="v3-text-button" onClick={() => setEditing(!editing)}>
          {editing ? "收起编辑" : "编辑本段"}
        </button>
      )}
      {editing && (
        <>
          <p className="v3-muted">
            修改故事后，需要重新检查全篇衔接并评分。
          </p>
          <textarea
            rows={6}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onSave(e.target.value);
            }}
          />
        </>
      )}
    </div>
  );
}
function OutlineRow({
  event,
  index,
  count,
  frozen,
  onSave,
}: {
  event: NonNullable<Task["run"]>["outline"]["events"][number];
  index: number;
  count: number;
  frozen: boolean;
  onSave: (p: Extract<StudioAction, { action: "editTask" }>["patch"]) => void;
}) {
  const [value, setValue] = React.useState(event.description);
  return (
    <article className="v3-outline-row">
      <span>{index + 1}</span>
      <div>
        <textarea
          aria-label={"事件" + (index + 1)}
          readOnly={frozen}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onSave({
              kind: "outline",
              eventId: event.event_id,
              description: e.target.value,
              direction: "stay",
            });
          }}
        />
        <small>
          {event.source_item_ids.join("、")} · {event.item_ids.length} 题
        </small>
      </div>
      <button
        className="v3-secondary"
        disabled={frozen || index === 0}
        onClick={() =>
          onSave({
            kind: "outline",
            eventId: event.event_id,
            description: value,
            direction: "up",
          })
        }
      >
        上移
      </button>
      <button
        className="v3-secondary"
        disabled={frozen || index === count - 1}
        onClick={() =>
          onSave({
            kind: "outline",
            eventId: event.event_id,
            description: value,
            direction: "down",
          })
        }
      >
        下移
      </button>
    </article>
  );
}
