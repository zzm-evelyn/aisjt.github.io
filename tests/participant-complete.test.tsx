import * as React from "react";
import { it,expect,vi } from "vitest";
import { render,screen } from "@testing-library/react";
import { ParticipantComplete } from "@/components/participant/complete";
vi.mock("@/components/participant/api",()=>({participantJson:async()=>({id:"s1",status:"in_progress",title:"未提交测验"})}));
it("不能仅凭进入完成页就显示提交成功",async()=>{render(<ParticipantComplete id="s1"/>);expect(await screen.findByText("本次作答尚未提交")).toBeInTheDocument();expect(screen.queryByText("提交成功")).not.toBeInTheDocument();expect(screen.getByRole("link",{name:"继续作答"})).toHaveAttribute("href","/test/session/s1");});
