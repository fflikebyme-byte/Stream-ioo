import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Play } from "lucide-react";
import { formatViews, extractEmbedSrc, isDirectVideo } from "@/lib/embed";
import { fmtDuration } from "@/lib/premium";

export type VideoCardData = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  views: number | null;
  embed_url?: string | null;
  is_paid?: boolean | null;
  duration_seconds?: number | null;
};

export const VideoCard = ({ v }: { v: VideoCardData }) => {
  const [previewing, setPreviewing] = useState(false);
  const [autoDur, setAutoDur] = useState<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const duration = v.duration_seconds ?? autoDur;

  const startPreview = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      setPreviewing(true);
      const el = videoRef.current;
      if (el) { el.muted = true; el.play().catch(() => {}); }
    }, 180);
  };
  const stopPreview = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setPreviewing(false);
    const el = videoRef.current;
    if (el) { try { el.pause(); el.currentTime = 0; } catch {} }
  };

  const embedSrc = v.embed_url ? extractEmbedSrc(v.embed_url) : "";
  const direct = !!embedSrc && isDirectVideo(embedSrc);

  const previewIframeSrc = (() => {
    if (!previewing || !embedSrc || direct) return "";
    const sep = embedSrc.includes("?") ? "&" : "?";
    return `${embedSrc}${sep}autoplay=1&muted=1&mute=1`;
  })();

  return (
    <Link
      to={`/video/${v.id}`}
      className="group block animate-fade-in select-none"
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onTouchStart={startPreview}
      onTouchEnd={stopPreview}
      onTouchCancel={stopPreview}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl glass border border-border transition-all duration-300 group-hover:border-primary/60 group-hover:shadow-glow">
        {v.thumbnail_url ? (
          <img
            src={v.thumbnail_url}
            alt={v.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : direct ? (
          <video
            ref={videoRef}
            src={embedSrc}
            muted
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback noplaybackrate"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            onLoadedMetadata={(e) => {
              const d = (e.target as HTMLVideoElement).duration;
              if (Number.isFinite(d) && d > 0) setAutoDur(d);
            }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none bg-black"
          />
        ) : embedSrc ? (
          <iframe
            src={embedSrc}
            title={`${v.title} thumbnail`}
            allow="encrypted-media"
            className="absolute inset-0 w-full h-full pointer-events-none"
            tabIndex={-1}
          />
        ) : (
          <div className="w-full h-full shimmer" />
        )}

        {previewIframeSrc && (
          <iframe
            src={previewIframeSrc}
            title={`${v.title} preview`}
            allow="autoplay; encrypted-media; picture-in-picture"
            className="absolute inset-0 w-full h-full pointer-events-none"
            tabIndex={-1}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        {!previewing && (
          <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="grid place-items-center w-14 h-14 rounded-full bg-primary/90 shadow-glow">
              <Play className="w-6 h-6 fill-primary-foreground text-primary-foreground" />
            </span>
          </div>
        )}

        {v.is_paid && (
          <div className="absolute top-3 left-[-38px] z-20 w-[140px] -rotate-45 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-black text-[11px] font-extrabold tracking-widest text-center py-1 shadow-lg ribbon-shine pointer-events-none">
            PAID
          </div>
        )}

        {duration ? (
          <span className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[11px] font-semibold tabular-nums">
            {fmtDuration(duration)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 px-1">
        <h3 className="font-display font-semibold text-base sm:text-lg line-clamp-2 group-hover:text-primary-glow transition-colors">
          {v.title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="w-3.5 h-3.5" /> {formatViews(v.views)} views
        </p>
      </div>
    </Link>
  );
};

export const VideoCardSkeleton = () => (
  <div>
    <div className="aspect-video rounded-2xl shimmer" />
    <div className="mt-3 h-4 w-3/4 rounded shimmer" />
    <div className="mt-2 h-3 w-1/3 rounded shimmer" />
  </div>
);
