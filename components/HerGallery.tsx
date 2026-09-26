"use client";
import { useState, useEffect, useRef } from "react";
import { WORLD_EVENT } from "./Tasneem";

export const ENV_EVENT = "cd-env-card";
export const REF_EVENT = "cd-her-refs";

export interface HerPhoto {
  id: string;
  name: string;
  url: string;
  created: string;
}

export interface EnvCard {
  url: string;
  line: string;
  detail: string;
}

export interface HerRef {
  id: string;
  name: string;
  url: string;
  analysis: string;
}

// Scene-level only: the vision pass must not identify or describe people.
const ENV_PROMPT =
  "You are setting the SCENE for a creative film collaboration. Look at this image and respond in exactly this shape:\n" +
  'ENV: <one vivid line naming the place and time, e.g. "Tonight: riverside café at dusk">\n' +
  "DETAIL: <4-6 short lines: setting, what is happening, lighting, mood, energy — scene level only. " +
  "Do NOT identify, describe, or comment on any people in the image — no faces, no identities, no personal attributes.>\n" +
  "Non-explicit always.";

// Look continuity for generated stills — plain, factual, non-explicit.
const REF_PROMPT =
  "Describe this person's look for VISUAL CONTINUITY across generated film stills: face structure, " +
  "skin tone, hair (color, length, style), wardrobe (items, colors, style), overall style. " +
  "Plain and factual, non-explicit always — describe clothing and appearance, never sexual, never nude. " +
  "Keep to 6-8 short lines.";

const fileToDataUrl = (f: File): Promise<string> =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(f);
  });

async function vision(image: string, prompt: string): Promise<string> {
  const r = await fetch("/api/vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, prompt }),
    signal: AbortSignal.timeout(300000),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "vision failed");
  return d.analysis as string;
}

export default function HerGallery() {
  const [photos, setPhotos] = useState<HerPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/gallery");
      const d = await r.json();
      if (d.ok) setPhotos(d.items || []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files || uploading) return;
    setUploading(true);
    setNote("");
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        const dataUrl = await fileToDataUrl(f);
        const r = await fetch("/api/gallery/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, name: f.name }),
        });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || "upload failed");
      } catch (e: unknown) {
        setNote(`Upload failed for ${f.name}: ${e instanceof Error ? e.message : "unknown"}`);
        break;
      }
    }
    await load();
    setUploading(false);
  };

  const toggleSelect = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else if (n.size < 4) n.add(id);
      else setNote("Up to 4 reference photos — deselect one first.");
      return n;
    });
  };

  const setAsEnvironment = async (p: HerPhoto) => {
    if (busy) return;
    setBusy(`env-${p.id}`);
    setNote("");
    try {
      const analysis = await vision(p.url, ENV_PROMPT);
      const line = (analysis.match(/^ENV:\s*(.+)$/m)?.[1] || "Tonight: somewhere she loves").trim();
      const detail = (analysis.match(/^DETAIL:\s*([\s\S]*)$/m)?.[1] || analysis).trim().slice(0, 900);
      const card: EnvCard = { url: p.url, line, detail };
      try {
        localStorage.setItem("cd-env-card", JSON.stringify(card));
      } catch {}
      window.dispatchEvent(new CustomEvent(ENV_EVENT, { detail: card }));
      window.dispatchEvent(new CustomEvent(WORLD_EVENT, { detail: `[Tonight's environment — ${line}] ${detail}` }));
      setNote(`🌙 Environment set — ${line}. She'll feel it in the conversation.`);
    } catch (e: unknown) {
      setNote(`Environment failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setBusy("");
  };

  const groundRefs = async () => {
    if (busy || selected.size === 0) return;
    setBusy("refs");
    setNote("");
    try {
      const refs: HerRef[] = [];
      for (const p of photos.filter((x) => selected.has(x.id))) {
        const analysis = await vision(p.url, REF_PROMPT);
        refs.push({ id: p.id, name: p.name, url: p.url, analysis: analysis.trim().slice(0, 900) });
      }
      try {
        localStorage.setItem("cd-her-refs", JSON.stringify(refs));
      } catch {}
      window.dispatchEvent(new CustomEvent(REF_EVENT, { detail: refs }));
      setNote(`✨ ${refs.length} reference photo${refs.length > 1 ? "s" : ""} grounded — her look carries into the studio now.`);
    } catch (e: unknown) {
      setNote(`Reference grounding failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setBusy("");
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl gold-text">
          Her photos{photos.length ? ` (${photos.length})` : ""}
        </h2>
        <button
          className="btn-gold px-4 py-2 text-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "＋ Upload"}
        </button>
      </div>
      <p className="text-xs opacity-60 mb-3">
        Photos persist on your studio server. <span className="gold-text">Set as environment</span>{" "}
        reads the scene and drops her into it — <span className="gold-text">Use as her reference</span>{" "}
        (up to 4) grounds her look for visual continuity across generated stills.
      </p>

      {selected.size > 0 && (
        <div className="card p-3 mb-3 flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="gold-text font-medium">{selected.size}</span> selected as her reference
          </span>
          <button
            className="btn-gold px-4 py-2 text-sm"
            onClick={groundRefs}
            disabled={busy !== ""}
          >
            {busy === "refs" ? "Reading her look…" : "✨ Ground her look"}
          </button>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-2xl gold-text mb-2">No photos yet.</p>
          <p className="text-sm opacity-60">
            Upload the places you go, the nights you want to remember — she'll react to them.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <div
                key={p.id}
                className={`card p-3 transition ${
                  isSel ? "border-[rgba(212,175,55,0.7)]" : ""
                }`}
              >
                <img
                  src={p.url}
                  alt={p.name}
                  className="rounded-lg w-full object-contain max-h-64 cursor-pointer"
                  onClick={() => toggleSelect(p.id)}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs opacity-60 truncate">{p.name}</div>
                  {isSel && <span className="text-xs gold-text">✓ her reference</span>}
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => setAsEnvironment(p)}
                    disabled={busy !== ""}
                  >
                    {busy === `env-${p.id}` ? "Reading scene…" : "🌙 Set as environment"}
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      isSel
                        ? "border-[rgba(212,175,55,0.7)] bg-[rgba(212,175,55,0.1)] gold-text"
                        : "border-white/10 opacity-70 hover:opacity-100"
                    }`}
                    onClick={() => toggleSelect(p.id)}
                    disabled={busy !== ""}
                  >
                    {isSel ? "✓ Reference" : "Use as her reference"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {note && <p className="text-sm opacity-75 mt-3">{note}</p>}
    </div>
  );
}
