"use client";
import { useState, useRef, useEffect } from "react";
import type { GalleryItem } from "./Studio";

export const SOUND_VOICES = [
  { id: "sana", tts: "ar-JO-SanaNeural", label: "Sana — her voice (Jordanian Arabic)" },
  { id: "taim", tts: "ar-JO-TaimNeural", label: "Taim — his voice (Jordanian Arabic)" },
  { id: "salma", tts: "ar-EG-SalmaNeural", label: "Salma — Egyptian Arabic (F)" },
  { id: "shakir", tts: "ar-EG-ShakirNeural", label: "Shakir — Egyptian Arabic (M)" },
  { id: "ava", tts: "en-US-AvaNeural", label: "Ava — English (F)" },
  { id: "andrew", tts: "en-US-AndrewNeural", label: "Andrew — English (M)" },
];

export const EMOTIONS = ["whisper", "soft", "warm", "intense", "playful", "solemn"] as const;

// Emotion direction -> SSML prosody (Edge-TTS Arabic voices honor prosody tags)
export const EMOTION_SSML: Record<string, string> = {
  whisper: 'volume="soft" rate="90%"',
  soft: 'pitch="-5%" rate="95%"',
  warm: 'pitch="+5%" rate="95%"',
  intense: 'rate="105%" pitch="+8%"',
  playful: 'pitch="+12%" rate="105%"',
  solemn: 'rate="85%" pitch="-8%"',
};

const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const toSsml = (text: string, emotion: string) =>
  `<speak><prosody ${EMOTION_SSML[emotion] || EMOTION_SSML.warm}>${escXml(text)}</prosody></speak>`;

export interface VoiceLine { voice: string; text: string; emotion: string; direction: string }
export interface SfxCue { cue: string; description: string; timing: string }
export interface AmbienceBed { bed: string; description: string }
export interface VocalCue { kind: string; voice: string; direction: string }
export interface SoundPlan {
  voice_lines: VoiceLine[];
  sfx: SfxCue[];
  ambience: AmbienceBed[];
  vocalizations: VocalCue[];
}

const PLAN_PROMPT = (scene: string) => `You are the SOUND DESIGNER for this scene: ${scene}

Design the complete AUDIO for the scene. The director already locked the picture — you own the ears.
Output ONLY a single JSON code block, nothing else, with exactly this shape:
\`\`\`json
{
  "voice_lines": [{"voice": "sana|taim|salma|shakir|ava|andrew", "text": "the line they speak — YOU write it (Jordanian/Gaza colloquial Arabic if the scene is Arabic, English if English)", "emotion": "whisper|soft|warm|intense|playful|solemn", "direction": "one line of acting direction"}],
  "sfx": [{"cue": "short name", "description": "what it sounds like", "timing": "when it hits in the scene"}],
  "ambience": [{"bed": "short name", "description": "the underlying bed"}],
  "vocalizations": [{"kind": "e.g. soft sigh, deep breath, exerted exhale", "voice": "sana|taim|salma|shakir|ava|andrew", "direction": "acting direction"}]
}
\`\`\`
Rules: 2-4 voice lines, 3-6 sfx cues, 1-2 ambience beds, 1-3 vocalizations. Keep every text field SHORT. Non-explicit always — suggestive is fine, explicit never. No emojis.`;

function parsePlan(raw: string): SoundPlan | null {
  try {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    const j = JSON.parse(m[1]);
    return {
      voice_lines: Array.isArray(j.voice_lines) ? j.voice_lines.slice(0, 6) : [],
      sfx: Array.isArray(j.sfx) ? j.sfx.slice(0, 8) : [],
      ambience: Array.isArray(j.ambience) ? j.ambience.slice(0, 3) : [],
      vocalizations: Array.isArray(j.vocalizations) ? j.vocalizations.slice(0, 5) : [],
    };
  } catch {
    return null;
  }
}

const PENDING_NOTE =
  "SFX engine not provisioned yet — the design is saved and ready; synthesis lights up once a Bark / Stable Audio engine is running.";

export default function SoundDesign({
  initialScene,
  onNewItem,
  onPlanApproved,
}: {
  initialScene: string;
  onNewItem: (item: GalleryItem) => void;
  onPlanApproved: (summary: string) => void;
}) {
  const [scene, setScene] = useState(initialScene);
  const [plan, setPlan] = useState<SoundPlan | null>(null);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [genBusy, setGenBusy] = useState<string>("");
  const [genNote, setGenNote] = useState("");
  const [approved, setApproved] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const askDirector = async () => {
    if (!scene.trim() || busy) return;
    setBusy(true); setError(""); setPlan(null); setRaw(""); setApproved(false);
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const r = await fetch("/api/director/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: PLAN_PROMPT(scene.trim()).slice(0, 4000) }),
        signal: AbortSignal.timeout(300000),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "brain failed");
      const text: string = d.reply || "";
      const parsed = parsePlan(text);
      if (parsed) setPlan(parsed);
      else { setRaw(text); setError("The director answered in prose instead of a plan — tap retry, or use it as notes."); }
    } catch (e: any) {
      setError(e.name === "AbortError" ? "Timed out waiting for the brain." : e.message);
    }
    if (timer.current) clearInterval(timer.current);
    setBusy(false);
  };

  const updateLine = (i: number, patch: Partial<VoiceLine>) =>
    setPlan((p) => p ? { ...p, voice_lines: p.voice_lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : p);

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });

  const genVoiceLine = async (i: number) => {
    const line = plan?.voice_lines[i];
    if (!line || !line.text.trim() || genBusy) return;
    const key = `v${i}`;
    setGenBusy(key); setGenNote("Recording the line…");
    try {
      const voice = SOUND_VOICES.find((v) => v.id === line.voice) || SOUND_VOICES[0];
      const r = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: toSsml(line.text.trim(), line.emotion), voice: voice.tts, ssml: true }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || r.statusText); }
      const url = await blobToDataUrl(await r.blob());
      onNewItem({
        id: `${Date.now()}-snd${i}`,
        kind: "audio",
        label: `🎧 ${voice.label.split(" — ")[0]} · ${line.emotion}`,
        prompt: line.text.trim(),
        dataUrl: url,
        createdAt: new Date().toLocaleString(),
        cost: "free",
      });
      setGenNote("Line recorded — it's in your gallery.");
      new Audio(url).play().catch(() => {});
    } catch (e: any) { setGenNote(`Voice failed: ${e.message}`); }
    setGenBusy("");
  };

  const trySfx = async (label: string, prompt: string, kind: "sfx" | "vocalization" | "ambience") => {
    if (genBusy) return;
    setGenBusy(`s${label}`); setGenNote("Asking the SFX engine…");
    try {
      const r = await fetch("/api/sfx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, kind, duration: 5 }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && d.pending) { setGenNote(`⏳ ${PENDING_NOTE}`); }
      else if (!r.ok) throw new Error(d.error || r.statusText);
      else {
        const url = await blobToDataUrl(await r.blob());
        onNewItem({
          id: `${Date.now()}-sfx`,
          kind: "audio",
          label: `🔊 SFX · ${label}`,
          prompt,
          dataUrl: url,
          createdAt: new Date().toLocaleString(),
          cost: "engine",
        });
        setGenNote("SFX rendered — it's in your gallery.");
      }
    } catch (e: any) { setGenNote(`SFX failed: ${e.message}`); }
    setGenBusy("");
  };

  const approveAll = () => {
    if (!plan) return;
    setApproved(true);
    const n = plan.voice_lines.length + plan.sfx.length + plan.ambience.length + plan.vocalizations.length;
    onPlanApproved(`🎧 Sound plan approved (${n} cues) — voice lines: ${plan.voice_lines.length}, sfx: ${plan.sfx.length}, ambience: ${plan.ambience.length}, vocalizations: ${plan.vocalizations.length}. Scene: ${scene.slice(0, 80)}`);
  };

  return (
    <div className="card p-4">
      <h3 className="font-display text-xl gold-text mb-1">🎧 Sound Design</h3>
      <p className="text-xs opacity-60 mb-3">
        Describe the scene — the director writes the lines, picks the voices and emotions, and designs the effects and ambience. You review, tweak, approve. You never have to type a phrase yourself.
      </p>
      <div className="flex gap-2 mb-3">
        <input className="flex-1 px-3 py-2 text-sm" placeholder="The scene — e.g. night rooftop, two voices, city below…"
          value={scene} onChange={(e) => setScene(e.target.value)} />
        <button className="btn-gold px-4 py-2 text-sm" onClick={askDirector} disabled={busy || !scene.trim()}>
          {busy ? `Designing… ${elapsed}s` : plan ? "Redesign" : "Ask the director"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      {raw && !plan && <p className="text-sm opacity-75 whitespace-pre-wrap mb-2">{raw}</p>}

      {plan && (
        <div className="flex flex-col gap-4">
          {/* Voice lines — fully working via Edge-TTS */}
          <div>
            <h4 className="text-sm gold-text mb-2">🎙 Voice lines — the director wrote these, tweak anything</h4>
            <div className="flex flex-col gap-2">
              {plan.voice_lines.map((l, i) => (
                <div key={i} className="p-3 rounded-lg border border-[rgba(212,175,55,0.25)] bg-white/[0.03]">
                  <textarea className="w-full px-2 py-1.5 text-sm mb-2 bg-transparent" rows={2}
                    value={l.text} onChange={(e) => updateLine(i, { text: e.target.value })} />
                  <div className="flex gap-2 flex-wrap items-center">
                    <select className="px-2 py-1.5 text-xs" value={l.voice} onChange={(e) => updateLine(i, { voice: e.target.value })}>
                      {SOUND_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                    <select className="px-2 py-1.5 text-xs capitalize" value={l.emotion} onChange={(e) => updateLine(i, { emotion: e.target.value })}>
                      {EMOTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <button className="btn-gold px-3 py-1.5 text-xs" onClick={() => genVoiceLine(i)} disabled={genBusy !== "" || !l.text.trim()}>
                      {genBusy === `v${i}` ? "Recording…" : "🔊 Generate"}
                    </button>
                  </div>
                  {l.direction && <p className="text-xs italic opacity-60 mt-1.5">Direction: {l.direction}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* SFX — pending engine */}
          <div>
            <h4 className="text-sm gold-text mb-2">🔊 Sound effects <span className="opacity-50 text-xs">· engine pending</span></h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {plan.sfx.map((s, i) => (
                <div key={i} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="text-sm font-medium">{s.cue}</div>
                  <div className="text-xs opacity-70 mt-1">{s.description}</div>
                  <div className="text-xs opacity-50 mt-1">⏱ {s.timing}</div>
                  <button className="btn-ghost px-3 py-1.5 text-xs mt-2" onClick={() => trySfx(s.cue, `${s.cue}: ${s.description}`, "sfx")} disabled={genBusy !== ""}>
                    {genBusy === `s${s.cue}` ? "Asking…" : "⏳ Synthesize"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Ambience — pending engine */}
          <div>
            <h4 className="text-sm gold-text mb-2">🌊 Ambience beds <span className="opacity-50 text-xs">· engine pending</span></h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {plan.ambience.map((a, i) => (
                <div key={i} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="text-sm font-medium">{a.bed}</div>
                  <div className="text-xs opacity-70 mt-1">{a.description}</div>
                  <button className="btn-ghost px-3 py-1.5 text-xs mt-2" onClick={() => trySfx(a.bed, `${a.bed}: ${a.description}`, "ambience")} disabled={genBusy !== ""}>
                    {genBusy === `s${a.bed}` ? "Asking…" : "⏳ Synthesize"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Vocalizations — pending engine */}
          <div>
            <h4 className="text-sm gold-text mb-2">😮‍💨 Emotional vocalizations <span className="opacity-50 text-xs">· engine pending · non-speech, for phoneme research</span></h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {plan.vocalizations.map((v, i) => (
                <div key={i} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="text-sm font-medium">{v.kind} <span className="opacity-50 text-xs">· {SOUND_VOICES.find((x) => x.id === v.voice)?.label.split(" — ")[0] || v.voice}</span></div>
                  <div className="text-xs opacity-70 mt-1">{v.direction}</div>
                  <button className="btn-ghost px-3 py-1.5 text-xs mt-2" onClick={() => trySfx(v.kind, `${v.kind} (${v.direction})`, "vocalization")} disabled={genBusy !== ""}>
                    {genBusy === `s${v.kind}` ? "Asking…" : "⏳ Synthesize"}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs opacity-50 mt-2">⏳ {PENDING_NOTE}</p>
          </div>

          {genNote && <p className="text-sm opacity-75">{genNote}</p>}
          <button className="btn-gold px-5 py-2.5 text-sm w-full" onClick={approveAll} disabled={approved}>
            {approved ? "✓ Plan approved — cues are in the log below" : "Approve the whole sound plan"}
          </button>
        </div>
      )}
    </div>
  );
}
