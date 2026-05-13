import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VideoCard, VideoCardSkeleton, type VideoCardData } from "@/components/VideoCard";
import { Flame, Sparkles, Grid3x3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Category = { id: string; name: string; slug: string };

const PAGE_SIZE = 12;

const Home = () => {
  const [trending, setTrending] = useState<VideoCardData[] | null>(null);
  const [latest, setLatest] = useState<VideoCardData[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    (async () => {
      const sel = "id,title,thumbnail_url,views,embed_url,is_paid,duration_seconds";
      const [{ data: t }, { data: l }, { data: c }] = await Promise.all([
        supabase.from("videos").select(sel).eq("is_published", true).order("views", { ascending: false }).limit(8),
        supabase.from("videos").select(sel).eq("is_published", true).order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1),
        supabase.from("categories").select("id,name,slug").order("name"),
      ]);
      setTrending(t ?? []);
      setLatest(l ?? []);
      setCategories(c ?? []);
      setHasMore((l?.length ?? 0) === PAGE_SIZE);
    })();

    const channel = supabase
      .channel("videos-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "videos" }, (payload) => {
        const v = payload.new as VideoCardData & { is_published?: boolean };
        if (!v.is_published) return;
        setLatest((prev) => (prev ? [v, ...prev] : [v]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data } = await supabase
      .from("videos")
      .select("id,title,thumbnail_url,views,embed_url,is_paid,duration_seconds")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data) {
      setLatest((prev) => [...(prev ?? []), ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setPage((p) => p + 1);
    }
    setLoadingMore(false);
  };

  return (
    <div className="container py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-3xl glass-strong border border-border p-8 sm:p-14 mb-8 animate-fade-in">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary-glow font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> The new way to stream
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl leading-[1.05]">
            Watch <span className="text-gradient">unlimited</span> HD videos.
          </h1>
        </div>
      </section>

      <SectionHeader icon={<Grid3x3 className="w-5 h-5 text-primary" />} title="Categories" />
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-thin">
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/categories/${c.slug}`}
            className="shrink-0 glass border border-border rounded-2xl px-5 py-3 text-center font-display font-semibold text-sm transition-all hover:border-primary hover:shadow-glow whitespace-nowrap"
          >
            {c.name}
          </Link>
        ))}
      </div>

      <SectionHeader icon={<Flame className="w-5 h-5 text-primary" />} title="Trending now" className="mt-12" />
      {!trending ? (
        <Grid><Skels count={4} /></Grid>
      ) : trending.length === 0 ? (
        <EmptyState />
      ) : (
        <Grid>{trending.map((v) => <VideoCard key={v.id} v={v} />)}</Grid>
      )}

      <SectionHeader id="latest" icon={<Sparkles className="w-5 h-5 text-primary" />} title="Latest videos" className="mt-16" />
      {!latest ? (
        <Grid><Skels count={6} /></Grid>
      ) : latest.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Grid>{latest.map((v) => <VideoCard key={v.id} v={v} />)}</Grid>
          {hasMore && (
            <div className="mt-10 text-center">
              <Button onClick={loadMore} disabled={loadingMore} variant="secondary" size="lg">
                {loadingMore ? "Loading…" : "Load more"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const SectionHeader = ({ icon, title, className = "", id }: { icon: React.ReactNode; title: string; className?: string; id?: string }) => (
  <div id={id} className={`flex items-center gap-2 mb-5 ${className}`}>
    {icon}
    <h2 className="font-display font-bold text-2xl sm:text-3xl">{title}</h2>
  </div>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-5 sm:gap-7 max-w-2xl mx-auto">
    {children}
  </div>
);

const Skels = ({ count }: { count: number }) =>
  <>{Array.from({ length: count }).map((_, i) => <VideoCardSkeleton key={i} />)}</>;

const EmptyState = () => (
  <div className="glass border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground">
    No videos yet. Visit the <span className="text-foreground font-semibold">/admin</span> panel to add some.
  </div>
);

export default Home;
