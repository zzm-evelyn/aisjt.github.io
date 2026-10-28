import * as React from "react";
import awaitData from "@/data/runs/university-single-scenarios.json";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GenerationFlow } from "@/components/studio/generation-flow";
import { seedState } from "@/lib/studio/seed";
import { applyAction } from "@/lib/studio/service";
import { buildCollaboration, scoreRound } from "@/lib/studio/collaboration";
import workbook from "@/data/runs/university-single-scenarios.json";

function taskFixture(){const state=seedState();const id=applyAction(state,{action:"openCase"});return state.tasks.find(t=>t.id===id)!;}

it("shows workbook scenarios, routes review and scoring problems back to generators, and allows publication only after a passing round",()=>{
  const task=taskFixture();const before=JSON.stringify(task);
  const plan=buildCollaboration(task.run!);
  const view=render(<GenerationFlow task={task} busy={false} onEdit={vi.fn()} onPublish={vi.fn()}/>);
  const map=screen.getByRole("region",{name:"智能体协作关系"});
  expect(within(map).getByRole("button",{name:/单个情景生成/})).toBeDisabled();
  expect(screen.queryByText(workbook.items[0].scenario)).not.toBeInTheDocument();
  const output=()=>view.container.querySelector(".v3-process-output")!;
  for(let i=0;i<plan.length-1;i++){
    const current=plan[i];
    if(current.agent==="single"&&!current.repair)expect(output().textContent).toContain(workbook.items[0].scenario);
    if(current.agent==="review")expect(output().textContent).toContain(task.run!.review_reports.find(r=>r.report_id===current.reportId)!.issues[0].problem);
    if(current.agent==="router")expect(output().textContent).toContain("返回单个情景生成");
    if(current.repair)expect(output().textContent).toContain("修改前");
    if(current.agent==="scoring"&&current.attempt===1)expect(output().textContent).toContain("8 道题需要修改");
    expect(screen.queryByRole("button",{name:"确认入库"})).not.toBeInTheDocument();
    fireEvent.click(view.container.querySelector(".v3-process-actions .v3-primary")!);
  }
  expect(screen.getByRole("button",{name:"确认入库"})).toBeEnabled();
  expect(JSON.stringify(task)).toBe(before);
  fireEvent.click(screen.getByRole("button",{name:"从输入重新开始"}));
  expect(within(map).getByRole("button",{name:/单个情景生成/})).toBeDisabled();
});

it("keeps score rules unchanged and blocks missing, failed and mismatched rounds",()=>{
  const task=taskFixture();const run=task.run!;
  expect(scoreRound(run,1).tickets).toHaveLength(8);
  expect(scoreRound(run,2).passed).toBe(true);
  const finalOnly=structuredClone(run);finalOnly.reviews=finalOnly.reviews.filter(r=>r.attempt===2);
  const item=run.items[0].item_id;
  finalOnly.reviews[0].item_scores![item].construct=1;
  finalOnly.reviews[1].item_scores![item].construct=1;
  const failed=scoreRound(finalOnly,2);
  expect(failed.tickets.find(t=>t.itemId===item)?.targets).toEqual(["single"]);
  expect(buildCollaboration(finalOnly).some(n=>n.agent==="library")).toBe(false);
  delete finalOnly.reviews[0].item_scores![item];
  expect(scoreRound(finalOnly,2).complete).toBe(false);
  expect(buildCollaboration(finalOnly).at(-1)?.agent).toBe("scoring");
  const mismatch=structuredClone(run);mismatch.reviews.find(r=>r.attempt===2)!.reviewed_item_version="wrong";
  expect(scoreRound(mismatch,2).complete).toBe(false);
});

it("preserves all 60 spreadsheet rows with four options and exact source text matches",()=>{
  const task=taskFixture();
  const normalize=(s:string)=>s.normalize("NFKC").replace(/[\p{P}\p{Z}\s_]/gu,"");
  expect(workbook.items).toHaveLength(60);
  expect(new Set(workbook.items.map(x=>x.sheetRow)).size).toBe(60);
  for(const row of workbook.items){
    expect(row.options).toHaveLength(4);
    expect(normalize(row.sourceText)).toBe(normalize(task.input.rows.find(r=>r.sourceId===row.sourceId)!.text));
    expect(row.scenario.length).toBeGreaterThan(10);
  }
});

vi.mock("@/components/studio/use-single-scenarios", async () => ({ useSingleScenarios: () => ({data:(awaitData),error:"",loading:false}) }));
