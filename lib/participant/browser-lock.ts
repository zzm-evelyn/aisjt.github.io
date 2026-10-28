export async function participantLock<T>(name:string,work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  if(!navigator.locks)throw new Error("当前浏览器不支持安全恢复，请使用新版 Chrome、Edge 或 Firefox。");
  return navigator.locks.request(`sjt-participant:${name}`,{mode:"exclusive",...(signal?{signal}:{})},work);
}
