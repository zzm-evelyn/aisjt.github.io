"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Shell, ErrorBox } from "@/components/studio/shell";
import { useStudio } from "@/components/studio/use-studio";
import { ImportEditor } from "@/components/studio/import-editor";
import { coverage } from "@/lib/studio/model";
import { ContextPicker, type ContextSelection } from "@/components/studio/context-picker";
export default function NewTask() {
  const router = useRouter();
  const [contextSelection, setContextSelection] = React.useState<ContextSelection>();
  const { data, error, busy, act } = useStudio();
  const [step, setStep] = React.useState(1);
  const [importing, setImporting] = React.useState(false);
  const [setId, chooseSet] = React.useState("");
  const [setVersion, chooseVersion] = React.useState("");
  const [bpId, chooseBp] = React.useState("");
  const [bpVersion, chooseBpVersion] = React.useState("");
  const [name, setName] = React.useState("");
  const [context, setContext] = React.useState("大学");
  const [budget, setBudget] = React.useState("");
  const [rounds, setRounds] = React.useState(3);
  const [reviewed, setReviewed] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[] | null>(null);
  const set = data?.itemSets.find((x) => x.id === setId);
  const version =
    set?.versions.find((v) => v.id === setVersion) ?? set?.versions.at(-1);
  const bp = data?.blueprints.find((x) => x.id === bpId);
  const bv =
    bp?.versions.find((v) => v.id === bpVersion) ?? bp?.versions.at(-1);
  const rows =
    version?.rows.filter(
      (r) => selectedIds === null || selectedIds.includes(r.sourceId),
    ) ?? [];
  const errors = bv ? coverage(rows, bv) : ["请选择蓝图"];
  React.useEffect(() => {
    if (!data) return;
    queueMicrotask(() => {
      const from = new URLSearchParams(location.search).get("from");
      const old = data.tasks.find((t) => t.id === from);
      if (old && !name) {
        setName(old.name + " · 新输入任务");
        setContext(old.context);
        chooseSet(old.input.itemSetId);
        chooseBp(old.input.blueprintId);
      }
    });
  }, [data, name]);
  return (
    <Shell>
      <div className="v3-top">
        <div>
          <p className="v3-kicker">新建任务</p>
          <h1>先确定本次研究输入</h1>
          <p>开始前保存具体来源与蓝图快照。后续条目集更新不会回写本任务。</p>
        </div>
      </div>
      <nav className="v3-wizard-steps">
        {["选择与核对条目", "定义任务与蓝图", "检查并保存"].map((title, i) => (
          <button
            key={title}
            aria-current={step === i + 1 ? "step" : undefined}
            disabled={i + 1 > step}
            onClick={() => setStep(i + 1)}
          >
            <span>{i + 1}</span>
            {title}
          </button>
        ))}
      </nav>
      <ErrorBox message={error} />
      {step === 1 ? (
        <section className="v3-section">
          <div className="v3-section-title">
            <h2>选择条目集</h2>
            <button
              className="v3-secondary"
              onClick={() => setImporting(!importing)}
            >
              导入新条目集
            </button>
          </div>
          {importing && (
            <ImportEditor
              onSave={async (a) => {
                const x = await act(a);
                chooseSet(x.resultId);
                chooseVersion("");
                setSelectedIds(null);
              }}
              onClose={() => setImporting(false)}
            />
          )}
          <div className="v3-form-grid">
            <label>
              条目集
              <select
                value={setId}
                onChange={(e) => {
                  chooseSet(e.target.value);
                  chooseVersion("");
                  setSelectedIds(null);
                }}
              >
                <option value="">请选择</option>
                {data?.itemSets
                  .filter((s) => !s.archived)
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              具体版本
              <select
                value={version?.id ?? ""}
                onChange={(e) => {
                  chooseVersion(e.target.value);
                  setSelectedIds(null);
                }}
              >
                {set?.versions.map((v) => (
                  <option value={v.id} key={v.id}>
                    V{v.number} · {v.rows.length} 条
                  </option>
                ))}
              </select>
            </label>
          </div>
          {version && (
            <>
              <p className="v3-muted">
                已选择 {rows.length} / {version.rows.length}{" "}
                条。来源与构念定义由研究者核对；家族映射未确认时不会自动配对。
              </p>
              <div className="v3-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>选用</th>
                      <th>来源 ID</th>
                      <th>文本</th>
                      <th>维度 / 子维度</th>
                      <th>构念定义</th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.rows.map((r) => (
                      <tr key={r.sourceId}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={"选用" + r.sourceId}
                            checked={rows.some(
                              (x) => x.sourceId === r.sourceId,
                            )}
                            onChange={(e) => {
                              const ids = rows.map((x) => x.sourceId);
                              setSelectedIds(
                                e.target.checked
                                  ? [...ids, r.sourceId]
                                  : ids.filter((x) => x !== r.sourceId),
                              );
                            }}
                          />
                        </td>
                        <td>{r.sourceId}</td>
                        <td>{r.text}</td>
                        <td>
                          {r.domain} / {r.facet || "—"}
                        </td>
                        <td>{r.definition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <button
            className="v3-primary"
            disabled={!rows.length}
            onClick={() => setStep(2)}
          >
            下一步：定义任务
          </button>
        </section>
      ) : step === 2 ? (
        <section className="v3-section">
          <h2>任务与测量蓝图</h2>
          <div className="v3-form-grid">
            <label>
              任务名称
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              目标情境
              <input
                value={context}
                readOnly={!!contextSelection}
                onChange={(e) => setContext(e.target.value)}
                list="contexts"
              />
              <datalist id="contexts">
                <option>大学</option>
                <option>旅行</option>
              </datalist>
            </label>
            <label>
              测量蓝图
              <select
                value={bpId}
                onChange={(e) => {
                  chooseBp(e.target.value);
                  chooseBpVersion("");
                }}
              >
                <option value="">请选择</option>
                {data?.blueprints.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              具体版本
              <select
                value={bv?.id ?? ""}
                onChange={(e) => chooseBpVersion(e.target.value)}
              >
                {bp?.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    V{v.number}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ContextPicker value={contextSelection} onChange={(selection, contextName) => {setContextSelection(selection); if(contextName) setContext(contextName);}} />
          {bv && (
            <>
              <div className="v3-readable">
                <h3>作答说明</h3>
                <p>{bv.instruction}</p>
                <h3>四选项候选等级</h3>
                <p>{bv.levels}</p>
              </div>
              <h3>蓝图核对</h3>
              {errors.length ? (
                <div className="v3-error">
                  {errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              ) : (
                <p className="v3-success">
                  已选来源覆盖 {bv.units.length} 个测量单元，共{" "}
                  {bv.units.reduce((n, u) => n + u.target, 0)} 题。
                </p>
              )}
            </>
          )}
          <p>
            <a href="/settings" target="_blank" rel="noreferrer">
              需要另一套维度或题量？前往项目设置创建蓝图 ↗
            </a>
          </p>
          <button
            className="v3-primary"
            disabled={!name.trim() || !context.trim() || !!errors.length}
            onClick={() => setStep(3)}
          >
            下一步：核对输入
          </button>
        </section>
      ) : (
        <section className="v3-section">
          <h2>核对并冻结任务输入</h2>
          <dl className="v3-facts">
            <dt>任务</dt>
            <dd>
              {name} · {context}
            </dd>
            <dt>条目集</dt>
            <dd>
              {set?.name} / V{version?.number} · {rows.length} 条
            </dd>
            <dt>蓝图</dt>
            <dd>
              {bp?.name} / V{bv?.number}
            </dd>
            <dt>模型连接</dt>
            <dd>尚未连接，可保存任务草稿，不能启动真实调用。</dd>
          </dl>
          <details>
            <summary>高级执行约束（仅保存配置，不产生调用）</summary>
            <div className="v3-form-grid">
              <label>
                预算上限（人民币，选填）
                <input
                  type="number"
                  min={0.01}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </label>
              <label>
                最大自动修订轮数
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                />
              </label>
            </div>
          </details>
          <label className="v3-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            我已核对来源文本、构念定义、蓝图覆盖、作答说明与四选项含义。
          </label>
          <button
            className="v3-primary"
            disabled={
              busy ||
              !reviewed ||
              !!errors.length ||
              (!!budget && Number(budget) <= 0)
            }
            onClick={async () => {
              if (!set || !version || !bp || !bv) return;
              try {
                const x = await act({
                  action: "createTask",
                  contextSelection,
                  name,
                  context,
                  setId: set.id,
                  setVersion: version.id,
                  blueprintId: bp.id,
                  blueprintVersion: bv.id,
                  sourceIds: rows.map((r) => r.sourceId),
                  budget: budget ? Number(budget) : null,
                  maxRevisions: rounds,
                });
                router.push("/workspace?task=" + x.resultId);
              } catch {}
            }}
          >
            保存输入快照并进入任务
          </button>
          <button className="v3-secondary" disabled title="模型尚未连接">
            开始生成
          </button>
        </section>
      )}
    </Shell>
  );
}
