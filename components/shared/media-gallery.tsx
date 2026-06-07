"use client";

interface GalleryItem {
  url: string;
  type: "image" | "video";
}

interface MediaGalleryProps {
  items: GalleryItem[];
  className?: string;
}

export function MediaGallery({items, className = ""}: MediaGalleryProps) {
  if (items.length === 0) return null;

  const images = items.filter((i) => i.type === "image");
  const videos = items.filter((i) => i.type === "video");
  const firstVideo = videos[0];

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
      <div className={`overflow-hidden rounded-2xl border border-border/70 ${className}`}>
        <img
          src={images[0].url}
          alt=""
          className="h-56 w-full object-cover transition duration-300 hover:scale-[1.02] sm:h-72"
        />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className={`grid grid-cols-2 gap-1 overflow-hidden rounded-2xl border border-border/70 ${className}`}>
        {images.map((img, i) => (
          <img
            key={i}
            src={img.url}
            alt=""
            className="h-48 w-full object-cover transition duration-300 hover:scale-[1.02] sm:h-56"
          />
        ))}
      </div>
    );
  }

  // 3+ images: 2-column grid, last tile shows +N overlay
  const maxVisible = 5;
  const visibleImages = images.slice(0, maxVisible);
  const remaining = images.length - maxVisible;

  return (
    <div className={`grid grid-cols-2 gap-1 overflow-hidden rounded-2xl border border-border/70 ${className}`}>
      {visibleImages.map((img, i) => (
        <div key={i} className="relative">
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
        </div>
      ))}
    </div>
  );
}
