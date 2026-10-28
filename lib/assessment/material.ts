import { createHash } from "node:crypto";
import { contentFingerprint } from "@/lib/studio/model";
import type { Publication } from "@/lib/studio/model";
import { publicationChecks } from "@/lib/studio/checks";

/** Pure adapter. It cannot publish a test or expose a draft task. */
export function adaptPublication(publication: Publication) {
  const task=publication.task, run=task.run;
  const fingerprint=createHash("sha256").update(contentFingerprint(run)+JSON.stringify(task.input)).digest("hex");
  if(fingerprint!==publication.fingerprint) throw new Error("材料快照指纹不匹配");
  const issues=publicationChecks(task);
  if(!run || issues.length) throw new Error("材料未通过发布检查："+issues.join("；"));
  const itemIds=new Set<string>(), eventIds=new Set<string>();
  for(const item of run.items) {
    if(itemIds.has(item.item_id)) throw new Error("题目 ID 重复");
    itemIds.add(item.item_id);
  }
  for(const event of run.outline.events) {
    if(eventIds.has(event.event_id)) throw new Error("事件 ID 重复");
    eventIds.add(event.event_id);
  }
  const occurrences=new Map<string,number>();
  for(const event of run.outline.events) for(const id of event.item_ids) {
    const item=run.items.find(x=>x.item_id===id);
    if(!item || item.event_id!==event.event_id) throw new Error("事件与题目引用不一致");
    occurrences.set(id,(occurrences.get(id)??0)+1);
  }
  if(run.items.some(x=>occurrences.get(x.item_id)!==1)) throw new Error("每题必须且只能关联一个事件");
  if(run.story.segments.some(s=>!eventIds.has(s.event_id))) throw new Error("故事包含未知事件");
  // Field allowlist: source records, scores, levels and review details never enter this DTO.
  const content={
    schemaVersion:1 as const,
    title:run.story.title,
    instruction:task.input.instruction,
    story:{text:run.story.text,segments:run.story.segments.map(s=>({eventId:s.event_id,text:s.text}))},
    events:[...run.outline.events].sort((a,b)=>a.order-b.order).map(e=>({eventId:e.event_id,itemIds:[...e.item_ids]})),
    items:run.items.map(i=>({itemId:i.item_id,eventId:i.event_id,stem:i.stem,options:i.options.map(o=>({optionId:o.option_id,text:o.text}))})),
  };
  return {
    publicationId:publication.id,
    sourceFingerprint:publication.fingerprint,
    contentHash:createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    content,
  };
}
