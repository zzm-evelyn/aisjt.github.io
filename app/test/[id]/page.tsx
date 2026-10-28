import { ParticipantWelcome } from "@/components/participant/welcome";
export default async function WelcomePage({params}:{params:Promise<{id:string}>}){return <ParticipantWelcome key={(await params).id} id={(await params).id}/>;}
