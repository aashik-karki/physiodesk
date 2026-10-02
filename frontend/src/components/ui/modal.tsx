"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  const titleId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Runs only when the modal opens/closes, so re-renders of the parent don't steal focus back.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Focus the first field (or the dialog itself) so keyboard and screen-reader users land inside.
    const first = dialogRef.current?.querySelector<HTMLElement>(
      "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])",
    );
    (first ?? dialogRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // stop the page scrolling behind the modal
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.(); // give focus back to the button that opened it
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-secondary/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("relative my-8 w-full rounded-card border border-border bg-surface shadow-2xl", SIZES[size], "focus:outline-none")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 id={titleId} className="font-display text-xl font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 rounded-lg p-2 text-muted transition hover:bg-canvas hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 rounded-b-card border-t border-border bg-canvas/60 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
