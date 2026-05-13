import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VideoCard, VideoCardSkeleton, type VideoCardData } from "@/components/VideoCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Category = { id: string; name: string; slug: string };

const Categories = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [videos, setVideos] = useState<VideoCardData[] | null>(null);
  const [sort, setSort] = useState<"newest" | "popular">("newest");

  useEffect(() => {
    supabase.from("categories").select("id,name,slug").order("name").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  useEffect(() => {
    setVideos(null);
    (async () => {
      let q = supabase
        .from("videos")
        .select("id,title,thumbnail_url,views,embed_url,is_paid,duration_seconds,category_id,categories!inner(slug)")
        .eq("is_published", true);
      if (slug) q = q.eq("categories.slug", slug);
      q = sort === "newest"
        ? q.order("created_at", { ascending: false })
        : q.order("views", { ascending: false });
      const { data } = await q.limit(48);
      setVideos((data as any) ?? []);
    })();
  }, [slug, sort]);

  const current = categories.find((c) => c.slug === slug);

  return (
    <div className="container py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary-glow font-semibold">Browse</p>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl mt-1">
            {current ? current.name : "All categories"}
          </h1>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "popular")}>
          <SelectTrigger className="w-44 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="popular">Most popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2 mb-10">
        <Link
          to="/categories"
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
            !slug ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "glass border-border hover:border-primary/50"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/categories/${c.slug}`}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              slug === c.slug
                ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                : "glass border-border hover:border-primary/50"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {!videos
          ? Array.from({ length: 12 }).map((_, i) => <VideoCardSkeleton key={i} />)
          : videos.length === 0
            ? <p className="col-span-full text-center text-muted-foreground py-16">No videos in this category yet.</p>
            : videos.map((v) => <VideoCard key={v.id} v={v} />)}
      </div>
    </div>
  );
};

export default Categories;
