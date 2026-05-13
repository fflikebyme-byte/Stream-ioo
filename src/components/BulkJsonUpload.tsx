import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Upload, Download, CheckCircle2, XCircle, FileJson, Clock, AlertTriangle, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { toast } from "sonner";

export type ImportEntry = {
  id: string;
  timestamp: string;
  total: number;
  success: number;
  skipped: number;
  failed: number;
  errors: string[];
};

const HISTORY_KEY = "streamio.importHistory";

function loadHistory(): ImportEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

function saveHistory(entries: ImportEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 20)));
}

const SAMPLE_JSON = JSON.stringify(
  {
    videos: [
      {
        title: "Big Buck Bunny",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        description: "An animated short film.",
        categories: "Animation",
        paid: false,
      },
      {
        title: "Premium Tutorial",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        description: "A premium video for subscribers.",
        categories: "Education",
        paid: true,
      },
    ],
  },
  null,
  2
);

type BulkJsonUploadProps = {
  onDone: () => void;
};

export const BulkJsonUpload = ({ onDone }: BulkJsonUploadProps) => {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [lastResult, setLastResult] = useState<ImportEntry | null>(null);
  const [history, setHistory] = useState<ImportEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_JSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "streamio-sample.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".json") && file.type !== "application/json") {
        toast.error("Please upload a .json file");
        return;
      }

      setProcessing(true);
      setProgress(0);
      setProgressMsg("Reading file…");
      setLastResult(null);

      const errors: string[] = [];
      let success = 0;
      let skipped = 0;
      let failed = 0;

      try {
        const text = await file.text();
        let json: any;
        try { json = JSON.parse(text); } catch { throw new Error("Invalid JSON — cannot parse file"); }

        const videos: any[] = Array.isArray(json?.videos) ? json.videos : [];
        if (videos.length === 0) throw new Error("No videos found. Expected { \"videos\": [...] }");

        setProgressMsg("Fetching existing data…");
        setProgress(5);

        const { data: existVids } = await supabase.from("videos").select("embed_url");
        const haveUrl = new Set((existVids ?? []).map((v: any) => v.embed_url as string));

        const { data: existCats } = await supabase.from("categories").select("id,name");
        const catMap = new Map((existCats ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id as string]));

        const total = videos.length;
        const inserts: any[] = [];

        for (let i = 0; i < videos.length; i++) {
          const v = videos[i];
          const pct = Math.round(5 + ((i + 1) / total) * 70);
          setProgress(pct);
          setProgressMsg(`Processing video ${i + 1} of ${total}…`);

          const title = String(v.title ?? "").trim();
          const url = String(v.url ?? v.embed_url ?? v.embed ?? "").trim();

          if (!title || !url) {
            errors.push(`[${i + 1}] Skipped — missing title or url: ${JSON.stringify(v).slice(0, 80)}`);
            skipped++;
            continue;
          }

          if (haveUrl.has(url)) {
            skipped++;
            continue;
          }

          let categoryId: string | null = null;
          const catName = typeof v.categories === "string" ? v.categories.trim() : "";
          if (catName) {
            const catKey = catName.toLowerCase();
            if (catMap.has(catKey)) {
              categoryId = catMap.get(catKey)!;
            } else {
              const slug = catKey.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `cat-${Date.now()}`;
              const { data: created, error: catErr } = await supabase
                .from("categories")
                .insert({ name: catName, slug })
                .select("id")
                .maybeSingle();
              if (catErr) {
                errors.push(`[${i + 1}] Could not create category "${catName}": ${catErr.message}`);
              } else if (created?.id) {
                categoryId = created.id;
                catMap.set(catKey, created.id);
              }
            }
          }

          inserts.push({
            title,
            embed_url: url,
            description: typeof v.description === "string" ? v.description.trim() || null : null,
            category_id: categoryId,
            is_paid: typeof v.paid === "boolean" ? v.paid : v.is_paid === true,
            is_published: true,
            slug: "",
            source_id: "",
          });

          haveUrl.add(url);
        }

        setProgressMsg(`Inserting ${inserts.length} videos…`);
        setProgress(80);

        if (inserts.length > 0) {
          const CHUNK = 50;
          for (let c = 0; c < inserts.length; c += CHUNK) {
            const chunk = inserts.slice(c, c + CHUNK);
            const { error } = await supabase.from("videos").insert(chunk);
            if (error) {
              errors.push(`Batch insert error: ${error.message}`);
              failed += chunk.length;
            } else {
              success += chunk.length;
            }
            setProgress(80 + Math.round(((c + CHUNK) / inserts.length) * 18));
          }
        }

        setProgress(100);
        setProgressMsg("Done!");

        const entry: ImportEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          total,
          success,
          skipped,
          failed,
          errors,
        };
        setLastResult(entry);
        const updated = [entry, ...loadHistory()];
        saveHistory(updated);
        setHistory(updated);

        if (errors.length === 0) {
          toast.success(`Imported ${success} videos${skipped ? ` (${skipped} duplicates skipped)` : ""}`);
        } else {
          toast.warning(`Import complete — ${success} added, ${failed} failed, ${skipped} skipped`);
        }

        onDone();
      } catch (e: any) {
        const msg = e?.message || "Import failed";
        errors.push(msg);
        toast.error(msg);
        const entry: ImportEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          total: 0,
          success,
          skipped,
          failed,
          errors,
        };
        setLastResult(entry);
        const updated = [entry, ...loadHistory()];
        saveHistory(updated);
        setHistory(updated);
      } finally {
        setProcessing(false);
      }
    },
    [onDone]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.currentTarget.value = "";
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    [processFile]
  );

  return (
    <>
      <Button
        variant="outline"
        className="border-primary/40 hover:border-primary hover:bg-primary/10"
        onClick={() => setOpen(true)}
      >
        <FileJson className="w-4 h-4 mr-1.5" />
        Bulk JSON Upload
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!processing) setOpen(o); }}>
        <DialogContent className="glass-strong border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <FileJson className="w-6 h-6 text-primary" /> Bulk JSON Upload
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Upload a <code className="text-primary-glow">.json</code> file in the format:{" "}
            <code className="text-primary-glow">{`{"videos":[{"title","url","description","categories","paid"}]}`}</code>.
            Duplicates (by URL) are skipped. Categories are auto-created.
          </p>

          {/* Drag & drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !processing && fileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all select-none
              ${dragging ? "border-primary bg-primary/10 shadow-glow" : "border-border hover:border-primary/50 hover:bg-primary/5"}
              ${processing ? "pointer-events-none opacity-80" : ""}`}
          >
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFileChange} />
            {processing ? (
              <div className="w-full text-center">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{progressMsg}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-primary rounded-full shadow-glow transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progress === 100 && (
                  <p className="mt-3 text-xs text-primary-glow font-semibold animate-fade-in">Import complete!</p>
                )}
              </div>
            ) : (
              <>
                <div className={`grid place-items-center w-16 h-16 rounded-2xl transition-all ${dragging ? "bg-primary shadow-glow" : "bg-secondary"}`}>
                  <Upload className={`w-7 h-7 ${dragging ? "text-primary-foreground" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">
                    {dragging ? "Drop your JSON file here" : "Drag & drop a JSON file"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </div>
              </>
            )}
          </div>

          {/* Result summary */}
          {lastResult && !processing && (
            <div className={`rounded-2xl border p-4 animate-fade-in ${lastResult.failed > 0 ? "border-destructive/40 bg-destructive/5" : lastResult.errors.length > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-green-500/40 bg-green-500/5"}`}>
              <div className="flex items-center gap-2 mb-3">
                {lastResult.failed === 0 && lastResult.errors.length === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                )}
                <span className="font-semibold text-sm">Import result</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                <div className="glass rounded-lg p-2">
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-display font-bold text-lg">{lastResult.total}</p>
                </div>
                <div className="glass rounded-lg p-2">
                  <p className="text-green-400">Added</p>
                  <p className="font-display font-bold text-lg text-green-400">{lastResult.success}</p>
                </div>
                <div className="glass rounded-lg p-2">
                  <p className="text-muted-foreground">Skipped</p>
                  <p className="font-display font-bold text-lg">{lastResult.skipped}</p>
                </div>
              </div>
              {lastResult.errors.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowErrors((s) => !s)}
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {lastResult.errors.length} error{lastResult.errors.length !== 1 ? "s" : ""}
                    {showErrors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showErrors && (
                    <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-black/40 p-3 space-y-1">
                      {lastResult.errors.map((e, i) => (
                        <p key={i} className="text-[11px] text-destructive font-mono">{e}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={downloadSample} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Sample JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setShowHistory((s) => !s)}
            >
              <Clock className="w-3.5 h-3.5" />
              History ({history.length})
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>

          {/* History */}
          {showHistory && (
            <div className="rounded-xl border border-border overflow-hidden animate-fade-in">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No imports yet</p>
              ) : (
                <div className="divide-y divide-border max-h-52 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 transition-colors">
                      <div className="shrink-0">
                        {h.failed > 0 || h.errors.length > 0 ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">
                          {h.success} added · {h.skipped} skipped
                          {h.failed > 0 ? ` · ${h.failed} failed` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(h.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const updated = history.filter((x) => x.id !== h.id);
                          setHistory(updated);
                          saveHistory(updated);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
