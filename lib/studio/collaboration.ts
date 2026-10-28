import type { DemoRunFile, ReviewResult } from "@/lib/types/domain";
import { RUBRIC_DIMENSIONS, REVIEW_SLOTS } from "@/lib/types/domain";

export type AgentId = "input" | "single" | "outline" | "story" | "review" | "router" | "scoring" | "library";
export const AGENT_LABELS: Record<AgentId, string> = {
  input: "来源输入", single: "单个情景生成", outline: "事件大纲",
  story: "故事生成", review: "审查智能体", router: "修订判断智能体",
  scoring: "三模型评分", library: "题目入库",
};
export type RepairTarget = "single" | "story";
export type RepairTicket = {
  itemId: string; problem: string; targets: RepairTarget[];
  reason: string; before?: string; after?: string;
};
export type RoundResult = { complete: boolean; passed: boolean; tickets: RepairTicket[]; reason: string };
export type CollaborationNode = {
  id: string; agent: AgentId; title: string; description: string;
  reportId?: string; attempt?: number; version?: string;
  tickets?: RepairTicket[]; repair?: boolean; roundResult?: RoundResult;
};
/** Reserved contract for a future model adapter; archived execution does not call an LLM. */
export type RevisionRoutingRequest = {
  taskId: string; version: string; source: "review" | "scoring";
  problems: RepairTicket[];
};
export type RevisionRoutingResponse = { version: string; decisions: RepairTicket[] };

export function scoreRound(run: DemoRunFile, attempt: number): RoundResult {
  const reviews = run.reviews.filter(r => r.attempt === attempt);
  const incomplete = (reason: string): RoundResult => ({complete:false, passed:false, tickets:[], reason});
  if (reviews.length !== 3 || REVIEW_SLOTS.some(slot => reviews.filter(r=>r.reviewer_slot===slot && r.status==="completed").length!==1))
    return incomplete("等待三模型完成独立评分。");
  if (new Set(reviews.map(r=>r.reviewed_item_version)).size!==1 || reviews.some(r=>r.rubric_version!==run.run.config_snapshot.rubric_version))
    return incomplete("评分版本或评分标准不一致，需要核对。");
  const tickets: RepairTicket[] = [];
  for (const item of run.items) {
    const scores=reviews.map(r=>r.item_scores?.[item.item_id]);
    if(scores.some(s=>!s || RUBRIC_DIMENSIONS.some(d=>![0,1,2].includes(s[d.key])))) return incomplete(`${item.item_id} 的评分记录未齐。`);
    const failed=RUBRIC_DIMENSIONS.filter(d=>scores.some(s=>s![d.key]===0) || scores.filter(s=>s![d.key]===1).length>=2);
    if(!failed.length) continue;
    const targets = new Set<RepairTarget>();
    for (const d of failed) {
      if(d.key==="construct") targets.add("single");
      else if(d.key==="narrative") targets.add("story");
      else { targets.add("single"); targets.add("story"); }
    }
    const example=run.scoring_examples.find(e=>e.round===attempt && e.scenario_id===item.item_id && e.outcome==="revised");
    tickets.push({itemId:item.item_id,problem:failed.map(d=>d.label).join("、")+"触发修订规则", targets:[...targets],
      reason:failed.some(d=>d.key==="fairness"||d.key==="realism")?"公平性或现实可行性涉及情景与正文，交由两个生成智能体协同修改。":failed.map(d=>d.key==="construct"?"构念问题返回单个情景生成":"叙事问题返回故事生成").join("；"),
      before:example?.before,after:example?.after});
  }
  return {complete:true,passed:!tickets.length,tickets,reason:tickets.length?`${tickets.length} 道题需要修改。`:"三模型评分达标，可进入入库检查。"};
}

export function buildCollaboration(run: DemoRunFile): CollaborationNode[] {
  const nodes: CollaborationNode[] = [
    {id:"input",agent:"input",title:"来源输入",description:"核对原始条目与测量范围，为生成智能体提供输入。"},
    {id:"single",agent:"single",title:"单个情景生成",description:"将每个原始条目转化为独立情景、题干及四个行为选项。"},
    {id:"outline",agent:"outline",title:"事件大纲",description:"组织独立情景，确定事件顺序与衔接。"},
    {id:"story",agent:"story",title:"故事生成",description:"故事生成智能体将事件串联成连续正文，保留题目与来源对应。"},
  ];
  function routeAndRepair(prefix:string,tickets:RepairTicket[],version:string|undefined,description:string){
    nodes.push({id:prefix+"-route",agent:"router",title:"修订判断与任务分发",description,tickets,version});
    for(const agent of ["single","story"] as const){
      const relevant=tickets.filter(t=>t.targets.includes(agent));
      if(relevant.length) nodes.push({id:prefix+"-"+agent,agent,title:AGENT_LABELS[agent]+" · 返回修改",description:agent==="single"?"接收修订任务，调整情景、题干或选项中的构念表达。":"接收修订任务，调整正文中的时间、空间、因果及情景衔接。",tickets:relevant,repair:true,version});
    }
  }
  for(const report of [...run.review_reports].sort((a,b)=>a.attempt-b.attempt)){
    nodes.push({id:report.report_id,agent:"review",title:`审查智能体 · 第 ${report.attempt} 轮`,description:"审查正文、题干和选项，提出可定位的修改问题。",reportId:report.report_id,version:report.reviewed_version});
    const revision=run.revisions.find(r=>r.from_version===report.reviewed_version);
    const tickets:RepairTicket[]=report.issues.map(i=>({itemId:i.scenario_id,problem:i.problem,targets:[i.target_stage==="item_transformation"?"single":"story"],reason:i.target_stage==="item_transformation"?"审查记录指向情景、题干或选项，由单个情景生成智能体修改。":"审查记录指向正文逻辑，由故事生成智能体修改。",before:i.before,after:i.after}));
    if(tickets.length) routeAndRepair(report.report_id,tickets,revision?.to_version,"依据审查问题分发修改任务，完成后继续复审或三模型评分。");
  }
  const rounds=[...new Set(run.reviews.map(r=>r.attempt))].sort((a,b)=>a-b);
  for(const attempt of rounds){
    const result=scoreRound(run,attempt);
    const reviews:ReviewResult[]=run.reviews.filter(r=>r.attempt===attempt);
    nodes.push({id:`score-${attempt}`,agent:"scoring",title:`三模型评分 · 第 ${attempt} 轮`,description:"三模型独立按 0／1／2 分评分；任一维度出现 0 分，或同一维度至少两个 1 分，即返回修订。",attempt,version:reviews[0]?.reviewed_item_version,roundResult:result});
    if(!result.complete) return nodes;
    if(result.passed){nodes.push({id:"library",agent:"library",title:"题目入库",description:"评分达标后核对完整内容包，保存不可变版本并导出。"});return nodes;}
    routeAndRepair(`score-${attempt}`,result.tickets,run.revisions.find(r=>r.from_version===reviews[0]?.reviewed_item_version)?.to_version,"依据未达标维度判断修改位置，返回生成智能体修改，再提交三模型复评。");
  }
  // No passing round means no path to publication, even when archived stages say completed.
  return nodes;
}
