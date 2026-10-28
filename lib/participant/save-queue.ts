import type { Answer,AnswerInput,SaveResult } from "./model";
export type PendingAnswer={itemId:string;optionId:string;requestId:string;expectedRevision:number|null};
type QueueOptions={answers:Answer[];send:(input:AnswerInput)=>Promise<SaveResult>;store?:{load:()=>string|null;save:(value:string)=>void};onChange?:()=>void};
export class ParticipantSaveQueue {
  private answers:Answer[];
  private pending:PendingAnswer[]=[];
  private status:"saved"|"waiting"|"saving"|"error"|"conflict"="saved";
  private error:Error|null=null;
  private recoveryWarning="";
  private running:Promise<void>|null=null;
  private active="";
  private notify?:()=>void;
  constructor(private options:QueueOptions){
    this.answers=structuredClone(options.answers);this.notify=options.onChange;
    try{
      const raw=options.store?.load();
      if(raw){const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>2000||data.some(p=>typeof p.itemId!=="string"||typeof p.optionId!=="string"||typeof p.requestId!=="string"||!(p.expectedRevision===null||(Number.isInteger(p.expectedRevision)&&p.expectedRevision>=0))))throw new Error();this.pending=data;}
    }catch{this.recoveryWarning="本机暂存内容无法读取，请核对已保存的答案。";}
    if(this.pending.length)this.status="waiting";
  }
  snapshot(){return {answers:structuredClone(this.answers),pending:structuredClone(this.pending),status:this.status,error:this.error?.message??"",recoveryWarning:this.recoveryWarning};}
  private changed(){try{this.options.store?.save(JSON.stringify(this.pending));}catch{this.recoveryWarning="本机无法保留未同步回答，请在显示已保存后再关闭页面。";}this.notify?.();}
  enqueue(itemId:string,optionId:string){
    const queued=this.pending.findIndex(p=>p.itemId===itemId&&p.requestId!==this.active);
    const next={itemId,optionId,requestId:crypto.randomUUID(),expectedRevision:null};
    if(queued>=0)this.pending[queued]=next;else this.pending.push(next);
    this.changed();if(!this.error)void this.pump().catch(()=>{});
  }
  private pump():Promise<void>{
    if(this.running)return this.running;
    if(this.error)return Promise.reject(this.error);
    this.running=this.process().finally(()=>{this.running=null;});return this.running;
  }
  private async process(){
    try{
      while(this.pending.length){
        const head=this.pending[0];this.active=head.requestId;
        if(head.expectedRevision===null)head.expectedRevision=this.answers.find(a=>a.itemId===head.itemId)?.revision??0;
        this.status="saving";this.changed();
        const result=await this.options.send(head as AnswerInput);
        if(result.status==="submitted"||result.answer.revision!==result.acceptedRevision||result.answer.optionId!==head.optionId)throw Object.assign(new Error("这道题已在其他窗口更新，请核对已保存答案。"),{status:409});
        this.answers=[...this.answers.filter(a=>a.itemId!==head.itemId),result.answer];this.pending.shift();this.active="";this.changed();
      }
      this.status="saved";this.changed();
    }catch(e){this.error=e instanceof Error?e:new Error("回答尚未保存，请重试");this.status=(e as {status?:number}).status===409?"conflict":"error";this.active="";this.changed();throw this.error;}
  }
  async flush(){while(this.pending.length)await this.pump();if(this.error)throw this.error;}
  async retry(){if(this.status==="conflict")throw this.error;this.error=null;this.status="waiting";this.changed();await this.flush();}
  resolve(choice:"server"|"mine",current:Answer[]){
    const itemId=this.pending[0]?.itemId;this.answers=structuredClone(current);
    if(choice==="server")this.pending=this.pending.filter(p=>p.itemId!==itemId);
    else this.pending=this.pending.map(p=>({...p,requestId:crypto.randomUUID(),expectedRevision:null}));
    this.error=null;this.status=this.pending.length?"waiting":"saved";this.changed();
  }
  destroy(){this.notify=undefined;}
}
