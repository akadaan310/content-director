"use client";
import { useState, useRef } from "react";
import VoiceLab from "./VoiceLab";
import SoundDesign from "./SoundDesign";
import { WORLD_EVENT } from "./Tasneem";
import type { GalleryItem } from "./Studio";

// Director controls, reframed around her:
//  - Her world: images -> scene analysis -> her conversation context
//  - Her voice: the Voice Lab (image -> scene -> voice presets -> lock)
//  - Sound design: the existing director-led audio panel
// Image/video GENERATION is intentionally not rendered (paused).
export default function DirectorPanel({ onNewItem }: { onNewItem: (item: GalleryItem) => void }) {
  const [open, setOpen] = useState<"world" | "voice" | "sound" | null>("world");
  const [imgs, setImgs] = useState<string[]>([]);
  const [scenes, setScenes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [soundNote, setSoundNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 4);
    list.forEach((f) => {
      const rd = new FileReader();
      rd.onload = () => setImgs((p) => [...p, rd.result as string].slice(0, 4));
      rd.readAsDataURL(f);
    });
  };

  const readWorld = async () => {
    if (imgs.length === 0 || busy) return;
    setBusy(true);
    setNote("Reading her world…");
    try {
      for (const img of imgs) {
        const r = await fetch("/api/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: img,
            prompt:
              "Describe this scene at the SCENE level only for someone who loves the people in it: " +
              "the setting, what is happening, the mood, the energy, the little details that make it feel alive. " +
              "Do NOT identify, describe, or comment on any people — no faces, no identities, no personal attributes. " +
              "Scene-level only, 4-6 short lines.",
          }),
          signal: AbortSignal.timeout(300000),
        });
        const d = await r.json();
        if (d.ok && d.analysis) {
          const text = String(d.analysis);
          setScenes((p) => [...p, text]);
          window.dispatchEvent(new CustomEvent(WORLD_EVENT, { detail: text }));
        }
      }
      setNote("🌙 Her world updated — she'll feel it when you talk to her.");
    } catch (e: unknown) {
      setNote(`Couldn't read the images: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setBusy(false);
  };

  const tabs = [
    { id: "world", label: "🌙 Her world" },
    { id: "voice", label: "🎙 Her voice" },
    { id: "sound", label: "🎧 Sound design" },
  ] as const;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div className="card p-4">
        <h3 className="font-display text-xl gold-text mb-1">Director</h3>
        <p className="text-xs opacity-60 mb-3">
          Shape her world and her voice. Image and video generation are paused — she is the whole
          show right now.
        </p>
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpen(open === t.id ? null : t.id)}
              className={`px-4 py-2 text-sm rounded-lg border ${
                open === t.id
                  ? "border-[rgba(212,175,55,0.8)] bg-[rgba(212,175,55,0.1)]"
                  : "border-[rgba(212,175,55,0.25)] opacity-70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {open === "world" && (
        <div className="card p-4">
          <h4 className="text-sm gold-text mb-2">🌙 Her world — show her scenes, she'll feel them</h4>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="flex gap-2 mb-3">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={() => fileRef.current?.click()}>
              Pick images ({imgs.length})
            </button>
            {imgs.length > 0 && (
              <button className="btn-gold px-4 py-2 text-sm" onClick={readWorld} disabled={busy}>
                {busy ? "Reading…" : "Add to her world"}
              </button>
            )}
            {imgs.length > 0 && (
              <button className="btn-ghost px-4 py-2 text-sm opacity-60" onClick={() => { setImgs([]); }}>
                Clear
              </button>
            )}
          </div>
          {imgs.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {imgs.map((s, i) => (
                <img
                  key={i}
                  src={s}
                  alt="world"
                  className="w-20 h-20 object-cover rounded border border-[rgba(212,175,55,0.2)]"
                />
              ))}
            </div>
          )}
          {scenes.length > 0 && (
            <div className="flex flex-col gap-2">
              {scenes.map((s, i) => (
                <p key={i} className="text-xs opacity-75 p-2 rounded bg-white/[0.03] whitespace-pre-wrap">
                  🌙 {s.slice(0, 300)}
                </p>
              ))}
            </div>
          )}
          {note && <p className="text-sm opacity-75 mt-2">{note}</p>}
        </div>
      )}

      {open === "voice" && <VoiceLab />}
      {open === "sound" && (
        <>
          <SoundDesign
            initialScene=""
            onNewItem={onNewItem}
            onPlanApproved={(summary) => setSoundNote(summary)}
          />
          {soundNote && <p className="text-xs opacity-60 -mt-2">{soundNote}</p>}
        </>
      )}
    </div>
  );
}
