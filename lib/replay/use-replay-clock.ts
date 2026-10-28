"use client";

import * as React from "react";
import { useWorkspaceStore } from "@/lib/store/workspace-store";

export function useReplayClock() {
  const playing = useWorkspaceStore((state) => state.playing);
  const speed = useWorkspaceStore((state) => state.speed);
  const mode = useWorkspaceStore((state) => state.mode);
  const tick = useWorkspaceStore((state) => state.tick);

  React.useEffect(() => {
    if (!playing || mode !== "demo") return;
    const interval = window.setInterval(() => tick(), 700 / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, mode, tick]);
}
