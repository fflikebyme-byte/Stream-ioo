import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { AutoFetcher } from "./AutoFetcher";
import { AgeVerification } from "./AgeVerification";
import { supabase } from "@/integrations/supabase/client";
import { Wrench } from "lucide-react";

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [maintenance, setMaintenance] = useState(false);
  const [maintMsg, setMaintMsg] = useState("We'll be back shortly.");
  const [ageVerified, setAgeVerified] = useState(false);
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings").select("key,value")
        .in("key", ["maintenance_mode", "maintenance_message"]);
      const m = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      setMaintenance(m.maintenance_mode === "1");
      if (m.maintenance_message) setMaintMsg(m.maintenance_message);
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const contentVisible = isAdmin || ageVerified;

  return (
    <>
      {!isAdmin && (
        <AgeVerification onVerified={() => setAgeVerified(true)} />
      )}
      <div
        className="min-h-screen flex flex-col font-sans"
        style={{ visibility: contentVisible ? "visible" : "hidden" }}
        onContextMenu={(e) => {
          const t = e.target as HTMLElement;
          if (t && (t.tagName === "VIDEO" || t.tagName === "IMG" || t.closest("video,img,iframe"))) {
            e.preventDefault();
          }
        }}
        onDragStart={(e) => {
          const t = e.target as HTMLElement;
          if (t && (t.tagName === "VIDEO" || t.tagName === "IMG")) e.preventDefault();
        }}
      >
        <AutoFetcher />
        <Navbar />
        <main className="flex-1">
          {maintenance && !isAdmin ? (
            <div className="container py-20 max-w-xl">
              <div className="glass-strong border border-amber-500/40 rounded-3xl p-10 text-center shadow-glow animate-fade-in">
                <span className="grid place-items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 mx-auto mb-5 shadow-glow">
                  <Wrench className="w-8 h-8 text-black" />
                </span>
                <p className="text-xs uppercase tracking-widest text-primary-glow font-semibold mb-2">Site under maintenance</p>
                <h1 className="font-display font-extrabold text-3xl mb-3">Maintenance mode</h1>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{maintMsg}</p>
              </div>
            </div>
          ) : (
            children ?? <Outlet />
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};
