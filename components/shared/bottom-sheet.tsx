"use client";

import {useEffect, useRef} from "react";
import {createPortal} from "react-dom";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({open, onClose, title, children, className = ""}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const mounted = typeof window !== "undefined";

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;

    function handleTouchStart(e: TouchEvent) {
      if (panel.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      currentY.current = 0;
    }

    function handleTouchMove(e: TouchEvent) {
      if (panel.scrollTop > 0) return;
      currentY.current = e.touches[0].clientY - startY.current;
      if (currentY.current > 0) {
        panel.style.transform = `translateY(${currentY.current}px)`;
      }
    }

    function handleTouchEnd() {
      if (currentY.current > 80) {
        onClose();
      }
      if (panel) {
        panel.style.transform = "";
      }
      currentY.current = 0;
    }

    panel.addEventListener("touchstart", handleTouchStart, {passive: true});
    panel.addEventListener("touchmove", handleTouchMove, {passive: true});
    panel.addEventListener("touchend", handleTouchEnd);
    return () => {
      panel.removeEventListener("touchstart", handleTouchStart);
      panel.removeEventListener("touchmove", handleTouchMove);
      panel.removeEventListener("touchend", handleTouchEnd);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/40 animate-fade-in"
            onClick={onClose}
          />
          <div
            ref={panelRef}
            className={`fixed inset-x-0 bottom-0 z-[9999] max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background shadow-2xl animate-slide-up ${className}`}
          >
            {title ? (
              <div className="flex items-center justify-between border-b border-border/60 px-4 pb-3 pt-4">
                <div className="w-10" />
                <h2 className="text-base font-semibold">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted/80"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ) : (
              <div className="flex justify-center pt-2 pb-1">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
            )}
            <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </div>
        </>
      ) : null}
    </>,
    document.body,
  );
}
