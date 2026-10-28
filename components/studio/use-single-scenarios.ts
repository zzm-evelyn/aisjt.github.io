"use client";
import { useEffect,useState } from "react";
type ScenarioData=typeof import("@/data/runs/university-single-scenarios.json");
const empty:ScenarioData={filename:"",sheet:"",sha256:"",matchMethod:"",items:[]};
export function useSingleScenarios() {
  const [data,setData]=useState(empty),[error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    fetch("/api/admin/single-scenarios",{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error);if(active)setData(x);}).catch(()=>{if(active)setError("单个情景材料读取失败，请刷新重试。");});
    return ()=>{active=false;};
  },[]);
  return {data,error,loading:!data.filename&&!error};
}
