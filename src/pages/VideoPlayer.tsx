import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { type VideoCardData } from "@/components/VideoCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Calendar, Heart, Lock, Crown } from "lucide-react";
import { formatViews, extractEmbedSrc, isDirectVideo } from "@/lib/embed";
import { isPremiumUnlocked, redeemPremiumCode, getUnlockExpiry } from "@/lib/premium";
import { toast } from "sonner";

type Video = {
  id: string; title: string; description: string | null;
  thumbnail_url: string | null; embed_url: string;
  views: number | null; likes: number | null;
  category_id: string | null; created_at: string;
  is_paid?: boolean | null;
};

const LIKED_KEY = "streamio.liked";
const getLiked = (): string[] => {
  try { return JSON.parse(localStorage.getItem(LIKED_KEY) || "[]"); } catch { return []; }
};

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const VideoPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<VideoCardData[] | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [liked, setLiked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [seekTime, setSeekTime] = useState(0);
  const [unlocked, setUnlocked] = useState(isPremiumUnlocked());
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [premiumPrice, setPremiumPrice] = useState<string>("");
  const [telegramUrl, setTelegramUrl] = useState<string>("");
  const [showCrown, setShowCrown] = useState(false);
  const loadedAtRef = useRef<number>(Date.now());
  const tickRef = useRef<number | null>(null);
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.from("app_settings").select("key,value")
      .in("key", ["premium_price", "telegram_buy_url"])
      .then(({ data }) => {
        const m = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
        if (m.premium_price) setPremiumPrice(m.premium_price);
        if (m.telegram_buy_url) setTelegramUrl(m.telegram_buy_url);
      });
  }, []);

  useEffect(() => {
    if (!id) return;
    setVideo(null);
    setRelated(null);
    setIframeLoaded(false);
    setSeekTime(0);
    setElapsed(0);

    (async () => {
      const { data: v } = await supabase.from("videos").select("*").eq("id", id).maybeSingle();
      if (!v) return;
      setVideo(v as Video);
      setLiked(getLiked().includes(v.id));

      if (viewedRef.current !== v.id) {
        viewedRef.current = v.id;
        await supabase.rpc("increment_video_views", { _video_id: v.id });
        const { data: fresh } = await supabase.from("videos").select("views,likes").eq("id", v.id).maybeSingle();
        if (fresh) setVideo((cur) => cur ? { ...cur, views: fresh.views, likes: fresh.likes } : cur);
      }

      const { data: r } = await supabase
        .from("videos")
        .select("id,title,thumbnail_url,views,embed_url,is_paid,duration_seconds")
        .eq("is_published", true)
        .neq("id", v.id)
        .order("views", { ascending: false })
        .limit(8);
      setRelated(r ?? []);
    })();
  }, [id]);

  useEffect(() => {
    if (!iframeLoaded) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      return;
    }
    tickRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - loadedAtRef.current) / 1000) + seekTime);
    }, 1000) as unknown as number;
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [iframeLoaded, seekTime]);

  const baseEmbed = video ? extractEmbedSrc(video.embed_url) : "";
  const embedSrc = (() => {
    if (!baseEmbed) return "";
    if (seekTime <= 0) return baseEmbed;
    const sep = baseEmbed.includes("?") ? "&" : "?";
    return `${baseEmbed}${sep}t=${seekTime}&start=${seekTime}`;
  })();

  const skip = (delta: number) => {
    const cur = Math.floor((Date.now() - loadedAtRef.current) / 1000) + seekTime;
    const next = Math.max(0, cur + delta);
    setSeekTime(next);
    setIframeLoaded(false);
    loadedAtRef.current = Date.now();
  };

  const toggleLike = async () => {
    if (!video) return;
    const list = getLiked();
    if (list.includes(video.id)) {
      localStorage.setItem(LIKED_KEY, JSON.stringify(list.filter((x) => x !== video.id)));
      setLiked(false);
      return;
    }
    list.push(video.id);
    localStorage.setItem(LIKED_KEY, JSON.stringify(list));
    setLiked(true);
    const { data } = await supabase.rpc("increment_video_likes", { _video_id: video.id });
    setVideo((cur) => cur ? { ...cur, likes: typeof data === "number" ? data : (cur.likes ?? 0) + 1 } : cur);
    toast.success("Liked");
  };

  const isLocked = !!video?.is_paid && !unlocked;

  const handleRedeem = async () => {
    setRedeeming(true);
    const res = await redeemPremiumCode(code);
    setRedeeming(false);
    if (res.ok) { toast.success(res.message); setUnlocked(true); setCode(""); }
    else toast.error(res.message);
  };

  const expiry = unlocked ? getUnlockExpiry() : null;
  void elapsed; void fmtTime;

  return (
    <div className="container py-4 sm:py-8 max-w-5xl">
      <div
        className="relative aspect-video w-full rounded-2xl overflow-hidden glass border border-border shadow-card"
        onContextMenu={(e) => e.preventDefault()}
      >
        {!iframeLoaded && video?.thumbnail_url && (
          <img src={video.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {!iframeLoaded && !video?.thumbnail_url && (
          <div className="absolute inset-0 bg-black" />
        )}
        {video && embedSrc && !isLocked && (
          isDirectVideo(embedSrc) ? (
            <video
              key={`${video.id}-${seekTime}`}
              src={embedSrc}
              controls
              autoPlay={autoplay}
              playsInline
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onLoadedData={() => { setIframeLoaded(true); loadedAtRef.current = Date.now(); setElapsed(seekTime); }}
              className={`absolute inset-0 w-full h-full object-contain bg-black ${iframeLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}
            />
          ) : (
            <iframe
              key={`${video.id}-${seekTime}`}
              src={embedSrc}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups"
              onLoad={() => { setIframeLoaded(true); loadedAtRef.current = Date.now(); setElapsed(seekTime); }}
              className={`absolute inset-0 w-full h-full ${iframeLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}
            />
          )
        )}

        {isLocked && (
          <>
            {video?.thumbnail_url ? (
              <img src={video.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : isDirectVideo(baseEmbed) ? (
              <video src={baseEmbed} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover pointer-events-none bg-black" />
            ) : (
              <div className="absolute inset-0 bg-black" />
            )}
            <button
              type="button"
              onClick={() => setShowCrown((s) => !s)}
              className="absolute inset-0 z-10 grid place-items-center bg-transparent focus:outline-none"
              aria-label="Show premium info"
            >
              {showCrown && (
                <>
                  <span className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
                  <span className="relative grid place-items-center w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 shadow-glow animate-fade-in">
                    <Crown className="w-10 h-10 text-black" />
                  </span>
                </>
              )}
            </button>
          </>
        )}

        {!isLocked && <>
          <button type="button" aria-label="Rewind 10 seconds" onDoubleClick={() => skip(-10)}
            className="absolute top-0 bottom-12 left-0 w-1/3 bg-transparent focus:outline-none" />
          <button type="button" aria-label="Forward 10 seconds" onDoubleClick={() => skip(10)}
            className="absolute top-0 bottom-12 right-0 w-1/3 bg-transparent focus:outline-none" />
        </>}
      </div>

      {expiry && (
        <p className="mt-3 text-xs text-primary-glow text-center">
          <Crown className="w-3 h-3 inline mr-1" /> Premium active until {new Date(expiry).toLocaleString()}
        </p>
      )}

      {video ? (
        <div className="mt-4 sm:mt-5 animate-fade-in">
          <h1 className="font-display font-extrabold text-xl sm:text-3xl leading-tight">{video.title}</h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {formatViews(video.views)} views</span>
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(video.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={toggleLike}
                variant={liked ? "default" : "secondary"}
                size="sm"
                className={liked ? "bg-gradient-primary shadow-glow" : ""}
              >
                <Heart className={`w-4 h-4 mr-1 ${liked ? "fill-current" : ""}`} />
                {formatViews(video.likes)}
              </Button>
              <div className="flex items-center gap-2">
                <Switch id="autoplay" checked={autoplay} onCheckedChange={setAutoplay} />
                <Label htmlFor="autoplay" className="text-xs sm:text-sm cursor-pointer">Autoplay</Label>
              </div>
            </div>
          </div>

          {isLocked && (
            <div className="mt-4 glass-strong border border-amber-500/40 rounded-2xl p-5 shadow-glow">
              <div className="flex items-center gap-3 mb-3">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600">
                  <Crown className="w-5 h-5 text-black" />
                </span>
                <div>
                  <h3 className="font-display font-extrabold text-lg leading-tight">Premium video</h3>
                  <p className="text-xs text-muted-foreground">
                    Unlock once and watch <span className="text-primary-glow font-semibold">all premium videos</span>.
                    {premiumPrice && <> Price: <span className="text-primary-glow font-semibold">{premiumPrice}</span>.</>}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold shadow-glow flex-1"
                  onClick={() => {
                    if (telegramUrl) window.open(telegramUrl, "_blank", "noopener,noreferrer");
                    else toast.message("Telegram link not configured", { description: "Admin must set the Telegram link in the dashboard." });
                  }}
                >
                  <Crown className="w-4 h-4 mr-1" /> Buy premium {premiumPrice && `— ${premiumPrice}`}
                </Button>
                <div className="flex gap-2 flex-1">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="UNLOCK BY CODE"
                    className="bg-secondary border-border text-center font-mono tracking-[0.3em] uppercase"
                  />
                  <Button onClick={handleRedeem} disabled={redeeming || code.length !== 6} variant="secondary">
                    {redeeming ? "…" : <><Lock className="w-4 h-4 mr-1" /> Unlock</>}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Tap & hold any thumbnail to preview without unlocking.
              </p>
            </div>
          )}

          {video.description && (
            <p className="mt-4 glass rounded-2xl p-4 text-sm text-muted-foreground whitespace-pre-wrap">
              {video.description}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 h-8 w-2/3 rounded shimmer" />
      )}

      <section className="mt-10">
        <h2 className="font-display font-bold text-xl mb-4">Up next</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {!related
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-video rounded-xl shimmer" />
                  <div className="mt-2 h-4 w-3/4 rounded shimmer" />
                </div>
              ))
            : related.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground">No related videos yet.</p>
              ) : related.map((v) => {
                const src = v.embed_url ? extractEmbedSrc(v.embed_url) : "";
                const direct = !!src && isDirectVideo(src);
                return (
                  <Link key={v.id} to={`/video/${v.id}`} className="group block" onContextMenu={(e) => e.preventDefault()}>
                    <div className="relative aspect-video rounded-xl overflow-hidden glass border border-border group-hover:border-primary/60 group-hover:shadow-glow transition-all">
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt={v.title} loading="lazy" draggable={false} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : direct ? (
                        <video src={src} muted playsInline preload="metadata" controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} className="absolute inset-0 w-full h-full object-cover pointer-events-none bg-black" />
                      ) : src ? (
                        <iframe src={src} title={`${v.title} thumbnail`} allow="encrypted-media" tabIndex={-1} className="absolute inset-0 w-full h-full pointer-events-none" />
                      ) : (
                        <div className="w-full h-full shimmer" />
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-xs sm:text-sm line-clamp-2 group-hover:text-primary-glow">{v.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatViews(v.views)} views</p>
                  </Link>
                );
              })}
        </div>
      </section>
    </div>
  );
};

export default VideoPlayer;
