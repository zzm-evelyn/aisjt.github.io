"use client";
import * as React from "react";
import Link from "next/link";
import type { Task } from "@/lib/studio/model";
import { RUBRIC_DIMENSIONS } from "@/lib/types/domain";
import { publicationChecks } from "@/lib/studio/checks";
import { AGENT_LABELS, buildCollaboration, type AgentId, type RepairTicket } from "@/lib/studio/collaboration";
import { useSingleScenarios } from "@/components/studio/use-single-scenarios";

const mainPath:AgentId[]=["input","single","outline","story","review","scoring","library"];
function normalized(s:string){return s.normalize("NFKC").replace(/[\p{P}\p{Z}\s_]/gu,"");}
function RepairCards({tickets,showChanges=false}:{tickets:RepairTicket[];showChanges?:boolean}){
  return <>{tickets.map((t,i)=><article className="v3-repair-card" key={t.itemId+i}>
    <div className="v3-section-title"><strong>{t.itemId}</strong><span className="v3-routing-badge">{t.targets.map(a=>AGENT_LABELS[a]).join(" + ")}</span></div>
    <p>{t.problem}</p><p className="v3-muted">{t.reason}</p>
    {showChanges && (t.before||t.after?<div className="v3-before-after"><div><small>修改前</small><p className="v3-preserve-lines">{t.before||"未单独保存"}</p></div><div><small>修改后</small><p className="v3-preserve-lines">{t.after||"未单独保存"}</p></div></div>:<p className="v3-muted">此题未保存独立的修改前后片段，最终内容见完整题目包。</p>)}
  </article>)}</>;
}
export function GenerationFlow({task,onEdit,onPublish,busy}:{task:Task;onEdit:()=>void;onPublish:()=>void;busy:boolean}){
  const {data:singleScenarios,error:scenarioError,loading:scenarioLoading}=useSingleScenarios();
  const [cursor,setCursor]=React.useState(0);
  const [unlocked,setUnlocked]=React.useState(0);
  const [selected,setSelected]=React.useState("all");
  const run=task.run!;
  const nodes=React.useMemo(()=>buildCollaboration(run),[run]);
  const node=nodes[Math.min(cursor,nodes.length-1)];
  const next=nodes[cursor+1];
  const checks=publicationChecks(task);
  const report=run.review_reports.find(r=>r.report_id===node.reportId);
  const reviews=run.reviews.filter(r=>r.attempt===node.attempt);
  const revision=run.revisions.find(r=>r.to_version===node.version);
  const sourceRows=task.input.rows.filter(r=>selected==="all"||r.sourceId===selected);
  const scenarios=sourceRows.map(source=>({source,scenario:singleScenarios.items.find(i=>i.sourceId===source.sourceId&&normalized(i.sourceText)===normalized(source.text))}));
  const hasScenarios=scenarios.every(x=>x.scenario);
  const targets=run.stages.flatMap(s=>Array.isArray(s.output?.behavioral_targets)?s.output.behavioral_targets as {source_item_id:string;behavioral_description:string}[]:[]);
  function go(index:number){setCursor(index);setSelected("all");}
  function advance(){if(next){setUnlocked(Math.max(unlocked,cursor+1));go(cursor+1);}}
  function actionLabel(){
    if(!next)return node.agent==="library"?"从输入重新开始":"等待后续评分记录";
    if(next.agent==="router")return "提交修订判断智能体";
    if(next.repair)return `返回${AGENT_LABELS[next.agent]}进行修改`;
    if(next.agent==="review")return cursor>4?"提交审查智能体复审":"提交审查智能体";
    if(next.agent==="scoring")return next.attempt===1?"启动三模型独立评分":"修改完成，提交三模型复评";
    if(next.agent==="library")return "评分达标，进入题目入库";
    if(next.agent==="single")return "生成单个情景";
    if(next.agent==="outline")return "组织事件大纲";
    if(next.agent==="story")return "确认大纲，生成故事";
    return `继续：${next.title}`;
  }
  return <>
    <div className="v3-task-top"><div><Link href="/" className="v3-back">← 任务中心</Link><h1>{task.name}</h1><p>{task.context} · {task.input.rows.length} 条来源 · 智能体协作流程</p></div><button className="v3-secondary" onClick={onEdit}>内容编辑与依据</button></div>
    <section className="v3-agent-map" aria-label="智能体协作关系">
      <div className="v3-agent-mainpath">{mainPath.map((agent,i)=>{
        const seen=nodes.map((n,index)=>({n,index})).filter(x=>x.n.agent===agent&&x.index<=unlocked);
        const active=node.agent===agent;
        return <React.Fragment key={agent}>{i>0&&<span className="v3-agent-arrow" aria-hidden="true">→</span>}<button disabled={!seen.length} aria-current={active?"step":undefined} onClick={()=>go(seen.at(-1)!.index)}><small>{i+1<6?`0${i+1}`:agent==="scoring"?"A · B · C":"入库"}</small>{AGENT_LABELS[agent]}</button></React.Fragment>;
      })}</div>
      <div className={"v3-agent-return "+(node.agent==="router"||node.repair?"is-active":"")}><span>审查问题 / 评分未达标</span><b>↓</b><strong>修订判断智能体</strong><b>→</b><span>单个情景生成 / 故事生成</span><b>↩</b><span>复审与三模型复评</span></div>
    </section>
    <div className="v3-collaboration-layout">
      <aside className="v3-agent-log" aria-label="协作记录"><h2>协作记录</h2><p>每轮问题、分发与修改单独保留。</p><div>{nodes.slice(0,unlocked+1).map((n,i)=><button key={n.id} aria-current={i===cursor?"step":undefined} onClick={()=>go(i)}><small>{String(i+1).padStart(2,"0")} · {n.version||AGENT_LABELS[n.agent]}</small><strong>{n.title}</strong>{n.tickets&&<span>{n.tickets.length} 项修改任务</span>}</button>)}</div></aside>
      <section className="v3-process-main">
        <header><div className="v3-section-title"><small>{AGENT_LABELS[node.agent]}{node.version?` · ${node.version}`:""}</small><small>协作环节 {cursor+1}</small></div><h2>{node.title}</h2><p>{node.description}</p></header>
        <div className="v3-process-output" key={node.id}>
          {node.agent==="input"&&<><div className="v3-process-summary"><span><b>{task.input.rows.length}</b>来源条目</span><span><b>{task.input.units.length}</b>测量单元</span><span><b>{task.input.units.reduce((n,u)=>n+u.target,0)}</b>目标题数</span></div><h3>作答说明</h3><p>{task.input.instruction}</p>{task.input.rows.map((r,i)=><article key={r.sourceId}><small>{i+1} · {r.facet||r.domain}</small><p>{r.text}</p></article>)}</>}
          {node.agent==="single"&&!node.repair&&<><div className="v3-section-title"><p>{hasScenarios?`${singleScenarios.filename} · 工作表 ${singleScenarios.sheet}`:"已保存的单个情景材料"}</p><select aria-label="选择来源条目" value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">全部情景</option>{task.input.rows.map((r,i)=><option key={r.sourceId} value={r.sourceId}>{i+1}. {r.text}</option>)}</select></div>{scenarioLoading ? <p>正在读取单个情景材料…</p> : scenarioError ? <p role="alert">{scenarioError}</p> : scenarios.map(({source,scenario},i)=><article key={source.sourceId}><small>{i+1} · {source.facet||source.domain}{scenario?` · Excel 第 ${scenario.sheetRow} 行`:""}</small><h3>原始条目</h3><p>{source.text}</p>{scenario?<><h3>生成情景</h3><p>{scenario.scenario}</p><div className="v3-process-question"><strong>{scenario.stem}</strong>{scenario.options.map((o,j)=><p key={j}>{String.fromCharCode(65+j)}. {o.replace(/^[A-D][.．、]\s*/,"")}</p>)}</div></>:<p>{targets.find(t=>t.source_item_id===source.sourceId)?.behavioral_description||"此来源未单独保存情景生成记录。"}</p>}</article>)}</>}
          {node.agent==="outline"&&run.outline.events.map((e,i)=><article key={e.event_id}><small>事件 {i+1} · {e.source_item_ids.length} 条来源</small><p>{e.description}</p></article>)}
          {node.agent==="story"&&!node.repair&&<><h3>{run.story.title}</h3><p className="v3-muted">正文存档版本 {run.story.version} · 审查与修改记录按原轮次展示。</p>{run.story.segments.map((s,i)=><article key={s.event_id}><small>情境 {i+1}</small><p>{s.text}</p>{run.items.filter(x=>x.event_id===s.event_id).map(item=><div className="v3-process-question" key={item.item_id}><strong>{item.stem}</strong>{item.options.map((o,j)=><p key={o.option_id}>{String.fromCharCode(65+j)}. {o.text}</p>)}</div>)}</article>)}</>}
          {node.agent==="review"&&report&&<><div className="v3-process-summary"><span><b>{report.checked_count}</b>审查情景</span><span><b>{report.issues.length}</b>已记录的问题明细</span><span><b>{report.reviewed_version}</b>审查版本</span></div><p>{report.summary}</p>{report.issues.map(i=><article key={i.issue_id}><small>{i.scenario_id} · {i.category}</small><h3>{i.problem}</h3><p className="v3-preserve-lines">{i.before}</p></article>)}<p className="v3-muted">问题提交给修订判断智能体，再分发到负责修改的生成智能体。</p></>}
          {node.agent==="router"&&<><div className="v3-process-summary"><span><b>{node.tickets?.length??0}</b>待分发问题</span><span><b>{node.tickets?.filter(t=>t.targets.includes("single")).length??0}</b>返回单个情景生成</span><span><b>{node.tickets?.filter(t=>t.targets.includes("story")).length??0}</b>返回故事生成</span></div><p>构念、题干及选项问题返回单个情景生成；正文衔接问题返回故事生成；涉及两者的问题协同修改。</p><RepairCards tickets={node.tickets??[]}/><details><summary>查看分发依据</summary><p>当前依据案例审查记录及评分维度进行规则分发；真实修订判断模型接口已预留，尚未调用。</p></details></>}
          {node.repair&&<><p className="v3-routing-notice">修订判断智能体 → {AGENT_LABELS[node.agent]} → {next?.agent==="review"?"审查智能体复审":next?.agent==="scoring"?(next.attempt===1?"三模型评分":"三模型复评"):next?.repair?"协同修改":"后续评分"}</p><RepairCards tickets={node.tickets??[]} showChanges/>{revision&&<details><summary>{revision.from_version} → {revision.to_version} · 本轮修订记录</summary><p>{revision.reason}</p><div className="v3-before-after"><div><small>修改前</small><p className="v3-preserve-lines">{revision.before_text}</p></div><div><small>修改后</small><p className="v3-preserve-lines">{revision.after_text}</p></div></div></details>}</>}
          {node.agent==="scoring"&&<><div className="v3-process-summary">{["review_a","review_b","review_c"].map(s=><span key={s}><b>模型 {s.at(-1)?.toUpperCase()}</b>{reviews.find(r=>r.reviewer_slot===s)?.status==="completed"?"评分完成":"等待评分"}</span>)}</div><p className={node.roundResult?.passed?"v3-success":"v3-routing-notice"}>{node.roundResult?.reason}</p>{!!node.roundResult?.tickets.length&&<p>需修改：{node.roundResult.tickets.map(t=>t.itemId).join("、")}。下一步交由修订判断智能体分发。</p>}<div className="v3-table-scroll"><table><thead><tr><th>题目</th><th>模型 A</th><th>模型 B</th><th>模型 C</th><th>规则判定</th></tr></thead><tbody>{run.items.map(item=><tr key={item.item_id}><td>{item.item_id}</td>{["review_a","review_b","review_c"].map(s=><td key={s}>{RUBRIC_DIMENSIONS.map(d=><span className="v3-score-cell" key={d.key}>{d.label} {reviews.find(r=>r.reviewer_slot===s)?.item_scores?.[item.item_id]?.[d.key]??"—"}</span>)}</td>)}<td>{!node.roundResult?.complete?"待核对":node.roundResult.tickets.some(t=>t.itemId===item.item_id)?"返回修订":"达标"}</td></tr>)}</tbody></table></div><p className="v3-muted">内容评分用于题目开发，不能替代后续测量学检验。</p></>}
          {node.agent==="library"&&<><h3>{task.status==="published"?"题目包已入库":checks.length?"入库前检查":"已满足入库条件"}</h3>{checks.length?<ul>{checks.map((c,i)=><li key={i}>{c}</li>)}</ul>:<p className="v3-success">来源覆盖、题目结构、三模型评分和版本记录检查通过。</p>}<p>{run.items.length} 道题目 · 连续故事 · 来源与评分记录</p>{task.status!=="published"&&<button className="v3-primary" disabled={busy||checks.length>0} onClick={onPublish}>确认入库</button>}<Link className="v3-secondary" href="/library">查看题目库与导出 →</Link></>}
        </div>
        <footer className="v3-process-actions"><div><small>智能体协作记录</small><p>{node.agent==="router"||node.repair?"问题分发 → 返回修改 → 复审 / 复评":"按阶段展开已保存的生成与修订材料。"}</p></div><div className="v3-action-bar">{cursor>0&&<button className="v3-secondary" onClick={()=>go(cursor-1)}>上一步</button>}<button className={node.agent==="library"?"v3-secondary":"v3-primary"} disabled={!next&&node.agent!=="library"} onClick={()=>node.agent==="library"?(()=>{setUnlocked(0);go(0);})():advance()}>{actionLabel()}{next?" →":""}</button></div></footer>
      </section>
    </div>
  </>;
}
