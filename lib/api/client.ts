import type {
  DemoRunFile,
  RunMode,
  StageExecution,
} from "@/lib/types/domain";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1";

export class BackendNotConnectedError extends Error {
  readonly code = "backend_not_connected";

  constructor(
    message = "实时模式尚未连接 Flask 后端。V1 仅提供演示回放，不会伪造模型运行。"
  ) {
    super(message);
    this.name = "BackendNotConnectedError";
  }
}

export type CreateRunRequest = {
  project_id: string;
  mode: "live";
  context_ids: string[];
  source_item_ids: string[];
  config_snapshot: Record<string, unknown>;
};

export type RunSummary = {
  run_id: string;
  status: string;
  progress: number;
  error: string | null;
};

export type StageEventPayload = {
  event_id: number;
  run_id: string;
  stage_id: string;
  status: string;
  timestamp: string;
};

/**
 * V2 契约占位。除 health() 外的方法在 V1 中一律抛出
 * BackendNotConnectedError，UI 不得将其展示为成功状态。
 */
export class SjTApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async health(): Promise<{ status: string; service: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as { status: string; service: string };
    } catch {
      throw new BackendNotConnectedError(
        `无法连接 ${this.baseUrl}/health。V2 将在此接入 Flask API。`
      );
    }
  }

  async createRun(_request: CreateRunRequest): Promise<RunSummary> {
    throw new BackendNotConnectedError();
  }

  async getRun(_runId: string): Promise<RunSummary> {
    throw new BackendNotConnectedError();
  }

  async getStages(_runId: string): Promise<StageExecution[]> {
    throw new BackendNotConnectedError();
  }

  subscribeRunEvents(
    _runId: string,
    _onEvent: (payload: StageEventPayload) => void,
    _onError?: (error: Error) => void
  ): () => void {
    throw new BackendNotConnectedError();
  }

  async saveOutline(_runId: string, _outline: unknown): Promise<void> {
    throw new BackendNotConnectedError();
  }

  async confirmCheckpoint(_runId: string, _checkpoint: unknown): Promise<void> {
    throw new BackendNotConnectedError();
  }

  async cancelRun(_runId: string): Promise<void> {
    throw new BackendNotConnectedError();
  }

  async exportRun(_runId: string): Promise<DemoRunFile> {
    throw new BackendNotConnectedError();
  }

  async getItemFamily(_familyId: string): Promise<unknown> {
    throw new BackendNotConnectedError();
  }
}

export const apiClient = new SjTApiClient();

export function viewerModeLabel(mode: RunMode): string {
  return mode === "demo" ? "演示回放" : "实时生成";
}
