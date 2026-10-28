"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  widthClassName = "max-w-lg",
}: ModalProps) {
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "w-full overflow-hidden rounded-xl border border-line bg-panel shadow-2xl",
          widthClassName
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-serif text-lg font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-xs leading-5 text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="关闭"
            onClick={() => onOpenChange(false)}
          >
            <X />
          </Button>
        </div>
        {children ? (
          <div className="thin-scrollbar max-h-[60vh] overflow-y-auto px-5 py-4">
            {children}
          </div>
        ) : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-panel-muted px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
