"use client";
import * as React from "react";
import type { StudioState } from "@/lib/studio/model";
import type { StudioAction } from "@/lib/studio/service";
export function useStudio() {
  const [data, setData] = React.useState<StudioState | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/studio", { cache: "no-store" });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      setData(value);
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, []);
  React.useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);
  const act = React.useCallback(async (action: StudioAction) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      setData(value.state);
      return value as { state: StudioState; resultId: string };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);
  return { data, error, busy, act, refresh };
}
export const safeAction = (promise: Promise<unknown>) => {
  void promise.catch(() => {});
};
