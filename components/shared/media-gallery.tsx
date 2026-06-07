"use client";

import {useState} from "react";
import {ImageLightbox} from "@/components/media/image-lightbox";

interface GalleryItem {
  url: string;
  type: "image" | "video";
}

interface MediaGalleryProps {
  items: GalleryItem[];
  className?: string;
}

export function MediaGallery({items, className = ""}: MediaGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (items.length === 0) return null;

  const images = items.filter((i) => i.type === "image");
  const videos = items.filter((i) => i.type === "video");
  const firstVideo = videos[0];

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  // If there's a video, show it (with controls), max 1 video
  if (firstVideo) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-border/70 ${className}`}>
        <video
          src={firstVideo.url}
          controls
          playsInline
          preload="metadata"
          className="h-full max-h-[500px] w-full object-contain bg-black/5"
        />
      </div>
    );
  }

  // Images only
  if (images.length === 1) {
    return (
      <>
        <div className={`overflow-hidden rounded-2xl border border-border/70 ${className}`}>
          <button type="button" onClick={() => openLightbox(0)} className="block w-full cursor-pointer text-start">
            <img
              src={images[0].url}
              alt=""
              className="h-56 w-full object-cover transition duration-300 hover:scale-[1.02] sm:h-72"
            />
          </button>
        </div>
        <ImageLightbox
          images={images.map((i) => i.url)}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      </>
    );
  }

  if (images.length === 2) {
    return (
      <>
        <div className={`grid grid-cols-2 gap-1 overflow-hidden rounded-2xl border border-border/70 ${className}`}>
          {images.map((img, i) => (
            <button key={i} type="button" onClick={() => openLightbox(i)} className="block w-full cursor-pointer text-start">
              <img
                src={img.url}
                alt=""
                className="h-48 w-full object-cover transition duration-300 hover:scale-[1.02] sm:h-56"
              />
            </button>
          ))}
        </div>
        <ImageLightbox
          images={images.map((i) => i.url)}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      </>
    );
  }

  // 3+ images: 2-column grid, last tile shows +N overlay
  const maxVisible = 5;
  const visibleImages = images.slice(0, maxVisible);
  const remaining = images.length - maxVisible;

  return (
    <>
      <div className={`grid grid-cols-2 gap-1 overflow-hidden rounded-2xl border border-border/70 ${className}`}>
        {visibleImages.map((img, i) => (
          <button key={i} type="button" onClick={() => openLightbox(i)} className="relative block w-full cursor-pointer text-start">
            <img
              src={img.url}
              alt=""
              className="h-36 w-full object-cover transition duration-300 hover:scale-[1.02] sm:h-44"
            />
            {remaining > 0 && i === maxVisible - 1 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="text-2xl font-bold text-white">+{remaining}</span>
              </div>
            ) : null}
          </button>
        ))}
      </div>
      <ImageLightbox
        images={images.map((i) => i.url)}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}
