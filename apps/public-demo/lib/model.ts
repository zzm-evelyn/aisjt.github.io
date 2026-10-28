import data from './case.json';
export type DemoState={answers:Record<string,string>};
export const initialState=():DemoState=>({answers:{}});
export const reset=initialState;
export function choose(state:DemoState,itemId:string,optionId:string):DemoState{
 const item=data.items.find(i=>i.id===itemId);
 if(!item||!item.options.some(o=>o.id===optionId))throw new Error('请选择案例中的有效选项');
 return {answers:{...state.answers,[itemId]:optionId}};
}
export function complete(state:DemoState){return data.items.every(i=>i.options.some(o=>o.id===state.answers[i.id]));}
