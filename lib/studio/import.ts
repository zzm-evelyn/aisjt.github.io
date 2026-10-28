import type { SourceRecord } from "./model";
export const columns = [
  "source_item_id",
  "source_text",
  "domain",
  "facet",
  "construct_definition",
  "reverse_flag",
  "notes",
];
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell.length === 0) quoted = !quoted;
      else cell += ch;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}
export function mappedRows(
  grid: string[][],
  mapping: Record<string, number>,
): SourceRecord[] {
  const read = (row: string[], field: string) =>
    mapping[field] >= 0 ? (row[mapping[field]] ?? "").trim() : "";
  return grid.slice(1).map((r) => {
    const reverse = read(r, "reverse_flag");
    if (reverse && !/^(true|false|0|1|是|否)$/i.test(reverse))
      throw new Error("reverse_flag 仅接受 true/false、1/0 或 是/否");
    return {
      sourceId: read(r, "source_item_id"),
      revision: 1,
      text: read(r, "source_text"),
      domain: read(r, "domain"),
      facet: read(r, "facet"),
      definition: read(r, "construct_definition"),
      reverseFlag: reverse ? /^(true|1|是)$/i.test(reverse) : null,
      familyId: "",
      familyConfirmed: false,
      notes: read(r, "notes"),
    };
  });
}
