import { ParticipantComplete } from "@/components/participant/complete";
export default async function CompletePage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ParticipantComplete key={id} id={id}/>;}
