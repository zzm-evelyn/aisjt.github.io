import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("h-px w-full bg-line", className)}
      {...props}
    />
  );
}

export function ScrollArea({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("thin-scrollbar min-h-0 overflow-auto", className)}
      {...props}
    />
  );
}

export function Mono({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("font-mono text-[11px] tracking-tight", className)}
      {...props}
    />
  );
}
