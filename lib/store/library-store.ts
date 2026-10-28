"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DemoRunFile } from "@/lib/types/domain";
import { scoringEligibility } from "@/lib/platform/policy";
export type LibraryEntry={id:string;createdAt:string;run:DemoRunFile};
type LibraryState={entries:LibraryEntry[];add:(run:DemoRunFile,cursor:number,stale:boolean)=>boolean};
export const useLibraryStore=create<LibraryState>()(persist((set)=>({entries:[],add:(run,cursor,stale)=>{
 if(!scoringEligibility(run,cursor,stale).ready)return false;
 const id=run.run.run_id+":"+run.story.version;
 set(s=>({entries:s.entries.some(e=>e.id===id)?s.entries:[{id,createdAt:new Date().toISOString(),run:{...structuredClone(run),run:{...run.run,status:"completed"}}},...s.entries]}));return true;
}}),{name:"sjt:library:v1",storage:createJSONStorage(()=>localStorage),skipHydration:true}));
