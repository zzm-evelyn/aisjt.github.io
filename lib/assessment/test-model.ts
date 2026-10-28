import { z } from "zod";
import { selectionSchema, type ContextSnapshot } from "./model";
import type { adaptPublication } from "./material";

export type Material = ReturnType<typeof adaptPublication>;
const text = z.string().trim();
const assetId = z.string().uuid().nullable();
export const chapterSchema = z.object({
  id: z.string().uuid(), title: text.min(1).max(100),
  eventIds: z.array(z.string().min(1)).min(1).max(2000),
  backgroundAssetId: assetId,
  overlay: z.number().min(0.3).max(0.85),
  position: z.enum(["center", "top", "bottom"]),
}).strict();
export const testDraftSchema = z.object({
  title: text.min(1).max(120), description: text.max(1000),
  introduction: text.max(6000), instruction: text.max(6000), consent: text.max(8000),
  selection: selectionSchema.nullable(),
  coverAssetId: assetId,
  chapters: z.array(chapterSchema).min(1).max(2000),
  rules: z.object({allowBack: z.boolean(), requireAll: z.literal(true), feedback: z.literal("completion")}).strict(),
}).strict();
export type TestDraft = z.infer<typeof testDraftSchema>;
export type TestRecord = {id:string; revision:number; materialId:string; draft:TestDraft; archived:boolean; createdAt:string; updatedAt:string};
export type Asset = {id:string; hash:string; width:number; height:number; bytes:number; alt:string; createdAt:string};
export type ReleaseContent = {
  schemaVersion:1; draft:TestDraft; contextSnapshot:ContextSnapshot; content:Material["content"];
};
export type TestRelease = {id:string; testId:string; number:number; draftRevision:number; fingerprint:string; createdAt:string; payload:ReleaseContent};
export type TestDetail = {test:TestRecord; material:Material; releases:Omit<TestRelease,"payload">[]};
export type Presentation = {
  title:string; description:string; introduction:string; instruction:string; consent:string;
  audience:string; context:string; coverAssetId:string|null;
  chapters:TestDraft["chapters"]; rules:TestDraft["rules"]; content:Material["content"];
};
export function presentation(draft:TestDraft,content:Material["content"],identity?:ContextSnapshot):Presentation {
  return {title:draft.title,description:draft.description,introduction:draft.introduction,instruction:draft.instruction,consent:draft.consent,
    audience:identity?.audience.name??"未选择身份",context:identity?.context.name??"未选择情境",coverAssetId:draft.coverAssetId,
    chapters:draft.chapters,rules:draft.rules,content};
}

export function checkChapters(draft:TestDraft,material:Material) {
  const expected=material.content.events.map(e=>e.eventId);
  const actual=draft.chapters.flatMap(c=>c.eventIds);
  if(new Set(draft.chapters.map(c=>c.id)).size!==draft.chapters.length) throw new Error("章节标识重复");
  if(JSON.stringify(actual)!==JSON.stringify(expected)) throw new Error("章节必须完整保留材料中的事件及原有顺序");
  if(expected.some(id=>!material.content.story.segments.some(s=>s.eventId===id&&s.text.trim()))) throw new Error("部分事件缺少故事正文，请返回材料核对");
}

export function playerSteps(view:Presentation) {
  return view.chapters.flatMap(chapter=>chapter.eventIds.flatMap(eventId=>{
    const event=view.content.events.find(e=>e.eventId===eventId);
    if(!event) throw new Error("事件引用不存在");
    const story=view.content.story.segments.filter(s=>s.eventId===eventId).map(s=>s.text).join("\n\n");
    return event.itemIds.map(itemId=>{
      const item=view.content.items.find(i=>i.itemId===itemId);
      if(!item) throw new Error("题目引用不存在");
      return {chapter,eventId,story,item};
    });
  }));
}
