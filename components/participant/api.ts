export class ParticipantHttpError extends Error {constructor(message:string,public status:number){super(message);}}
export async function participantJson<T>(url:string,options?:RequestInit):Promise<T>{
  let response:Response;
  try{response=await fetch(url,{cache:"no-store",...options,signal:options?.signal??AbortSignal.timeout(20000)});}catch{throw new ParticipantHttpError("连接中断，回答尚未同步，请重试。",0);}
  const data=await response.json();if(!response.ok)throw new ParticipantHttpError(data.error??"暂时无法完成操作，请重试",response.status);return data as T;
}
export function participantBody(method:string,body:unknown):RequestInit{return {method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)};}
