"use client";

import * as React from "react";
import { Cable, LoaderCircle, PlugZap, ServerOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import {
  API_BASE_URL,
  apiClient,
  BackendNotConnectedError,
} from "@/lib/api/client";

type HealthState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "connected"; service: string }
  | { kind: "failed"; message: string };

const PLANNED_ENDPOINTS = [
  "POST /runs — 创建实时生成运行",
  "GET /runs/:id — 查询运行摘要",
  "GET /runs/:id/stages — 获取阶段执行",
  "GET /runs/:id/events (SSE) — 订阅阶段事件",
  "POST /runs/:id/outline — 保存人工调整后的大纲",
  "POST /runs/:id/checkpoints/:id/confirm — 确认人工检查点",
  "GET /runs/:id/export — 导出结果快照",
];

export function LiveModePanel() {
  const [health, setHealth] = React.useState<HealthState>({ kind: "idle" });

  const check = async () => {
    setHealth({ kind: "checking" });
    try {
      const result = await apiClient.health();
      setHealth({ kind: "connected", service: result.service });
    } catch (error) {
      setHealth({
        kind: "failed",
        message:
          error instanceof BackendNotConnectedError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error),
      });
    }
  };

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-1.5">
                <ServerOff className="size-4 text-rose-600" />
                实时模式：Flask 后端未连接
              </CardTitle>
              <Badge variant="danger">V2</Badge>
            </div>
            <p className="text-xs leading-5 text-muted">
              V1 不调用模型、不创建真实运行。切换至实时模式只会展示接口契约，不会产生任何成功状态。
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="danger">
              <AlertTitle>没有可用的实时数据</AlertTitle>
              <AlertDescription>
                请在 V2 接入 Flask API 与 SSE 后使用。当前页面不会伪造运行、事件或审查结果。
              </AlertDescription>
            </Alert>
            <div className="rounded border border-line bg-panel-muted px-2.5 py-2 text-[11px] leading-5 text-ink-soft">
              <span className="text-muted">API 基址：</span>
              <Mono>{API_BASE_URL}</Mono>
              <br />
              <span className="text-muted">来源：</span>
              NEXT_PUBLIC_API_BASE_URL（见 .env.example）
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={check} disabled={health.kind === "checking"}>
                {health.kind === "checking" ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <PlugZap />
                )}
                检查后端连接
              </Button>
              {health.kind === "connected" ? (
                <Badge variant="success">{health.service} 已响应</Badge>
              ) : health.kind === "failed" ? (
                <span className="text-[11px] text-danger">{health.message}</span>
              ) : (
                <span className="text-[11px] text-muted">尚未检查</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Cable className="size-4 text-accent" />
              V2 前端接口契约（占位）
            </CardTitle>
            <p className="text-xs leading-5 text-muted">
              以下方法已在 lib/api/client.ts 中定义签名，当前一律抛出
              BackendNotConnectedError。
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {PLANNED_ENDPOINTS.map((endpoint) => (
                <li
                  key={endpoint}
                  className="rounded border border-line bg-panel px-2.5 py-1.5 font-mono text-[10.5px] leading-5 text-ink-soft"
                >
                  {endpoint}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
