import { coverage, unitKey, type Task } from "./model";
import { scoringEligibility } from "@/lib/platform/policy";
export function publicationChecks(task: Task) {
  const run = task.run;
  const errors: string[] = [];
  if (!task.outlineConfirmed) errors.push("当前大纲版本尚未确认");
  if (!run) return ["尚无生成内容；模型尚未连接"];
  errors.push(...coverage(task.input.rows, task.input));
  if (task.staleIds.length)
    errors.push(
      `${task.staleIds.length} 道题已修改，等待重新审查与三路评分`,
    );
  const itemIds = new Set(run.items.map((i) => i.item_id));
  const sourceIds = new Set(task.input.rows.map((r) => r.sourceId));
  const eventIds = new Set(run.outline.events.map((e) => e.event_id));
  for (const i of run.items) {
    if (
      i.options.length !== 4 ||
      new Set(i.options.map((o) => o.option_id)).size !== 4
    )
      errors.push(`${i.item_id}：四选项结构错误`);
    if (!sourceIds.has(i.source_item_id) || !eventIds.has(i.event_id))
      errors.push(`${i.item_id}：来源或事件引用无效`);
  }
  for (const e of run.outline.events)
    if (e.item_ids.some((i) => !itemIds.has(i)))
      errors.push(`${e.event_id}：题目引用无效`);
  for (const source of task.input.rows) {
    const mapped=run.items.filter(item=>item.source_item_id===source.sourceId).length;
    if(mapped===0)errors.push(`${source.sourceId}：来源尚无对应题目`);
    if(mapped>1)errors.push(`${source.sourceId}：来源被重复映射，请核对蓝图`);
  }
  const produced = new Map<string, number>();
  for (const i of run.items) {
    const source = task.input.rows.find((r) => r.sourceId === i.source_item_id);
    if (source) {
      if (i.domain !== source.domain || i.facet !== source.facet)
        errors.push(`${i.item_id}：构念映射与输入不一致`);
      const key = unitKey(
        source.domain,
        task.input.usesFacets ? source.facet : "",
      );
      produced.set(key, (produced.get(key) ?? 0) + 1);
    }
  }
  for (const u of task.input.units)
    if (
      produced.get(unitKey(u.domain, task.input.usesFacets ? u.facet : "")) !==
      u.target
    )
      errors.push(`${u.domain}/${u.facet}：生成题量未达到蓝图要求`);
  if (
    run.review_reports.some(
      (r) => r.reviewed_version === run.story.version && r.issues.length > 0,
    )
  )
    errors.push("当前版本存在未处理的内容审查问题");
  const eligibility = scoringEligibility(run, run.events.length, false);
  if (!eligibility.ready) errors.push(eligibility.reason);
  return [...new Set(errors)];
}
