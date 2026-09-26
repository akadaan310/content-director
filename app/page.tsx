"use client";
import { useState } from "react";
import Tasneem from "@/components/Tasneem";
import DirectorPanel from "@/components/DirectorPanel";
import Gallery from "@/components/Gallery";
import HerGallery from "@/components/HerGallery";
import type { GalleryItem } from "@/components/Studio";

type Tab = "tasneem" | "director" | "gallery";

export default function Home() {
  const [tab, setTab] = useState<Tab>("tasneem");
  const [items, setItems] = useState<GalleryItem[]>([]);

  const addItem = (item: GalleryItem) => setItems((p) => [item, ...p].slice(0, 60));

  const nav = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-5 py-2 text-sm rounded-lg border transition ${
        tab === id
          ? "border-[rgba(212,175,55,0.8)] bg-[rgba(212,175,55,0.12)] gold-text"
          : "border-[rgba(212,175,55,0.2)] opacity-60 hover:opacity-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen candle-glow">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <header className="text-center">
          <h1 className="font-display text-4xl gold-text">Tasneem</h1>
          <p className="text-sm opacity-60 mt-1">
            <span className="status-dot status-ready inline-block mr-1.5" />
            live · non-explicit creative work only
          </p>
        </header>

        <nav className="flex justify-center gap-2">
          {nav("tasneem", "💬 Tasneem")}
          {nav("director", "🎬 Director")}
          {nav("gallery", `🖼 Gallery${items.length ? ` (${items.length})` : ""}`)}
        </nav>

        {tab === "tasneem" && <Tasneem />}
        {tab === "director" && <DirectorPanel onNewItem={addItem} />}
        {tab === "gallery" && (
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-8">
            <HerGallery />
            {items.length > 0 && (
              <div>
                <h2 className="font-display text-2xl gold-text mb-3">Creations</h2>
                <Gallery items={items} onClear={() => setItems([])} />
              </div>
            )}
          </div>
        )}

        <footer className="text-center text-xs opacity-40 pt-4">
          She is the whole show — talk to her, shape her world, design her voice.
        </footer>
      </div>
    </main>
  );
}
