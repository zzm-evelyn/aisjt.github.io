import { guard } from "@/lib/auth/session";
import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/studio/import";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const denied = guard(request); if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "不允许跨站上传" }, { status: 403 });
  try {
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("请选择文件");
    if (file.size > 5_000_000) throw new Error("文件上限为 5MB");
    let grid: string[][];
    if (/\.csv$/i.test(file.name)) grid = parseCsv(await file.text());
    else if (/\.xlsx$/i.test(file.name)) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("工作簿没有工作表");
      if (sheet.rowCount > 2001 || sheet.columnCount > 80)
        throw new Error("工作表超出 2000 条、80 列的导入限制");
      grid = [];
      sheet.eachRow((r) => {
        const cells: string[] = [];
        for (let i = 1; i <= sheet.columnCount; i++)
          cells.push(r.getCell(i).text);
        grid.push(cells);
      });
    } else throw new Error("仅支持 CSV 或 XLSX 文件");
    if (grid.length < 2 || grid.length > 2001)
      throw new Error("需要表头及 1–2000 条数据");
    return Response.json({ grid });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "文件读取失败" },
      { status: 400 },
    );
  }
}
