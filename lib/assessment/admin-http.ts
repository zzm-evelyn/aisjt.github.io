import { guard } from "@/lib/auth/session";
import { AssessmentError } from "./repository";
import { TestRepository } from "./test-repository";

export async function boundedBody(request:Request,limit:number) {
  if(Number(request.headers.get("content-length")??0)>limit)throw new AssessmentError("上传内容过大",413);
  const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AssessmentError("上传内容过大",413);}chunks.push(value);}}finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
export async function readJson(request:Request) {
  try{return JSON.parse((await boundedBody(request,2_000_000)).toString("utf8"));}catch(e){if(e instanceof AssessmentError)throw e;throw new AssessmentError("请求格式不正确");}
}
export async function withTests(request:Request,operation:(repository:TestRepository)=>unknown|Promise<unknown>) {
  const denied=guard(request);if(denied)return denied;
  let repository:TestRepository|undefined;
  try{
    repository=new TestRepository();const result=await operation(repository);
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(e){return Response.json({error:e instanceof AssessmentError?e.message:"操作失败，请检查配置后重试"},{status:e instanceof AssessmentError?e.status:500,headers:{"Cache-Control":"no-store"}});}finally{repository?.close();}
}
