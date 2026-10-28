import * as React from "react";
import awaitData from "@/data/runs/university-single-scenarios.json";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { StudioState } from "@/lib/studio/model";
import type { StudioAction } from "@/lib/studio/service";
import { seedState } from "@/lib/studio/seed";
import { applyAction } from "@/lib/studio/service";

const control=vi.hoisted(()=>({taskId:"",state:null as StudioState|null,requests:[] as StudioAction[]}));
vi.mock("next/navigation",()=>({usePathname:()=>"/workspace",useSearchParams:()=>new URLSearchParams("task="+control.taskId),useRouter:()=>({push:()=>{}})}));
vi.mock("@/components/studio/use-studio",()=>({safeAction:(p:Promise<unknown>)=>void p.catch(()=>{}),useStudio:()=>({data:control.state,error:"",busy:false,act:async(a:StudioAction)=>{control.requests.push(a);const next=structuredClone(control.state!);const {applyAction}=await import("@/lib/studio/service");const resultId=applyAction(next,a);control.state=next;return {state:next,resultId};}})}));
import Workspace from "@/app/workspace/page";

describe("task-switch draft isolation",()=>{
 it("switches task query in place and saves only into the new candidate",async()=>{
  const state=seedState();const original=applyAction(state,{action:"openCase"});const candidate=applyAction(state,{action:"cloneTask",id:original});control.state=state;control.taskId=original;control.requests=[];
  const originalStem=state.tasks.find(t=>t.id===original)!.run!.items[0].stem;
  const view=render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"内容编辑与依据"}));
  fireEvent.click(screen.getByRole("button",{name:/2\s*情景与题目/}));
  fireEvent.click(screen.getByRole("button",{name:"题目编辑"}));
  expect(screen.getByRole("textbox",{name:"题干"})).toHaveValue(originalStem);
  control.taskId=candidate;view.rerender(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"内容编辑与依据"}));
  fireEvent.click(screen.getByRole("button",{name:/2\s*情景与题目/}));
  fireEvent.click(screen.getByRole("button",{name:"题目编辑"}));
  fireEvent.change(screen.getByRole("textbox",{name:"题干"}),{target:{value:"仅修改新候选的题干"}});
  await waitFor(()=>expect(control.requests.some(a=>a.action==="editTask"&&a.id===candidate)).toBe(true),{timeout:4000});
  expect(control.requests.filter(a=>a.action==="editTask").every(a=>a.id===candidate)).toBe(true);
  expect(control.state!.tasks.find(t=>t.id===original)!.run!.items[0].stem).toBe(originalStem);
  expect(control.state!.tasks.find(t=>t.id===candidate)!.run!.items[0].stem).toBe("仅修改新候选的题干");
 });
});

vi.mock("@/components/studio/use-single-scenarios", async () => ({ useSingleScenarios: () => ({data:(awaitData),error:"",loading:false}) }));
