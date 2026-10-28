"use client";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="v3-shell">
      <AppHeader />
      <main className="v3-main">{children}</main>
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="v3-error" role="alert">
      {message}
    </div>
  ) : null;
}
