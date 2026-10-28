import { TestEditor } from "@/components/assessment/test-editor";
export default async function AssessmentPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;return <TestEditor key={id} id={id}/>;
}
