import type { StudioState, SourceRecord, Unit } from "./model";
import { unitKey } from "./model";
import { loadRecordedRun } from "@/lib/demo/load";
/** Split an explicit composite facet label; retain archived JSON unchanged. */
export function recordedMaterial() {
  const run = structuredClone(loadRecordedRun());
  const domain = (facet: string, original: string) =>
    facet.includes("-") ? facet.slice(0, facet.indexOf("-")) : original;
  run.source_items = run.source_items.map((i) => ({
    ...i,
    domain: domain(i.facet, i.domain),
  }));
  run.items = run.items.map((i) => ({
    ...i,
    domain: domain(i.facet, i.domain),
  }));
  return run;
}
export function seedState(): StudioState {
  const run = recordedMaterial();
  const now = new Date().toISOString();
  const rows: SourceRecord[] = run.source_items.map((i) => ({
    sourceId: i.source_item_id,
    revision: 1,
    text: i.text,
    domain: i.domain,
    facet: i.facet,
    definition: `${i.facet}：沿用来源材料的构念归属，正式生成前请核对构念定义。`,
    reverseFlag: i.reverse_flag,
    familyId:
      run.items.find((x) => x.source_item_id === i.source_item_id)
        ?.item_family_id ?? "",
    familyConfirmed: false,
    notes: i.note,
  }));
  const units: Unit[] = [];
  for (const r of rows) {
    let u = units.find(
      (x) => unitKey(x.domain, x.facet) === unitKey(r.domain, r.facet),
    );
    if (!u) {
      u = {
        domain: r.domain,
        facet: r.facet,
        definition: r.definition,
        target: 0,
      };
      units.push(u);
    }
    u.target++;
  }
  return {
    seedFormat: 2,
    revision: 0,
    itemSets: [
      {
        id: "bfi-source",
        name: "当前研究条目集",
        archived: false,
        versions: [
          {
            id: "bfi-source-v1",
            number: 1,
            createdAt: now,
            reason:
              "既有案例来源；构念定义为待核对说明，不是补造的量表原始定义",
            rows,
          },
        ],
      },
    ],
    blueprints: [
      {
        id: "bfi-blueprint",
        name: "当前研究 · 15 个 facet / 60 题",
        versions: [
          {
            id: "bfi-blueprint-v1",
            number: 1,
            createdAt: now,
            units,
            usesFacets: true,
            instruction:
              "请选择最符合你在该情景下可能采取的行为。正式生成前请确认作答任务。",
            levels:
              "每题四个选项；候选行为水平由研究者定义，呈现标签不等于分值。",
          },
        ],
      },
    ],
    tasks: [],
    publications: [],
  };
}
