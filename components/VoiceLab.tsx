"use client";
import { useState, useRef, useEffect } from "react";
import { SOUND_VOICES, toSsml } from "./SoundDesign";

export interface VoicePreset {
  name: string;
  emotion: string;
  pace: string;
  warmth: string;
  style: string;
  voice: string; // sana | salma | ava
  ssml_notes: string;
  sample_line: string;
  scene_note: string;
}

export const PRESET_EVENT = "cd-voice-preset";
const LS_KEY = "cd-voice-preset";

export function getActivePreset(): VoicePreset | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as VoicePreset) : null;
  } catch {
    return null;
  }
}

export function saveActivePreset(p: VoicePreset | null) {
  try {
    if (p) localStorage.setItem(LS_KEY, JSON.stringify(p));
    else localStorage.removeItem(LS_KEY);
  } catch {}
  window.dispatchEvent(new Event(PRESET_EVENT));
}

const HER_VOICES = ["sana", "salma", "ava"];
const EMOTIONS = ["whisper", "soft", "warm", "intense", "playful", "solemn"];

const SCENE_PROMPT =
  "You are helping a VOICE DIRECTOR understand a scene. Describe this image at the SCENE level only: " +
  "the setting, what is happening, the mood, the energy level, and the social context " +
  "(for example: lively public place vs quiet private moment, hushed vs chatty). " +
  "Do NOT identify, describe, or comment on any people in the image — no faces, no identities, " +
  "no personal attributes of any person. Scene-level only. Keep it to 4-6 short lines.";

const PRESET_PROMPT = (scenes: string[]) =>
  `You are the VOICE DIRECTOR for Tasneem — a young woman (21), a warm and playful conversational companion. ` +
  `Non-explicit always; conversational and personality design only — how she SOUNDS, not what she looks like.\n\n` +
  `Scene analyses from reference images:\n${scenes.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
  `Design 4 DISTINCT voice presets — four different vocal personalities she could use across these scenes.\n` +
  `Output ONLY a single JSON code block, nothing else, with exactly this shape:\n` +
  "```json\n" +
  `{"presets": [{"name": "short evocative name", "emotion": "whisper|soft|warm|intense|playful|solemn", ` +
  `"pace": "e.g. relaxed and unhurried", "warmth": "e.g. high", "style": "one line on conversational style", ` +
  `"voice": "sana|salma|ava", ` +
  `"ssml_notes": "prosody and phoneme notes, e.g. soft volume, 90% rate, gentle pitch rise at line ends", ` +
  `"sample_line": "ONE short line she would say in this scene, in her voice — Jordanian/Gaza colloquial Arabic for Arabic scenes, English with an Arabic lilt for English ones", ` +
  `"scene_note": "which scene this preset fits"}]}\n` +
  "```\n" +
  `Rules: keep every field SHORT. No emojis. Non-explicit always.`;

const REFINE_PROMPT = (chosen: string, note: string) =>
  `We chose the voice preset "${chosen}". Refine it into 3 sharper variants that build on that choice.` +
  `${note ? ` Direction from the user: ${note}` : ""}\n` +
  `Output ONLY a single JSON code block with exactly this shape: {"presets": [ ...3 presets with the same fields: name, emotion, pace, warmth, style, voice, ssml_notes, sample_line, scene_note... ]}. ` +
  `Rules: keep every field SHORT. No emojis. Non-explicit always.`;

function parsePresets(raw: string): VoicePreset[] | null {
  try {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    const j = JSON.parse(m[1]);
    const arr = Array.isArray(j.presets) ? j.presets : [];
    if (arr.length === 0) return null;
    return arr.slice(0, 6).map((p: Record<string, unknown>) => ({
      name: String(p.name || "Untitled"),
      emotion: EMOTIONS.includes(String(p.emotion)) ? String(p.emotion) : "warm",
      pace: String(p.pace || ""),
      warmth: String(p.warmth || ""),
      style: String(p.style || ""),
      voice: HER_VOICES.includes(String(p.voice)) ? String(p.voice) : "sana",
      ssml_notes: String(p.ssml_notes || ""),
      sample_line: String(p.sample_line || ""),
      scene_note: String(p.scene_note || ""),
    }));
  } catch {
    return null;
  }
}

interface LabImage {
  id: string;
  dataUrl: string;
  name: string;
}

type Stage = "collect" | "propose" | "refine" | "locked";

export default function VoiceLab() {
  const [images, setImages] = useState<LabImage[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>("collect");
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [trail, setTrail] = useState<string[]>([]);
  const [refineNote, setRefineNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");
  const [previewBusy, setPreviewBusy] = useState("");
  const [note, setNote] = useState("");
  const [locked, setLocked] = useState<VoicePreset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const p = getActivePreset();
      if (p) setLocked(p);
    } catch {}
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 6);
    list.forEach((f, k) => {
      const rd = new FileReader();
      rd.onload = () =>
        setImages((prev) => [
          ...prev,
          { id: `${Date.now()}-${k}`, dataUrl: rd.result as string, name: f.name },
        ]);
      rd.readAsDataURL(f);
    });
  };

  const removeImage = (id: string) => {
    setImages((p) => p.filter((i) => i.id !== id));
    setAnalyses((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  const analyze = async (id: string) => {
    const img = images.find((i) => i.id === id);
    if (!img || analyzing.has(id)) return;
    setAnalyzing((p) => new Set(p).add(id));
    try {
      const r = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: img.dataUrl, prompt: SCENE_PROMPT }),
        signal: AbortSignal.timeout(300000),
      });
      const d = await r.json();
      setAnalyses((p) => ({ ...p, [id]: d.ok ? d.analysis : `Vision failed: ${d.error}` }));
    } catch (e: unknown) {
      setAnalyses((p) => ({
        ...p,
        [id]: `Vision failed: ${e instanceof Error ? e.message : "unknown"}`,
      }));
    }
    setAnalyzing((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  };

  const analyzeAll = () => images.forEach((i) => !analyses[i.id] && analyze(i.id));

  const sceneList = () =>
    images
      .map((i) => analyses[i.id])
      .filter((a): a is string => !!a && !a.startsWith("Vision failed"));

  const askBrain = async (prompt: string): Promise<VoicePreset[] | null> => {
    setBusy(true);
    setError("");
    setRaw("");
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const r = await fetch("/api/director/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt.slice(0, 4000) }),
        signal: AbortSignal.timeout(300000),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "brain failed");
      const parsed = parsePresets(d.reply || "");
      if (!parsed) {
        setRaw(d.reply || "");
        setError("The director answered in prose instead of presets — tap retry, or read it as notes.");
        return null;
      }
      return parsed;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "brain failed");
      return null;
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  };

  const design = async () => {
    const scenes = sceneList();
    if (scenes.length === 0 || busy) return;
    setPresets([]);
    setTrail([]);
    const p = await askBrain(PRESET_PROMPT(scenes));
    if (p) {
      setPresets(p);
      setStage("propose");
    }
  };

  const refine = async (chosen: VoicePreset) => {
    if (busy) return;
    const p = await askBrain(REFINE_PROMPT(chosen.name, refineNote.trim()));
    if (p) {
      setPresets(p);
      setTrail((t) => [...t, chosen.name]);
      setStage("refine");
      setRefineNote("");
    }
  };

  const lock = (p: VoicePreset) => {
    saveActivePreset(p);
    setLocked(p);
    setTrail((t) => [...t, p.name]);
    setStage("locked");
    setNote(`🔒 Locked: "${p.name}" — this is now her default voice until you change it.`);
  };

  const startOver = () => {
    setStage("collect");
    setPresets([]);
    setTrail([]);
    setError("");
    setRaw("");
    setNote("");
  };

  const preview = async (p: VoicePreset) => {
    if (previewBusy || !p.sample_line.trim()) return;
    setPreviewBusy(p.name);
    setNote("");
    try {
      const v = SOUND_VOICES.find((x) => x.id === p.voice) || SOUND_VOICES[0];
      const r = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: toSsml(p.sample_line.trim(), p.emotion),
          voice: v.tts,
          ssml: true,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || r.statusText);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      new Audio(url).play().catch(() => {});
      setNote(`🔊 Playing "${p.name}"…`);
    } catch (e: unknown) {
      setNote(`Preview failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setPreviewBusy("");
  };

  const analyzed = sceneList().length;

  return (
    <div className="card p-4">
      <h3 className="font-display text-xl gold-text mb-1">🧪 Voice Lab</h3>
      <p className="text-xs opacity-60 mb-3">
        Pick images of scenes — the vision pass reads the <em>setting, mood and energy only</em> (never
        people), then the director designs how <span className="gold-text">she</span> should sound in them:
        4 presets, you refine to 3, then lock one. It becomes her default voice.
      </p>

      {locked && stage === "collect" && (
        <div className="p-3 rounded-lg border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.07)] mb-3 text-sm">
          🎙 Active voice: <span className="gold-text font-medium">{locked.name}</span>
          <span className="opacity-60"> · {locked.emotion} · {locked.pace}</span>
        </div>
      )}

      {stage !== "locked" && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="flex gap-2 mb-3 flex-wrap">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={() => fileRef.current?.click()}>
              Pick images ({images.length})
            </button>
            {images.length > 0 && (
              <button
                className="btn-ghost px-4 py-2 text-sm"
                onClick={analyzeAll}
                disabled={analyzing.size > 0}
              >
                {analyzing.size > 0 ? "Reading scenes…" : "Read the scenes"}
              </button>
            )}
          </div>

          {images.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 mb-3">
              {images.map((img) => (
                <div key={img.id} className="p-2 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="flex gap-2 items-start">
                    <img
                      src={img.dataUrl}
                      alt="scene"
                      className="w-20 h-20 object-cover rounded border border-[rgba(212,175,55,0.2)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs opacity-70 truncate">{img.name}</div>
                      <div className="flex gap-2 mt-1">
                        {!analyses[img.id] ? (
                          <button
                            className="btn-ghost px-3 py-1 text-xs"
                            onClick={() => analyze(img.id)}
                            disabled={analyzing.has(img.id)}
                          >
                            {analyzing.has(img.id) ? "Reading…" : "Read scene"}
                          </button>
                        ) : (
                          <span className="text-xs gold-text">✓ read</span>
                        )}
                        <button
                          className="btn-ghost px-3 py-1 text-xs opacity-60"
                          onClick={() => removeImage(img.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                  {analyses[img.id] && (
                    <p className="text-xs opacity-75 mt-2 whitespace-pre-wrap">{analyses[img.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {analyzed > 0 && stage === "collect" && (
            <button
              className="btn-gold px-5 py-2.5 text-sm w-full mb-3"
              onClick={design}
              disabled={busy}
            >
              {busy ? `The director is designing… ${elapsed}s` : `🎙 Design her voice from ${analyzed} scene${analyzed > 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      {raw && !presets.length && <p className="text-sm opacity-75 whitespace-pre-wrap mb-2">{raw}</p>}
      {note && <p className="text-sm opacity-75 mb-2">{note}</p>}

      {(stage === "propose" || stage === "refine") && presets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm gold-text">
              {stage === "propose"
                ? `4 presets — tap one to refine it down to 3`
                : `3 refined presets — lock the final one`}
            </h4>
            {trail.length > 0 && <div className="text-xs opacity-60">{trail.join(" › ")}</div>}
          </div>
          {stage === "refine" && (
            <input
              className="w-full px-3 py-2 text-sm mb-3"
              placeholder="Refinement note for the director (optional) — e.g. softer, slower…"
              value={refineNote}
              onChange={(e) => setRefineNote(e.target.value)}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {presets.map((p, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-[rgba(212,175,55,0.25)] bg-white/[0.03]"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm gold-text">{p.name}</div>
                  <div className="text-xs opacity-60 capitalize">{p.emotion}</div>
                </div>
                <div className="text-xs opacity-75 mb-1">
                  {p.pace && <span>⏱ {p.pace} · </span>}
                  {p.warmth && <span>🔥 {p.warmth} · </span>}
                  <span>🎙 {SOUND_VOICES.find((x) => x.id === p.voice)?.label.split(" — ")[0] || p.voice}</span>
                </div>
                {p.style && <p className="text-xs italic opacity-60 mb-1">{p.style}</p>}
                {p.ssml_notes && (
                  <p className="text-xs opacity-50 mb-1">🎚 {p.ssml_notes}</p>
                )}
                {p.scene_note && <p className="text-xs opacity-50 mb-2">🖼 {p.scene_note}</p>}
                {p.sample_line && (
                  <p className="text-sm p-2 rounded bg-black/30 mb-2" dir="auto">
                    “{p.sample_line}”
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => preview(p)}
                    disabled={previewBusy !== "" || !p.sample_line.trim()}
                  >
                    {previewBusy === p.name ? "Playing…" : "🔊 Preview"}
                  </button>
                  {stage === "propose" ? (
                    <button
                      className="btn-gold px-3 py-1.5 text-xs"
                      onClick={() => refine(p)}
                      disabled={busy}
                    >
                      {busy ? `Refining… ${elapsed}s` : "Narrow from this one →"}
                    </button>
                  ) : (
                    <button
                      className="btn-gold px-3 py-1.5 text-xs"
                      onClick={() => lock(p)}
                    >
                      🔒 Lock this voice
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button className="btn-ghost px-4 py-2 text-xs mt-3" onClick={startOver}>
            Start over
          </button>
        </div>
      )}

      {stage === "locked" && locked && (
        <div className="p-4 rounded-lg border border-[rgba(212,175,55,0.5)] bg-[rgba(212,175,55,0.08)]">
          <div className="font-medium gold-text mb-1">🔒 {locked.name} — her voice, locked in</div>
          <div className="text-xs opacity-75 mb-2">
            {locked.emotion} · {locked.pace} · {locked.warmth} ·{" "}
            {SOUND_VOICES.find((x) => x.id === locked.voice)?.label}
          </div>
          {locked.style && <p className="text-xs italic opacity-60 mb-2">{locked.style}</p>}
          <div className="flex gap-2">
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => preview(locked)} disabled={previewBusy !== ""}>
              {previewBusy === locked.name ? "Playing…" : "🔊 Preview"}
            </button>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={startOver}>
              Design a new one
            </button>
          </div>
          {trail.length > 0 && <div className="text-xs opacity-50 mt-2">{trail.join(" › ")}</div>}
        </div>
      )}
    </div>
  );
}
