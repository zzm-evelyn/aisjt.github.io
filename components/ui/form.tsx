import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-line-strong bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/70 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-panel-muted disabled:text-muted";

export function Input({
  className,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-20 resize-y leading-5", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "pr-7", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1 block text-[11px] font-medium tracking-wide text-muted",
        className
      )}
      {...props}
    />
  );
}
