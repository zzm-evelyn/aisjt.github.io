"use client";
import { useMemo,useState } from "react";
import { playerSteps,type Presentation } from "@/lib/assessment/test-model";

export function AssessmentPlayer({view}:{view:Presentation}) {
  const steps=useMemo(()=>playerSteps(view),[view]);
  const [started,setStarted]=useState(false),[index,setIndex]=useState(0),[answers,setAnswers]=useState<Record<string,string>>({}),[completed,setCompleted]=useState(false),[consented,setConsented]=useState(false);
  const step=steps[index],answered=Object.keys(answers).length;
  const assetId=started&&!completed?step?.chapter.backgroundAssetId:view.coverAssetId;
  const overlay=started&&!completed?step?.chapter.overlay??0.55:0.55;
  const background=assetId?{backgroundImage:`linear-gradient(rgba(10,30,55,${overlay}),rgba(10,30,55,${overlay})),url(/api/admin/assets/${assetId})`,backgroundPosition:started?step?.chapter.position:"center"}:{};
  function restart(){setStarted(false);setIndex(0);setAnswers({});setCompleted(false);setConsented(false);}
  const previousEvents=[...new Set(steps.slice(0,index).map(s=>s.eventId))].filter(id=>id!==step?.eventId);
  return <div className="assessment-player" style={background}>
    <div className="assessment-player-top"><span>情景判断测验</span><span>{view.context}</span></div>
    {!started?<section className="assessment-welcome"><p className="assessment-eyebrow">{view.audience} · {steps.length} 道选择</p><h1>{view.title}</h1><p>{view.description}</p><div className="assessment-reading"><p className="v3-preserve-lines">{view.introduction}</p><h2>作答说明</h2><p className="v3-preserve-lines">{view.instruction||"尚未填写作答说明"}</p>{view.consent&&<><h2>参与说明</h2><p className="v3-preserve-lines">{view.consent}</p><label className="assessment-consent"><input type="checkbox" checked={consented} onChange={e=>setConsented(e.target.checked)}/>我已阅读说明，愿意开始</label></>}</div><button className="assessment-action" disabled={!steps.length||(!!view.consent&&!consented)} onClick={()=>setStarted(true)}>进入故事 →</button></section>:
    completed?<section className="assessment-welcome"><p className="assessment-eyebrow">作答预览</p><h1>已走完整个测验</h1><p>本次预览选择未记录为正式作答。</p><button className="assessment-action" onClick={restart}>重新预览</button></section>:
    step&&<main className="assessment-session"><div className="assessment-progress"><div><span>{step.chapter.title}</span><span>已选择 {answered} / {steps.length}</span></div><progress max={steps.length} value={answered} aria-label="作答进度"/></div>
      <section className="assessment-question-card"><p className="assessment-eyebrow">{view.title} · 第 {index+1} 题</p><h1>{step.chapter.title}</h1><div className="assessment-story v3-preserve-lines">{step.story}</div>
      {previousEvents.length>0&&<details className="assessment-history"><summary>回顾前文</summary>{previousEvents.map(id=><p key={id} className="v3-preserve-lines">{view.content.story.segments.filter(s=>s.eventId===id).map(s=>s.text).join("\n\n")}</p>)}</details>}
      <h2 className="assessment-question">{step.item.stem}</h2><div className="assessment-options" role="group" aria-label="请选择最符合你的行为">{step.item.options.map((o,i)=><button key={o.optionId} aria-label={`${String.fromCharCode(65+i)} ${o.text}`} aria-pressed={answers[step.item.itemId]===o.optionId} onClick={()=>setAnswers(old=>({...old,[step.item.itemId]:o.optionId}))}><span>{String.fromCharCode(65+i)}</span><span>{o.text}</span></button>)}</div>
      <div className="assessment-step-actions">{view.rules.allowBack&&<button disabled={index===0} onClick={()=>setIndex(i=>i-1)}>上一题</button>}<button className="assessment-action" disabled={!answers[step.item.itemId]} onClick={()=>{if(index===steps.length-1)setCompleted(true);else setIndex(i=>i+1);}}>{index===steps.length-1?"完成预览":"下一题 →"}</button></div></section>
    </main>}
  </div>;
}
