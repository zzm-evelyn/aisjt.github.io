"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell, ErrorBox } from "@/components/studio/shell";
import { useStudio, safeAction } from "@/components/studio/use-studio";
import type { Publication } from "@/lib/studio/model";
import { downloadJson } from "@/lib/storage/exchange";
import { Printable } from "@/components/studio/printable";
export default function Library() {
  const router = useRouter();
  const { data, error, busy, act } = useStudio();
  const [view, setView] = React.useState("packages");
  const [search, setSearch] = React.useState("");
  const [preview, setPreview] = React.useState<Publication | null>(null);
  const filtered =
    data?.publications.filter((p) =>
      (p.task.name + " " + p.task.context).includes(search),
    ) ?? [];
  return (
    <Shell>
      <div className="v3-top">
        <div>
          <p className="v3-kicker">成果管理</p>
          <h1>题目库</h1>
          <p>整批发布，保存输入来源、有效内容与评分版本的不可变快照。</p>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="v3-library-tools">
        <nav className="v3-tabs">
          <button
            aria-pressed={view === "packages"}
            onClick={() => setView("packages")}
          >
            材料包
          </button>
          <button
            aria-pressed={view === "items"}
            onClick={() => setView("items")}
          >
            题目
          </button>
        </nav>
        <input
          aria-label="检索题目库"
          placeholder="按名称 / 情境筛选"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {preview ? (
        <>
          <button className="v3-secondary" onClick={() => setPreview(null)}>
            返回题目库
          </button>
          <Printable task={preview.task} />
        </>
      ) : !filtered.length ? (
        <div className="v3-empty">
          尚无服务器发布记录。<Link href="/">返回任务中心查阅材料 →</Link>
          <LegacyMigration act={act} />
        </div>
      ) : view === "packages" ? (
        filtered.map((p) => (
          <article key={p.id} className="v3-section">
            <div className="v3-section-title">
              <div>
                <h2>{p.task.name}</h2>
                <p>
                  {p.task.context} · {p.task.run?.items.length} 题 · r
                  {p.task.revision} ·{" "}
                  {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <span className="v3-tag">已入库</span>
            </div>
            <p className="v3-muted">
              输入：{p.task.input.itemSetName} /{" "}
              {p.task.input.itemSetVersionNumber
                ? "V" + p.task.input.itemSetVersionNumber
                : "已冻结版本"}
            </p>
            <div className="v3-button-row">
              <Link className="v3-secondary" href={"/assessments/new?publication=" + encodeURIComponent(p.id)}>创建测验</Link>
              <button className="v3-primary" onClick={() => setPreview(p)}>
                作答材料
              </button>
              <button
                className="v3-secondary"
                onClick={() =>
                  downloadJson(
                    { format: "sjt-publication/1", publication: p },
                    "sjt-publication-" + p.id + ".json",
                  )
                }
              >
                完整数据包
              </button>
              <button
                className="v3-secondary"
                onClick={() => downloadAppendix(p)}
              >
                研究附录 CSV
              </button>
              <button
                disabled={busy}
                className="v3-text-button"
                onClick={() =>
                  safeAction(
                    act({ action: "cloneTask", id: p.taskId }).then((r) => {
                      router.push("/workspace?task=" + r.resultId);
                    }),
                  )
                }
              >
                基于此版继续编辑 →
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className="v3-table-scroll">
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>情境</th>
                <th>题目</th>
                <th>来源</th>
                <th>维度 / 子维度</th>
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap(
                (p) =>
                  p.task.run?.items.map((i) => (
                    <tr key={p.id + i.item_id}>
                      <td>
                        <Link href={"/workspace?task=" + p.taskId}>
                          {p.task.name}
                        </Link>
                      </td>
                      <td>{p.task.context}</td>
                      <td>{i.stem}</td>
                      <td>{i.source_item_id}</td>
                      <td>
                        {i.domain} / {i.facet}
                      </td>
                    </tr>
                  )) ?? [],
              )}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
function downloadAppendix(p: Publication) {
  const cells = [
    [
      "publication_id",
      "source_id",
      "source_text",
      "domain",
      "facet",
      "event_id",
      "item_id",
      "stem",
      "options",
      "candidate_key",
    ],
    ...(p.task.run?.items.map((i) => [
      p.id,
      i.source_item_id,
      p.task.input.rows.find((r) => r.sourceId === i.source_item_id)?.text ??
        "",
      i.domain,
      i.facet,
      i.event_id,
      i.item_id,
      i.stem,
      i.options.map((o) => o.option_id + ": " + o.text).join(" | "),
      i.candidate_scoring_key ?? "",
    ]) ?? []),
  ];
  const body =
    "\uFEFF" +
    cells
      .map((r) =>
        r
          .map(
            (c) =>
              '"' +
              String(c)
                .replace(/^[=+@\t\r-]/, (m) => "'" + m)
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([body], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "sjt-research-appendix.csv";
  a.click();
  URL.revokeObjectURL(url);
}
function LegacyMigration({
  act,
}: {
  act: ReturnType<typeof useStudio>["act"];
}) {
  const router = useRouter();
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const old = JSON.parse(localStorage.getItem("sjt:library:v1") ?? "{}");
        setCount(old.state?.entries?.length ?? 0);
      } catch {}
    });
  }, []);
  return count ? (
    <div className="v3-legacy">
      <p>
        检测到旧版浏览器中 {count}{" "}
        条入库记录，原数据仍保留。打开原始案例后可在服务器执行新发布检查；旧记录不会自动当成服务器发布结果。
      </p>
      <button
        className="v3-secondary"
        onClick={() =>
          safeAction(
            act({ action: "openCase" }).then((r) => {
              router.push("/workspace?task=" + r.resultId);
            }),
          )
        }
      >
        打开已有案例并核对
      </button>
    </div>
  ) : null;
}
