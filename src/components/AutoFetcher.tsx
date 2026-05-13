import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const AutoFetcher = () => {
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = () => runFetchCycle(runningRef);
    tick();
    timerRef.current = window.setInterval(() => { if (!cancelled) tick(); }, 10_000) as unknown as number;
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return null;
};

export async function runFetchCycle(runningRef?: { current: boolean }): Promise<{
  ok: boolean; status: string; count: number; latency: number;
}> {
  if (runningRef?.current) return { ok: false, status: "busy", count: 0, latency: 0 };
  if (runningRef) runningRef.current = true;
  const started = Date.now();
  let summary = { ok: false, status: "skipped", count: 0, latency: 0 };
  try {
    const { data: rows } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["auto_fetch_url", "auto_fetch_enabled"]);
    const map = Object.fromEntries((rows ?? []).map((r: any) => [r.key, r.value]));
    const url = map.auto_fetch_url;
    const enabled = map.auto_fetch_enabled === "1";
    if (!enabled || !url) {
      summary = { ok: false, status: "disabled", count: 0, latency: 0 };
      return summary;
    }

    const proxied = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-proxy?url=${encodeURIComponent(url)}`;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(proxied, {
      cache: "no-store",
      headers: { apikey, Authorization: `Bearer ${apikey}` },
    });
    if (!res.ok) {
      summary = { ok: false, status: `http ${res.status}`, count: 0, latency: Date.now() - started };
      return summary;
    }
    const json = await res.json();
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    let added = 0;
    if (data.length > 0) {
      const ids = data.map((d) => String(d.id));
      const { data: existing } = await supabase
        .from("videos").select("external_id").in("external_id", ids);
      const have = new Set((existing ?? []).map((r: any) => r.external_id));

      const { data: cats } = await supabase.from("categories").select("id,name");
      const catMap = new Map((cats ?? []).map((c: any) => [c.name.toLowerCase(), c.id]));

      const inserts: any[] = [];
      for (const item of data) {
        const ext = String(item.id);
        if (have.has(ext)) continue;
        let categoryId: string | null = null;
        if (item.category) {
          const key = String(item.category).toLowerCase();
          categoryId = catMap.get(key) ?? null;
          if (!categoryId) {
            const slug = key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const { data: created } = await supabase
              .from("categories").insert({ name: item.category, slug })
              .select("id").maybeSingle();
            if (created?.id) { categoryId = created.id; catMap.set(key, created.id); }
          }
        }
        inserts.push({
          title: item.title ?? "Untitled",
          embed_url: item.embed ?? "",
          external_id: ext,
          category_id: categoryId,
          is_published: true,
          slug: "",
          source_id: "",
        });
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from("videos").insert(inserts);
        if (!error) added = inserts.length;
        else { summary = { ok: false, status: error.message, count: 0, latency: Date.now() - started }; return summary; }
      }
    }
    summary = { ok: true, status: "ok", count: added, latency: Date.now() - started };
    return summary;
  } catch (e: any) {
    summary = { ok: false, status: e?.message || "fetch failed", count: 0, latency: Date.now() - started };
    return summary;
  } finally {
    if (runningRef) runningRef.current = false;
    (async () => {
      try {
        const upserts: any[] = [
          { key: "auto_fetch_last_ping", value: new Date().toISOString() },
          { key: "auto_fetch_last_status", value: summary.status },
          { key: "auto_fetch_last_count", value: String(summary.count) },
          { key: "auto_fetch_last_latency", value: String(summary.latency) },
        ];
        if (summary.count > 0) {
          const { data: cur } = await supabase
            .from("app_settings").select("value").eq("key", "auto_fetch_total_added").maybeSingle();
          const next = (Number(cur?.value) || 0) + summary.count;
          upserts.push({ key: "auto_fetch_total_added", value: String(next) });
        }
        await supabase.from("app_settings").upsert(upserts);
      } catch {}
    })();
  }
}
