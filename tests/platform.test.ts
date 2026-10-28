import { describe, it, expect } from "vitest";
import { loadRecordedRun, loadSyntheticRun } from "@/lib/demo/load";
import { platformRun, scoringEligibility } from "@/lib/platform/policy";
import { useLibraryStore } from "@/lib/store/library-store";

describe("AI scoring to item library",()=>{
 const source=loadRecordedRun();const run=platformRun(source);const end=run.events.length;
 it("removes expert steps without mutating source records",()=>{
  expect(source.events.some(e=>e.stage_id==="expert_review")).toBe(true);
  expect(run.events.some(e=>e.stage_id==="expert_review")).toBe(false);
  expect(run.stages.some(e=>e.stage_id==="expert_review")).toBe(false);
  expect(run.events.map(e=>e.seq)).toEqual(run.events.map((_,i)=>i+1));
 });
 it("allows a fully scored passing version without expert approval",()=>{
  expect(run.expert_decision.decision).toBe("pending");
  expect(scoringEligibility(run,end).ready).toBe(true);
 });
 it("rejects future scoring, modified outlines, and unscored sample projects",()=>{
  expect(scoringEligibility(run,0).ready).toBe(false);
  expect(scoringEligibility(run,end,true).ready).toBe(false);
  expect(scoringEligibility(platformRun(loadSyntheticRun()),100).ready).toBe(false);
 });
 it("rejects missing reviewers, missing dimensions, mixed versions and revision triggers",()=>{
  for(const mutate of [
   (r:typeof run)=>{r.reviews=r.reviews.filter(x=>!(x.attempt===2&&x.reviewer_slot==="review_c"));},
   (r:typeof run)=>{delete r.reviews.find(x=>x.attempt===2)!.item_scores![r.items[0].item_id].construct;},
   (r:typeof run)=>{r.reviews.find(x=>x.attempt===2)!.reviewed_item_version="v3";},
   (r:typeof run)=>{r.reviews.find(x=>x.attempt===2)!.item_scores![r.items[0].item_id].construct=0;}
  ]){const changed=structuredClone(run);mutate(changed);expect(scoringEligibility(changed,end).ready).toBe(false);}
 });
 it("persists one immutable library entry and refuses duplicate or stale saves",()=>{
  useLibraryStore.setState({entries:[]});
  expect(useLibraryStore.getState().add(run,end,false)).toBe(true);
  expect(useLibraryStore.getState().add(run,end,false)).toBe(true);
  expect(useLibraryStore.getState().entries).toHaveLength(1);
  expect(useLibraryStore.getState().entries[0].run).not.toBe(run);
  expect(useLibraryStore.getState().add(run,end,true)).toBe(false);
 });
});
