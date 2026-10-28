"use client";
import * as React from "react";
import { Shell, ErrorBox } from "@/components/studio/shell";
import { useStudio, safeAction } from "@/components/studio/use-studio";
import { ImportEditor } from "@/components/studio/import-editor";
import {
  validateBlueprint,
  type Unit,
  type Blueprint,
  type ItemSet,
} from "@/lib/studio/model";
import { ContextSettings } from "@/components/studio/context-settings";
export default function Settings() {
  const { data, error, busy, act } = useStudio();
  const [tab, setTab] = React.useState("sets");
  const [editing, setEditing] = React.useState<ItemSet | "new" | null>(null);
  const [blueprint, setBlueprint] = React.useState<Blueprint | "new" | null>(
    null,
  );
  const [setVersion, setSetVersion] = React.useState<Record<string, string>>(
    {},
  );
  return (
    <Shell>
      <div className="v3-top">
        <div>
          <p className="v3-kicker">项目设置</p>
          <h1>可复用的研究输入</h1>
          <p>条目集与蓝图独立保存，更新设置不会改变已有任务。</p>
        </div>
      </div>
      <ErrorBox message={error} />
      <nav className="v3-tabs">
        {[
          ["sets", "条目集与蓝图"],
          ["contexts", "身份与情境"],
          ["models", "模型连接"],
          ["rubric", "评分标准"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "contexts" ? <ContextSettings /> : tab === "models" ? (
        <section className="v3-section">
          <h2>模型尚未连接</h2>
          <p>
            当前可管理输入、查阅和编辑已有材料。在线生成、审查和补齐评分暂不可用。
          </p>
          <div className="v3-connection">
            <span className="v3-tag attention">待接入</span>
            <h3>生成与独立评分服务</h3>
            <p>
              接入后配置生成预设、提示词版本、三个评分模型及调用预算。API
              密钥仅保存在服务端。
            </p>
            <button className="v3-secondary" disabled>
              测试连接
            </button>
          </div>
        </section>
      ) : tab === "rubric" ? (
        <section className="v3-section">
          <h2>四维独立评分 · 0 / 1 / 2</h2>
          <p>构念一致性、叙事衔接、公平无偏、现实可行。</p>
          <ul className="v3-readable">
            <li>任一模型任一维度为 0，触发修订。</li>
            <li>同一维度至少两个模型为 1，触发修订。</li>
            <li>三路评分必须齐全，且对应当前有效内容版本。</li>
            <li>目标批次全部满足条件并通过发布检查，才可整批入库。</li>
          </ul>
        </section>
      ) : (
        <>
          {editing && (
            <ImportEditor
              existing={editing === "new" ? undefined : editing}
              onSave={act}
              onClose={() => setEditing(null)}
            />
          )}
          <section className="v3-section">
            <div className="v3-section-title">
              <h2>条目集</h2>
              <button className="v3-primary" onClick={() => setEditing("new")}>
                导入新条目集
              </button>
            </div>
            {data?.itemSets.map((set) => {
              const version =
                set.versions.find((v) => v.id === setVersion[set.id]) ??
                set.versions.at(-1)!;
              return (
                <article className="v3-resource" key={set.id}>
                  <div className="v3-resource-head">
                    <div>
                      <h3>{set.name}</h3>
                      <p>
                        {version.rows.length} 条 ·{" "}
                        {new Set(version.rows.map((r) => r.domain)).size} 个维度
                        · {set.archived ? "已归档" : "可选用"}
                      </p>
                    </div>
                    <select
                      aria-label={set.name + "版本"}
                      value={version.id}
                      onChange={(e) =>
                        setSetVersion({
                          ...setVersion,
                          [set.id]: e.target.value,
                        })
                      }
                    >
                      {set.versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          V{v.number} ·{" "}
                          {new Date(v.createdAt).toLocaleDateString("zh-CN")}
                        </option>
                      ))}
                    </select>
                    <button
                      className="v3-secondary"
                      onClick={() => setEditing(set)}
                    >
                      基于最新版本修改
                    </button>
                    <button
                      className="v3-text-button"
                      disabled={busy}
                      onClick={() =>
                        safeAction(
                          act({
                            action: "archiveSet",
                            id: set.id,
                            archived: !set.archived,
                          }),
                        )
                      }
                    >
                      {set.archived ? "取消归档" : "归档"}
                    </button>
                  </div>
                  <details>
                    <summary>查看来源版本与条目</summary>
                    <p className="v3-muted">{version.reason}</p>
                    <div className="v3-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>ID / 修订</th>
                            <th>条目</th>
                            <th>维度 / 子维度</th>
                            <th>构念定义</th>
                            <th>家族关系</th>
                          </tr>
                        </thead>
                        <tbody>
                          {version.rows.map((r) => (
                            <tr key={r.sourceId}>
                              <td>
                                {r.sourceId} / r{r.revision}
                              </td>
                              <td>{r.text}</td>
                              <td>
                                {r.domain} / {r.facet || "—"}
                              </td>
                              <td>{r.definition}</td>
                              <td>
                                {r.familyConfirmed
                                  ? "已确认"
                                  : "未确认，不自动配对"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </article>
              );
            })}
          </section>
          {blueprint && (
            <BlueprintEditor
              existing={blueprint === "new" ? undefined : blueprint}
              onSave={async (v) => {
                await act(v);
                setBlueprint(null);
              }}
              onClose={() => setBlueprint(null)}
            />
          )}
          <section className="v3-section">
            <div className="v3-section-title">
              <h2>测量蓝图</h2>
              <button
                className="v3-secondary"
                onClick={() => setBlueprint("new")}
              >
                创建自定义蓝图
              </button>
            </div>
            {data?.blueprints.map((bp) => (
              <article className="v3-resource" key={bp.id}>
                <div className="v3-resource-head">
                  <div>
                    <h3>{bp.name}</h3>
                    <p>
                      V{bp.versions.at(-1)?.number} ·{" "}
                      {bp.versions
                        .at(-1)
                        ?.units.reduce((n, u) => n + u.target, 0)}{" "}
                      道目标题目
                    </p>
                  </div>
                  <button
                    className="v3-secondary"
                    onClick={() => setBlueprint(bp)}
                  >
                    查看并保存新版本
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </Shell>
  );
}
function BlueprintEditor({
  existing,
  onSave,
  onClose,
}: {
  existing?: Blueprint;
  onSave: (a: import("@/lib/studio/service").StudioAction) => Promise<void>;
  onClose: () => void;
}) {
  const prev = existing?.versions.at(-1);
  const [name, setName] = React.useState(existing?.name ?? "");
  const [usesFacets, setFacets] = React.useState(prev?.usesFacets ?? false);
  const [units, setUnits] = React.useState<Unit[]>(
    prev
      ? structuredClone(prev.units)
      : [{ domain: "", facet: "", definition: "", target: 4 }],
  );
  const [instruction, setInstruction] = React.useState(prev?.instruction ?? "");
  const [levels, setLevels] = React.useState(prev?.levels ?? "");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const errors = validateBlueprint({ units, usesFacets, instruction, levels });
  function update(i: number, patch: Partial<Unit>) {
    setUnits(units.map((u, n) => (n === i ? { ...u, ...patch } : u)));
  }
  return (
    <section className="v3-editor">
      <div className="v3-section-title">
        <h2>{existing ? "蓝图新版本" : "自定义测量蓝图"}</h2>
        <button className="v3-secondary" onClick={onClose}>
          关闭
        </button>
      </div>
      <label>
        蓝图名称
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="v3-check">
        <input
          type="checkbox"
          checked={usesFacets}
          onChange={(e) => {
            setFacets(e.target.checked);
            if (!e.target.checked)
              setUnits(units.map((u) => ({ ...u, facet: "" })));
          }}
        />
        使用子维度层级
      </label>
      <div className="v3-table-scroll">
        <table>
          <thead>
            <tr>
              <th>维度</th>
              {usesFacets && <th>子维度</th>}
              <th>构念定义</th>
              <th>题量</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units.map((u, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`单元${i + 1}维度`}
                    value={u.domain}
                    onChange={(e) => update(i, { domain: e.target.value })}
                  />
                </td>
                {usesFacets && (
                  <td>
                    <input
                      aria-label={`单元${i + 1}子维度`}
                      value={u.facet}
                      onChange={(e) => update(i, { facet: e.target.value })}
                    />
                  </td>
                )}
                <td>
                  <input
                    aria-label={`单元${i + 1}定义`}
                    value={u.definition}
                    onChange={(e) => update(i, { definition: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    aria-label={`单元${i + 1}题量`}
                    min={1}
                    value={u.target}
                    onChange={(e) =>
                      update(i, { target: Number(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <button
                    className="v3-text-button"
                    onClick={() => setUnits(units.filter((_, n) => n !== i))}
                  >
                    移除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="v3-secondary"
        onClick={() =>
          setUnits([
            ...units,
            { domain: "", facet: "", definition: "", target: 4 },
          ])
        }
      >
        增加测量单元
      </button>
      <label>
        作答说明
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </label>
      <label>
        四选项候选行为等级说明
        <textarea value={levels} onChange={(e) => setLevels(e.target.value)} />
      </label>
      <p className="v3-muted">
        目标题量：{units.reduce((n, u) => n + u.target, 0)}
        。显示顺序不自动等同于分值；更换构念后需复核提示词预设。
      </p>
      <ErrorBox message={error} />
      <button
        className="v3-primary"
        disabled={!name.trim() || !!errors.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave({
              action: "saveBlueprint",
              id: existing?.id,
              baseVersion: prev?.id,
              name,
              units,
              usesFacets,
              instruction,
              levels,
            });
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        保存蓝图版本
      </button>
      {errors.length > 0 && (
        <p className="v3-muted">待补齐：{errors.join("；")}</p>
      )}
    </section>
  );
}
