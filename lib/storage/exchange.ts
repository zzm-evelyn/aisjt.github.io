import type {
  DemoRunFile,
  LocalOperation,
  LocalOverlay,
  OutlineEvent,
  RunMode,
} from "@/lib/types/domain";

export type ExportMeta = {
  schema_version: string;
  exported_at: string;
  viewer_mode: RunMode;
  source: string;
  disclaimer: string;
  local_overlay_included: boolean;
};

export type ExportedLocalOverlay = {
  outlineDraft: OutlineEvent[];
  outlineConfirmed: boolean;
  stale: boolean;
  operations: LocalOperation[];
};

export type ExportDocument = DemoRunFile & {
  export_meta: ExportMeta;
  local_overlay: ExportedLocalOverlay | null;
};

export function buildExportDocument(
  run: DemoRunFile,
  overlay?: LocalOverlay | null
): ExportDocument {
  return {
    ...run,
    export_meta: {
      schema_version: run.schema_version,
      exported_at: new Date().toISOString(),
      viewer_mode: "demo",
      source: run.run.provenance.source,
      disclaimer: run.run.provenance.disclaimer,
      local_overlay_included: Boolean(overlay),
    },
    local_overlay: overlay
      ? {
          outlineDraft: overlay.outlineDraft,
          outlineConfirmed: overlay.outlineConfirmed,
          stale: overlay.stale,
          operations: overlay.operations,
        }
      : null,
  };
}

export function exportFilename(run: DemoRunFile): string {
  const safeId = run.run.run_id.replace(/[^\w.-]+/g, "-");
  return `sjt-${safeId}.json`;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text) as unknown;
}
