import { TestPreview } from "@/components/assessment/preview";
export default async function PreviewPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;return <TestPreview key={id} id={id}/>;
}
