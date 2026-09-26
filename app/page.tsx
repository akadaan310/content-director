"use client";
import { useState, useEffect } from "react";
import ActivatePanel from "@/components/ActivatePanel";
import Studio, { type GalleryItem } from "@/components/Studio";
import Gallery from "@/components/Gallery";

const GKEY = "content-director-gallery";

export default function Home() {
  const [tab, setTab] = useState<"activate" | "studio" | "gallery">("activate");
  const [live, setLive] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GKEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  const addItem = (it: GalleryItem) => {
    setItems((p) => {
      const next = [it, ...p].slice(0, 24);
      try { localStorage.setItem(GKEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clear = () => { setItems([]); try { localStorage.removeItem(GKEY); } catch {} };

  const deactivate = () => { setLive(false); setTab("activate"); };

  return (
    <main className="candle-glow min-h-screen">
      <header className="border-b border-[rgba(212,175,55,0.15)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl gold-text leading-none">Content Director</h1>
            <p className="text-xs opacity-50 mt-1">on-demand studio · zero idle cost</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`status-dot ${live ? "status-ready" : "status-cold"}`}></span>
            <span className="text-xs opacity-70">{live ? "LIVE" : "ASLEEP"}</span>
            {live && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={deactivate}>Deactivate</button>}
          </div>
        </div>
        {live && (
          <nav className="max-w-6xl mx-auto px-4 pb-3 flex gap-2">
            {(["studio", "gallery"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm rounded-lg border capitalize ${tab === t ? "border-[rgba(212,175,55,0.8)] bg-[rgba(212,175,55,0.1)]" : "border-[rgba(212,175,55,0.25)] opacity-70"}`}>
                {t === "studio" ? "🎬 Studio" : `🖼 Gallery (${items.length})`}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {!live && tab === "activate" && <ActivatePanel onReady={() => { setLive(true); setTab("studio"); }} />}
        {live && tab === "studio" && <Studio onNewItem={addItem} items={items} />}
        {live && tab === "gallery" && <Gallery items={items} onClear={clear} />}
      </div>

      <footer className="max-w-6xl mx-auto px-4 pb-8 text-xs opacity-40">
        Non-explicit creative work only. Nothing generates without your explicit cost-tier pick.
      </footer>
    </main>
  );
}
