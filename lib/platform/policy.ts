import { REVIEW_SLOTS, RUBRIC_DIMENSIONS, type DemoRunFile } from "@/lib/types/domain";

/** Historical source files remain immutable; this view uses the current platform workflow. */
export function platformRun(source: DemoRunFile): DemoRunFile {
  return {...source, stages: source.stages.filter(s=>s.stage_id!=="expert_review"),
    events: source.events.filter(e=>e.stage_id!=="expert_review" && e.stage_id!=="finalize").map((e,i)=>({...e,seq:i+1}))};
}

export function scoringEligibility(run: DemoRunFile, cursor: number, stale=false) {
  if(stale)return {ready:false,reason:"大纲已修改，请重新生成并完成评分。"};
  if(run.run.is_synthetic)return {ready:false,reason:"评分尚未完成。"};
  const rounds=run.reviews.map(r=>r.attempt);
  const attempt=Math.max(0,...rounds);
  const reviews=run.reviews.filter(r=>r.attempt===attempt);
  const visibleRoundCount=run.events.filter(e=>e.seq<=cursor&&e.stage_id==="review_aggregation"&&e.status==="completed").length;
  const allRoundCount=run.events.filter(e=>e.stage_id==="review_aggregation"&&e.status==="completed").length;
  if(!attempt||!allRoundCount||visibleRoundCount<allRoundCount)return {ready:false,reason:"等待三路 AI 评分及规则判定完成。"};
  if(reviews.length!==3||REVIEW_SLOTS.some(slot=>reviews.filter(r=>r.reviewer_slot===slot&&r.status==="completed").length!==1))return {ready:false,reason:"三路 AI 评分记录不完整。"};
  if(reviews.some(r=>r.reviewed_item_version!==run.story.version || r.rubric_version!==run.run.config_snapshot.rubric_version))return {ready:false,reason:"评分版本或评分标准与当前题目不一致。"};
  for(const item of run.items){
    const scores=reviews.map(r=>r.item_scores?.[item.item_id]);
    if(scores.some(s=>!s||RUBRIC_DIMENSIONS.some(d=>![0,1,2].includes(s[d.key]))))return {ready:false,reason:"存在题目或评分维度缺失。"};
    if(RUBRIC_DIMENSIONS.some(d=>scores.some(s=>s?.[d.key]===0)||scores.filter(s=>s?.[d.key]===1).length>=2))return {ready:false,reason:"评分触发修订，请完成修改后重新评分。"};
  }
  return {ready:true,reason:"三路 AI 评分完整，当前版本已通过入库规则。"};
}
