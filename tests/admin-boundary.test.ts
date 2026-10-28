// @vitest-environment node
import { it,expect } from "vitest";
import { GET as readStudio,POST as writeStudio } from "@/app/api/studio/route";
import { POST as importMaterials } from "@/app/api/studio/import/route";
import { GET as catalog } from "@/app/api/admin/catalog/route";
import { GET as material } from "@/app/api/admin/materials/[id]/route";
it("旧管理读写、上传及新接口在处理数据之前均拒绝匿名请求",async()=>{
  const request=new Request("http://localhost:3000/api/studio");
  expect((await readStudio(request)).status).toBe(401);
  expect((await writeStudio(new Request(request,{method:"POST"}))).status).toBe(401);
  expect((await importMaterials(new Request(request,{method:"POST"}))).status).toBe(401);
  expect((await catalog(request)).status).toBe(401);
  expect((await material(request,{params:Promise.resolve({id:"unknown"})})).status).toBe(401);
});
