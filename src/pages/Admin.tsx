import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Eye, Film, Tag, BarChart3, ExternalLink, LogOut, Lock } from "lucide-react";
import { toast } from "sonner";
import { extractEmbedSrc, formatViews } from "@/lib/embed";
import { BulkJsonUpload } from "@/components/BulkJsonUpload";

type Category = { id: string; name: string; slug: string };
type Video = {
  id: string; title: string; description: string | null;
  thumbnail_url: string | null; embed_url: string;
  category_id: string | null; views: number; likes: number; is_published: boolean;
  is_paid: boolean; duration_seconds: number | null;
  created_at: string;
};

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";
const SESSION_KEY = "streamio.adminSession";

const Admin = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Video | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  const refresh = async () => {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from("videos").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
    ]);
    setVideos((v as Video[]) ?? []);
    setCategories(c ?? []);
  };

  if (!authed) return <LoginGate onAuthed={() => { sessionStorage.setItem(SESSION_KEY, "1"); setAuthed(true); }} />;

  const totalViews = videos.reduce((s, v) => s + (v.views ?? 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes ?? 0), 0);

  return (
    <div className="container py-8 sm:py-12">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary-glow font-semibold">Dashboard</p>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl">Admin panel</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-glow"><Plus className="w-4 h-4 mr-1" /> Add video</Button>
            </DialogTrigger>
            <VideoForm
              key={editing?.id ?? "new"}
              initial={editing}
              categories={categories}
              onDone={() => { setOpen(false); setEditing(null); refresh(); }}
            />
          </Dialog>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <StatCard icon={<Film className="w-5 h-5" />} label="Videos" value={videos.length} />
        <StatCard icon={<Eye className="w-5 h-5" />} label="Total views" value={formatViews(totalViews)} />
        <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Total likes" value={formatViews(totalLikes)} />
      </div>

      <MaintenanceSettings />
      <AutoFetchSettings />
      <PremiumSettings />
      <ImportExport onChange={refresh} />

      <Tabs defaultValue="videos">
        <TabsList className="bg-secondary">
          <TabsTrigger value="videos"><Film className="w-4 h-4 mr-1" /> Videos</TabsTrigger>
          <TabsTrigger value="cats"><Tag className="w-4 h-4 mr-1" /> Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-6">
          <Card className="glass-strong border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Title</th>
                    <th className="text-left p-3 hidden md:table-cell">Category</th>
                    <th className="text-left p-3 hidden sm:table-cell">Views</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted-foreground p-10">No videos yet.</td></tr>
                  )}
                  {videos.map((v) => {
                    const cat = categories.find((c) => c.id === v.category_id);
                    return (
                      <tr key={v.id} className="border-t border-border hover:bg-secondary/40">
                        <td className="p-3 max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-16 aspect-video rounded-md overflow-hidden glass shrink-0">
                              {v.thumbnail_url
                                ? <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full shimmer" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{v.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{extractEmbedSrc(v.embed_url)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">{cat?.name ?? "—"}</td>
                        <td className="p-3 hidden sm:table-cell text-muted-foreground">{formatViews(v.views)}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button asChild size="icon" variant="ghost">
                              <Link to={`/video/${v.id}`} target="_blank"><ExternalLink className="w-4 h-4" /></Link>
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(v); setOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              onClick={async () => {
                                if (!confirm(`Delete "${v.title}"?`)) return;
                                const { error } = await supabase.from("videos").delete().eq("id", v.id);
                                if (error) toast.error(error.message);
                                else { toast.success("Deleted"); refresh(); }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cats" className="mt-6">
          <CategoryManager categories={categories} onChange={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const LoginGate = ({ onAuthed }: { onAuthed: () => void }) => {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user.trim() === ADMIN_USER && pass === ADMIN_PASS) {
      toast.success("Welcome, admin");
      onAuthed();
    } else {
      toast.error("Invalid credentials");
    }
  };
  return (
    <div className="container max-w-md py-20">
      <div className="glass-strong border border-border rounded-3xl p-8 shadow-card">
        <div className="flex items-center gap-2 mb-6">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-primary shadow-glow">
            <Lock className="w-5 h-5 text-primary-foreground" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-primary-glow font-semibold">Restricted</p>
            <h1 className="font-display font-extrabold text-2xl">Admin login</h1>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="user">Username</Label>
            <Input id="user" value={user} onChange={(e) => setUser(e.target.value)} className="mt-1.5 bg-secondary border-border" autoFocus />
          </div>
          <div>
            <Label htmlFor="pass">Password</Label>
            <Input id="pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="mt-1.5 bg-secondary border-border" />
          </div>
          <Button type="submit" className="w-full bg-gradient-primary shadow-glow">Sign in</Button>
        </form>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) => (
  <Card className="glass-strong border-border p-5 flex items-center gap-4">
    <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-primary shadow-glow text-primary-foreground">{icon}</span>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display font-extrabold text-2xl">{value}</p>
    </div>
  </Card>
);

const VideoForm = ({
  initial, categories, onDone,
}: {
  initial: Video | null;
  categories: Category[];
  onDone: () => void;
}) => {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [thumb, setThumb] = useState(initial?.thumbnail_url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [published, setPublished] = useState(initial?.is_published ?? true);
  const [isPaid, setIsPaid] = useState(initial?.is_paid ?? false);
  const [embedInput, setEmbedInput] = useState(initial?.embed_url ?? "");
  const [saving, setSaving] = useState(false);

  const previewSrc = extractEmbedSrc(embedInput);

  const save = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (!previewSrc) { toast.error("Embed URL or iframe code required"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      slug: "",
      source_id: "",
      thumbnail_url: thumb.trim() || null,
      description: description.trim() || null,
      category_id: categoryId || null,
      is_published: published,
      is_paid: isPaid,
      embed_url: previewSrc,
    };
    const { error } = initial
      ? await supabase.from("videos").update(payload).eq("id", initial.id)
      : await supabase.from("videos").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? "Updated" : "Created");
    onDone();
  };

  return (
    <DialogContent className="glass-strong border-border max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">
          {initial ? "Edit video" : "Add video"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 bg-secondary border-border" />
        </div>
        <div>
          <Label htmlFor="embed">Embed URL or full &lt;iframe&gt; code</Label>
          <Textarea
            id="embed"
            value={embedInput}
            onChange={(e) => setEmbedInput(e.target.value)}
            placeholder='https://example.com/embed/123  —  or  —  <iframe src="..."></iframe>'
            className="mt-1.5 bg-secondary border-border font-mono text-xs"
            rows={3}
          />
          {previewSrc && (
            <div className="mt-2 text-xs text-muted-foreground glass rounded-lg p-2 break-all">
              <span className="text-primary-glow font-semibold">Resolved src:</span> {previewSrc}
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="thumb">Thumbnail URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input id="thumb" value={thumb} onChange={(e) => setThumb(e.target.value)} className="mt-1.5 bg-secondary border-border" placeholder="Leave blank to auto-use video as thumbnail" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="mt-1.5 bg-secondary border-border"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 bg-secondary border-border" rows={3} />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
            <span className="font-semibold text-amber-400">⭐ Paid (premium)</span>
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving} className="bg-gradient-primary shadow-glow">
          {saving ? "Saving…" : initial ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const CategoryManager = ({ categories, onChange }: { categories: Category[]; onChange: () => void }) => {
  const [name, setName] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("categories").insert({ name: name.trim(), slug });
    if (error) toast.error(error.message);
    else { setName(""); onChange(); toast.success("Added"); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };
  return (
    <Card className="glass-strong border-border p-6 max-w-2xl">
      <div className="flex gap-2 mb-6">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" className="bg-secondary border-border" />
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Add</Button>
      </div>
      <ul className="divide-y divide-border">
        {categories.map((c) => (
          <li key={c.id} className="py-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.slug}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const AutoFetchSettings = () => {
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [status, setStatus] = useState<{ lastPing?: string; lastStatus?: string; lastCount?: string; lastLatency?: string; totalAdded?: string }>({});

  const loadStatus = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", [
        "auto_fetch_url", "auto_fetch_enabled",
        "auto_fetch_last_ping", "auto_fetch_last_status",
        "auto_fetch_last_count", "auto_fetch_last_latency",
        "auto_fetch_total_added",
      ]);
    const m = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    setUrl((prev) => prev || m.auto_fetch_url || "");
    setEnabled(m.auto_fetch_enabled === "1");
    setStatus({
      lastPing: m.auto_fetch_last_ping,
      lastStatus: m.auto_fetch_last_status,
      lastCount: m.auto_fetch_last_count,
      lastLatency: m.auto_fetch_last_latency,
      totalAdded: m.auto_fetch_total_added,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
    const id = setInterval(loadStatus, 5000);
    return () => clearInterval(id);
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("app_settings").upsert([
      { key: "auto_fetch_url", value: url.trim() },
      { key: "auto_fetch_enabled", value: enabled ? "1" : "0" },
    ]);
    setSaving(false);
    toast.success("Auto-fetch settings saved");
  };

  const pingNow = async () => {
    setPinging(true);
    try {
      const { runFetchCycle } = await import("@/components/AutoFetcher");
      const res = await runFetchCycle();
      if (res.ok) toast.success(`Ping ok — ${res.count} new in ${res.latency}ms`);
      else toast.error(`Ping: ${res.status}`);
      loadStatus();
    } finally {
      setPinging(false);
    }
  };

  const ok = status.lastStatus === "ok";
  const dot = ok ? "bg-green-500" : status.lastStatus ? "bg-red-500" : "bg-muted-foreground";

  return (
    <Card className="glass-strong border-border p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary-glow font-semibold">Automation</p>
          <h2 className="font-display font-bold text-xl">API auto-fetch (every 10s)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Paste a JSON endpoint that returns <code>{`{ data: [{ id, title, embed, category }] }`}</code>. New items insert automatically.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm shrink-0">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-api.example.com/api/check?key=SECRET"
          className="bg-secondary border-border flex-1 min-w-[260px] font-mono text-xs"
          disabled={loading}
        />
        <Button onClick={save} disabled={saving || loading} className="bg-gradient-primary shadow-glow">
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button onClick={pingNow} disabled={pinging || loading} variant="secondary">
          {pinging ? "Pinging…" : "Ping now"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="glass rounded-lg p-3">
          <p className="text-muted-foreground mb-1">Status</p>
          <p className="flex items-center gap-2 font-medium">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {status.lastStatus ?? "—"}
          </p>
        </div>
        <div className="glass rounded-lg p-3">
          <p className="text-muted-foreground mb-1">Last ping</p>
          <p className="font-medium">{status.lastPing ? new Date(status.lastPing).toLocaleTimeString() : "—"}</p>
        </div>
        <div className="glass rounded-lg p-3">
          <p className="text-muted-foreground mb-1">New (last cycle)</p>
          <p className="font-medium">{status.lastCount ?? "0"}</p>
        </div>
        <div className="glass rounded-lg p-3">
          <p className="text-muted-foreground mb-1">Latency</p>
          <p className="font-medium">{status.lastLatency ? `${status.lastLatency} ms` : "—"}</p>
        </div>
        <div className="glass rounded-lg p-3 bg-gradient-primary/10 border border-primary/30">
          <p className="text-muted-foreground mb-1">Total added via API</p>
          <p className="font-display font-extrabold text-lg text-primary-glow">{status.totalAdded ?? "0"}</p>
        </div>
      </div>
    </Card>
  );
};

type PremiumCode = { code: string; days: number | null; expires_at: string; created_at: string };

const PremiumSettings = () => {
  const [price, setPrice] = useState("");
  const [tgUrl, setTgUrl] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingTg, setSavingTg] = useState(false);
  const [days, setDays] = useState(7);
  const [codes, setCodes] = useState<PremiumCode[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from("app_settings").select("key,value").in("key", ["premium_price", "telegram_buy_url"]),
      supabase.from("premium_codes").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    const m = Object.fromEntries((s ?? []).map((r: any) => [r.key, r.value]));
    if (m.premium_price) setPrice(m.premium_price);
    if (m.telegram_buy_url) setTgUrl(m.telegram_buy_url);
    setCodes((c as PremiumCode[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const savePrice = async () => {
    setSavingPrice(true);
    await supabase.from("app_settings").upsert([{ key: "premium_price", value: price.trim() }]);
    setSavingPrice(false);
    toast.success("Price saved");
  };

  const saveTg = async () => {
    setSavingTg(true);
    await supabase.from("app_settings").upsert([{ key: "telegram_buy_url", value: tgUrl.trim() }]);
    setSavingTg(false);
    toast.success("Telegram link saved");
  };

  const generate = async () => {
    if (days < 1) { toast.error("Days must be ≥ 1"); return; }
    setGenerating(true);
    const { generateCode } = await import("@/lib/premium");
    const code = generateCode();
    const expires_at = new Date(Date.now() + days * 86400000).toISOString();
    const { error } = await supabase.from("premium_codes").insert({ code, days, expires_at });
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Code ${code} created (${days}d)`);
    load();
  };

  const remove = async (code: string) => {
    if (!confirm(`Delete code ${code}?`)) return;
    await supabase.from("premium_codes").delete().eq("code", code);
    load();
  };

  return (
    <Card className="glass-strong border-border p-6 mb-8">
      <p className="text-xs uppercase tracking-widest text-primary-glow font-semibold">Monetization</p>
      <h2 className="font-display font-bold text-xl mb-1">Premium</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Toggle "Paid" on any video. Locked videos require a 6-character premium code to play full-screen.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <Label className="text-sm">Premium price</Label>
          <div className="flex gap-2 mt-1.5">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₹49 / week" className="bg-secondary border-border" />
            <Button onClick={savePrice} disabled={savingPrice} className="bg-gradient-primary shadow-glow">
              {savingPrice ? "…" : "Save"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Shown to users on the unlock screen.</p>
        </div>
        <div>
          <Label className="text-sm">Telegram buy link</Label>
          <div className="flex gap-2 mt-1.5">
            <Input value={tgUrl} onChange={(e) => setTgUrl(e.target.value)} placeholder="https://t.me/yourchannel" className="bg-secondary border-border" />
            <Button onClick={saveTg} disabled={savingTg} className="bg-gradient-primary shadow-glow">
              {savingTg ? "…" : "Save"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">"Buy premium" button opens this link in a new tab.</p>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-sm">Generate unlock code</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              type="number" min={1} max={365}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value || "0"))}
              className="bg-secondary border-border w-24"
            />
            <span className="self-center text-sm text-muted-foreground">days valid</span>
            <Button onClick={generate} disabled={generating} className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold shadow-glow">
              {generating ? "…" : "Generate"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold mb-2">Active codes ({codes.length})</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Days</th>
                <th className="text-left p-2">Expires</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">—</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground p-6">No codes yet.</td></tr>
              )}
              {codes.map((c) => {
                const expired = new Date(c.expires_at).getTime() <= Date.now();
                return (
                  <tr key={c.code} className="border-t border-border">
                    <td className="p-2 font-mono font-bold tracking-widest">{c.code}</td>
                    <td className="p-2">{c.days}d</td>
                    <td className="p-2 text-xs">{new Date(c.expires_at).toLocaleString()}</td>
                    <td className="p-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${expired ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400"}`}>
                        {expired ? "expired" : "active"}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove(c.code)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};

const ImportExport = ({ onChange }: { onChange: () => void }) => {
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    try {
      const [{ data: vids }, { data: cats }] = await Promise.all([
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
      ]);
      const blob = new Blob([JSON.stringify({
        version: 1,
        exported_at: new Date().toISOString(),
        categories: cats ?? [],
        videos: vids ?? [],
      }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `streamio-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${vids?.length ?? 0} videos`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally { setBusy(false); }
  };

  const importData = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const vids: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json.videos) ? json.videos : [];
      const cats: any[] = Array.isArray(json?.categories) ? json.categories : [];

      const { data: existCats } = await supabase.from("categories").select("id,slug,name");
      const catBySlug = new Map((existCats ?? []).map((c: any) => [c.slug, c.id]));
      const catByName = new Map((existCats ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id]));
      const catRemap = new Map<string, string>();

      const slugify = (s: string) =>
        s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `cat-${Date.now()}`;

      for (const c of cats) {
        const slug = c.slug || slugify(String(c.name ?? ""));
        let newId = catBySlug.get(slug);
        if (!newId) {
          const { data: created } = await supabase.from("categories")
            .insert({ name: c.name ?? slug, slug }).select("id").maybeSingle();
          newId = created?.id;
          if (newId) { catBySlug.set(slug, newId); catByName.set(String(c.name ?? slug).toLowerCase(), newId); }
        }
        if (newId && c.id) catRemap.set(c.id, newId);
      }

      const { data: existVids } = await supabase.from("videos").select("id,external_id,embed_url");
      const haveExt = new Set((existVids ?? []).map((v: any) => v.external_id).filter(Boolean));
      const haveUrl = new Set((existVids ?? []).map((v: any) => v.embed_url));

      let skipped = 0;
      const inserts: any[] = [];
      for (const v of vids) {
        const embed = String(v.embed_url ?? v.embed ?? "").trim();
        const title = String(v.title ?? "").trim();
        if (!embed || !title) { skipped++; continue; }
        if (v.external_id ? haveExt.has(String(v.external_id)) : haveUrl.has(embed)) { skipped++; continue; }

        let categoryId: string | null = null;
        if (v.category_id && catRemap.get(v.category_id)) categoryId = catRemap.get(v.category_id)!;
        else if (typeof v.category === "string" && v.category.trim()) {
          const key = v.category.trim().toLowerCase();
          if (catByName.has(key)) categoryId = catByName.get(key)!;
          else {
            const slug = slugify(v.category);
            if (catBySlug.has(slug)) categoryId = catBySlug.get(slug)!;
            else {
              const { data: created } = await supabase.from("categories")
                .insert({ name: v.category.trim(), slug }).select("id").maybeSingle();
              if (created?.id) {
                categoryId = created.id;
                catBySlug.set(slug, created.id);
                catByName.set(key, created.id);
              }
            }
          }
        }

        inserts.push({
          title,
          slug: v.slug ?? "",
          source_id: v.source_id ?? "",
          description: v.description ?? null,
          thumbnail_url: v.thumbnail_url ?? v.thumbnail ?? null,
          embed_url: embed,
          external_id: v.external_id != null ? String(v.external_id) : null,
          category_id: categoryId,
          is_published: v.is_published ?? true,
          is_paid: v.is_paid ?? false,
          duration_seconds: v.duration_seconds ?? null,
          views: v.views ?? 0,
          likes: v.likes ?? 0,
        });
        if (embed) haveUrl.add(embed);
        if (v.external_id) haveExt.add(String(v.external_id));
      }

      let added = 0;
      if (inserts.length > 0) {
        const { error } = await supabase.from("videos").insert(inserts);
        if (error) throw error;
        added = inserts.length;
      }
      toast.success(`Imported ${added} new videos (${skipped} skipped)`);
      onChange();
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally { setBusy(false); }
  };

  return (
    <Card className="glass-strong border-border p-6 mb-8">
      <p className="text-xs uppercase tracking-widest text-primary-glow font-semibold">Data</p>
      <h2 className="font-display font-bold text-xl mb-1">Import / Export</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Export downloads a full JSON backup. Import accepts that file <em>or</em> a custom JSON. Use <strong>Bulk JSON Upload</strong> for the simplified{" "}
        <code className="text-primary-glow">{`{"videos":[{"title","url","description","categories","paid"}]}`}</code> format.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportData} disabled={busy} className="bg-gradient-primary shadow-glow">
          Export all
        </Button>
        <label className="inline-flex">
          <input
            type="file" accept="application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.currentTarget.value = ""; }}
          />
          <span className={`inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
            Import file
          </span>
        </label>
        <BulkJsonUpload onDone={onChange} />
      </div>
    </Card>
  );
};

const MaintenanceSettings = () => {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings").select("key,value")
        .in("key", ["maintenance_mode", "maintenance_message"]);
      const m = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      setEnabled(m.maintenance_mode === "1");
      setMessage(m.maintenance_message ?? "We'll be back shortly.");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("app_settings").upsert([
      { key: "maintenance_mode", value: enabled ? "1" : "0" },
      { key: "maintenance_message", value: message.trim() },
    ]);
    setSaving(false);
    toast.success("Maintenance settings saved");
  };

  return (
    <Card className={`glass-strong border-border p-6 mb-8 ${enabled ? "border-amber-500/50 shadow-glow" : ""}`}>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary-glow font-semibold">Site control</p>
          <h2 className="font-display font-bold text-xl">Maintenance mode</h2>
          <p className="text-xs text-muted-foreground mt-1">
            When enabled, visitors see a maintenance screen instead of any videos. Admin panel stays accessible.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm shrink-0">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className={enabled ? "font-bold text-amber-400" : ""}>{enabled ? "ON" : "Enable"}</span>
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="We'll be back shortly."
          className="bg-secondary border-border flex-1 min-w-[260px]"
          disabled={loading}
        />
        <Button onClick={save} disabled={saving || loading} className="bg-gradient-primary shadow-glow self-start">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
};

export default Admin;
