import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  info: {
    box: "border-info/25 bg-info-soft text-info",
    icon: Info,
  },
  success: {
    box: "border-success/25 bg-success-soft text-success",
    icon: CheckCircle2,
  },
  warning: {
    box: "border-warning/25 bg-warning-soft text-warning",
    icon: AlertTriangle,
  },
  danger: {
    box: "border-danger/25 bg-danger-soft text-danger",
    icon: ShieldAlert,
  },
  neutral: {
    box: "border-line bg-panel-muted text-ink-soft",
    icon: Info,
  },
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof styles;
  showIcon?: boolean;
}

export function Alert({
  className,
  variant = "info",
  showIcon = true,
  children,
  ...props
}: AlertProps) {
  const style = styles[variant];
  const Icon = style.icon;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs leading-5",
        style.box,
        className
      )}
      {...props}
    >
      {showIcon ? <Icon className="mt-0.5 size-3.5 shrink-0" /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("font-semibold", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-0.5 opacity-90", className)} {...props} />;
}
