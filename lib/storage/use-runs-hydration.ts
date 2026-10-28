"use client";

import * as React from "react";
import { useRunsStore } from "@/lib/store/runs-store";

export function useRunsHydration(): boolean {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const finish = () => {
      if (!active) return;
      useRunsStore.getState().markHydrated();
      setReady(true);
    };

    try {
      const result = useRunsStore.persist.rehydrate();
      Promise.resolve(result).then(finish).catch(finish);
    } catch {
      finish();
    }

    return () => {
      active = false;
    };
  }, []);

  return ready;
}
