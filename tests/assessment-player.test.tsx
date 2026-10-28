import * as React from "react";
import { it,expect } from "vitest";
import { render,screen,fireEvent } from "@testing-library/react";
import { AssessmentPlayer } from "@/components/assessment/player";
import type { Presentation } from "@/lib/assessment/test-model";
const view:Presentation={title:"校园选择",description:"简介",introduction:"故事开场",instruction:"根据实际倾向选择",consent:"仅用于预览",audience:"大学生",context:"大学学习",coverAssetId:null,rules:{allowBack:true,requireAll:true,feedback:"completion"},chapters:[{id:"chapter",title:"校园的一天",eventIds:["event"],backgroundAssetId:null,overlay:0.55,position:"center"}],content:{schemaVersion:1,title:"原材料",instruction:"",story:{text:"正文",segments:[{eventId:"event",text:"你走进图书馆。"}]},events:[{eventId:"event",itemIds:["item-1","item-2"]}],items:[1,2].map(i=>({itemId:`item-${i}`,eventId:"event",stem:`你会如何应对 ${i}？`,options:["a","b","c","d"].map(optionId=>({optionId,text:`选择 ${optionId}`}))}))}};
it("预览需确认说明，选择后继续，可返回修改，完成不提交正式数据",()=>{
  render(<AssessmentPlayer view={view}/>);
  expect(screen.getByRole("button",{name:"进入故事 →"})).toBeDisabled();fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"进入故事 →"}));
  expect(screen.getByText("你走进图书馆。")).toBeInTheDocument();expect(screen.getByRole("button",{name:"下一题 →"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"A 选择 a"}));fireEvent.click(screen.getByRole("button",{name:"下一题 →"}));fireEvent.click(screen.getByRole("button",{name:"上一题"}));
  expect(screen.getByRole("button",{name:"A 选择 a"})).toHaveAttribute("aria-pressed","true");fireEvent.click(screen.getByRole("button",{name:"下一题 →"}));fireEvent.click(screen.getByRole("button",{name:"B 选择 b"}));fireEvent.click(screen.getByRole("button",{name:"完成预览"}));
  expect(screen.getByText("本次预览选择未记录为正式作答。")).toBeInTheDocument();
});
