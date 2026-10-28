"use client";
import { useLibraryStore } from "@/lib/store/library-store";
import { scoringEligibility } from "@/lib/platform/policy";
import { ArrowRight, Check, CirclePause, Play, StepForward } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import { deriveStageStates, lockedGate, canAdvance } from "@/lib/replay/engine";
import { STAGE_SHORT_LABELS, type StageId } from "@/lib/types/domain";
import { NodeDetailPanel } from "@/components/panels/node-detail-panel";

const groups:{title:string;description:string;stages:StageId[]}[]=[
 {title:"测量目标",description:"查看原始条目，以及对应的行为化目标。",stages:["intake","item_transformation"]},
 {title:"情境与题目",description:"确认事件大纲，再查看连续故事与四个行为选项。",stages:["outline_generation","outline_confirmation","story_generation"]},
 {title:"审查与修订",description:"检查内容问题、独立评分和每轮定向修改。",stages:["review_agent","review_a","review_b","review_c","review_aggregation","auto_revision"]},
 {title:"题目入库",description:"三路评分通过规则判定后，保存到题目库。",stages:["finalize"]}
];

export function GuidedWorkspace(){
 const entries=useLibraryStore(s=>s.entries);
 const state=useWorkspaceStore();
 const {baseRun:run,cursor,overlay,selectedNodeId,selectNode}=state;
 if(!run)return <div className="p-8 text-muted">正在准备当前项目…</div>;
 const states=deriveStageStates(run,cursor,overlay);
 states.finalize.status=entries.some(e=>e.id===run.run.run_id+":"+run.story.version)?"completed":scoringEligibility(run,cursor,overlay?.stale??false).ready?"waiting_human":"not_started";
 const group=groups.find(g=>g.stages.includes(selectedNodeId))??groups[0];
 const gate=lockedGate(run,cursor,overlay?.outlineConfirmed??false);
 const next=canAdvance(run,cursor,overlay?.outlineConfirmed??false);
 const event=run.events.find(e=>e.seq===cursor);
 return <main className="guided-workspace">
 <div className="guided-title"><div><p className="eyebrow">SJT 生成工作台</p><h1>从条目到题目，逐步展开</h1><p>启动任务后逐步完成生成、审查与评分；事件大纲需确认后继续。</p></div><span className="material-label">{run.run.is_synthetic?"待评分项目":"当前项目"} · {run.items.length} 道题目</span></div>
 <div className="guided-layout"><aside className="guide-sidebar"><div className="guide-step-list">{groups.map((g,i)=>{const completed=g.stages.every(s=>states[s].status==="completed");return <button type="button" key={g.title} className={g===group?"guide-step selected":"guide-step"} onClick={()=>selectNode(g.stages[0])} aria-current={g===group?"step":undefined}><span className="guide-step-index">{completed?<Check size={16}/>:String(i+1).padStart(2,"0")}</span><span><strong>{g.title}</strong><small>{g.description}</small></span><ArrowRight size={14}/></button>})}</div><div className="guide-note"><strong>流程说明</strong><p>先确认事件大纲，再生成故事与题目。三路 AI 独立评分，通过规则判定后可入库。</p><p>需要查看完整节点、来源和日志时，切换到“流程视图”。</p></div></aside>
 <section className="guide-content"><div className="guide-status" role="status"><span>{gate?<CirclePause size={19}/>:<Play size={18}/>}</span><div><strong>{gate?("请确认事件大纲"):cursor===0?"准备就绪，等待启动任务":cursor>=run.events.length?"任务阶段已完成":state.playing?"正在处理任务":"任务已暂停"}</strong><p>{gate?gate.message:event?.message??"检查来源条目与测量目标，启动任务后进入生成流程。"}</p></div>{gate?<button type="button" onClick={()=>selectNode(gate.stage_id)}>查看待办 <ArrowRight size={14}/></button>:<button type="button" disabled={!next} onClick={state.step}>下一步 <StepForward size={14}/></button>}</div>
 {overlay?.stale?<div className="guide-stale">大纲已在本地调整，后续结果基于旧大纲，需重新生成后才能用于新版本。</div>:null}
 <nav className="guide-subnav" aria-label="环节详情">{group.stages.map(id=><button type="button" key={id} aria-pressed={id===selectedNodeId} className={id===selectedNodeId?"active":""} onClick={()=>selectNode(id)}>{STAGE_SHORT_LABELS[id]}</button>)}</nav>
 <div className="guide-detail"><NodeDetailPanel/></div></section></div></main>;
}
