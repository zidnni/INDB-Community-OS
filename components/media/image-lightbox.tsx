"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {ChevronLeft, ChevronRight, X} from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({images, initialIndex, open, onOpenChange}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const dir = document.documentElement.dir || "ltr";
  const isRTL = dir === "rtl";

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const goTo = useCallback((newIndex: number) => {
    if (newIndex >= 0 && newIndex < images.length) {
      setIndex(newIndex);
    }
  }, [images.length]);

  const goNext = useCallback(() => {
    if (isRTL) {
      goTo(index - 1);
    } else {
      goTo(index + 1);
    }
  }, [index, isRTL, goTo]);

  const goPrev = useCallback(() => {
    if (isRTL) {
      goTo(index + 1);
    } else {
      goTo(index - 1);
    }
  }, [index, isRTL, goTo]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowLeft") {
        if (isRTL) goNext(); else goPrev();
      } else if (e.key === "ArrowRight") {
        if (isRTL) goPrev(); else goNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange, goNext, goPrev, isRTL]);

  if (!open || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 touch-none"
      onClick={() => onOpenChange(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        const threshold = 50;
        if (Math.abs(diff) > threshold) {
          if (diff > 0) {
            if (isRTL) goPrev(); else goNext();
          } else {
            if (isRTL) goNext(); else goPrev();
          }
        }
        touchStartX.current = null;
      }}
    >
      <div className="relative flex h-full w-full items-center justify-center">
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute start-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
              aria-label="Previous"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute end-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
              aria-label="Next"
            >
              <ChevronRight size={28} />
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
          className="absolute end-3 top-3 z-10 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <img
          src={images[index]}
          alt=""
          className="max-h-[90vh] max-w-[95vw] object-contain select-none"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>

      {images.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/20 px-3 py-1 text-sm text-white">
          {index + 1} / {images.length}
        </div>
      ) : null}
    </div>
  );
}
