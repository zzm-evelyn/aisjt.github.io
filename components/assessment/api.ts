export async function adminJson<T>(url:string,options?:RequestInit):Promise<T> {
  const response=await fetch(url,{cache:"no-store",...options});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??"操作失败，请重试");
  return data as T;
}
export function jsonBody(method:string,body:unknown):RequestInit {
  return {method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)};
}
