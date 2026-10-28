import { ParticipantAnswerPage } from "@/components/participant/answer-page";
export default async function AnswerPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ParticipantAnswerPage key={id} id={id}/>;}
