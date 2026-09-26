"use client";
import type { GalleryItem } from "./Studio";

export default function Gallery({ items, onClear }: { items: GalleryItem[]; onClear: () => void }) {
  if (items.length === 0)
    return (
      <div className="card p-8 text-center max-w-xl mx-auto">
        <p className="font-display text-2xl gold-text mb-2">The gallery is empty.</p>
        <p className="text-sm opacity-60">Everything you generate — frames, clips, voice lines — lands here, ready to view and download.</p>
      </div>
    );

  const dl = (it: GalleryItem) => {
    const a = document.createElement("a");
    a.href = it.dataUrl;
    const ext = it.kind === "image" ? "png" : it.kind === "video" ? (it.dataUrl.startsWith("data:video/webm") ? "webm" : "mp4") : "mp3";
    a.download = `director-${it.id}.${ext}`;
    a.click();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-display text-2xl gold-text">{items.length} piece{items.length > 1 ? "s" : ""}</h2>
        <button className="btn-ghost px-4 py-2 text-xs" onClick={onClear}>Clear gallery</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="card p-3">
            {it.kind === "image" && <img src={it.dataUrl} alt={it.label} className="rounded-lg w-full object-contain max-h-64" />}
            {it.kind === "video" && <video src={it.dataUrl} controls className="rounded-lg w-full max-h-64" playsInline />}
            {it.kind === "audio" && (
              <div className="py-6 text-center">
                <div className="text-4xl mb-2">🎙</div>
                <audio src={it.dataUrl} controls className="w-full" />
              </div>
            )}
            <div className="mt-2">
              <div className="text-sm font-medium">{it.label}</div>
              <div className="text-xs opacity-60 line-clamp-2 mt-1">{it.prompt}</div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs opacity-50">{it.createdAt} · {it.cost}</span>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => dl(it)}>Download</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
