"use client";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspace-store";
import { canAdvance } from "@/lib/replay/engine";
export function ReplayControls(){
 const s=useWorkspaceStore();if(!s.baseRun)return null;
 const total=s.baseRun.events.length;
 const can=canAdvance(s.baseRun,s.cursor,s.overlay?.outlineConfirmed??false);
 return <div className="platform-actions"><button type="button" onClick={s.togglePlay} disabled={!s.playing&&!can} aria-label={s.playing?"暂停任务":"启动任务"}>{s.playing?<Pause size={15}/>:<Play size={15}/>} {s.playing?"暂停任务":s.cursor===0?"启动任务":"继续任务"}</button><button type="button" onClick={s.resetReplay} aria-label="重置任务"><RotateCcw size={15}/> 重置</button><div className="platform-progress"><span>任务进度</span><progress max={total} value={s.cursor}/><span>{Math.round(s.cursor/total*100)}%</span></div></div>;
}
