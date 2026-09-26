"use client";
import { useState, useRef, useEffect } from "react";
import Closer from "./Closer";
import CostPicker from "./CostPicker";
import SoundDesign, { SOUND_VOICES } from "./SoundDesign";
import VoiceLab, { getActivePreset, saveActivePreset, PRESET_EVENT, type VoicePreset } from "./VoiceLab";
import Session from "./Session";
import type { TierQuote, CostTier } from "@/lib/pricing";

interface Msg { role: "user" | "director"; text: string }
export interface GalleryItem { id: string; kind: "image" | "video" | "audio"; label: string; prompt: string; dataUrl: string; createdAt: string; cost: string }

const VOICES = [
  { id: "ar-JO-SanaNeural", label: "Sana — her voice (Jordanian Arabic)" },
  { id: "ar-JO-TaimNeural", label: "Taim — his voice (Jordanian Arabic)" },
  { id: "ar-EG-SalmaNeural", label: "Salma — Egyptian Arabic (F)" },
  { id: "ar-EG-ShakirNeural", label: "Shakir — Egyptian Arabic (M)" },
  { id: "en-US-AvaNeural", label: "Ava — English (F)" },
  { id: "en-US-AndrewNeural", label: "Andrew — English (M)" },
];

export default function Studio({ onNewItem, items }: { onNewItem: (item: GalleryItem) => void; items: GalleryItem[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "director", text: "Roll cameras. I'm your creative director — not in the frame, but running the scene. Tell me the world, or run a closer and I'll narrow it with you. And remember: I design the SOUND too — voices, effects, ambience. You just approve." }]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatElapsed, setChatElapsed] = useState(0);
  const [closerTopic, setCloserTopic] = useState("");
  const [showCloser, setShowCloser] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [activePreset, setActivePreset] = useState<VoicePreset | null>(null);
  const [deductions, setDeductions] = useState<string[]>([]);
  const [hintSeen, setHintSeen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [refImg, setRefImg] = useState<string>("");
  const [vision, setVision] = useState("");
  const [visionBusy, setVisionBusy] = useState(false);
  const [genKind, setGenKind] = useState<"image" | "video" | "voice">("image");
  const [voiceText, setVoiceText] = useState("");
  const [voice, setVoice] = useState(VOICES[0].id);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const chatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try { setHintSeen(!!localStorage.getItem("cd-sound-hint")); } catch {}
    try { setActivePreset(getActivePreset()); } catch {}
    const onPreset = () => { try { setActivePreset(getActivePreset()); } catch {} };
    window.addEventListener(PRESET_EVENT, onPreset);
    return () => { if (chatTimer.current) clearInterval(chatTimer.current); window.removeEventListener(PRESET_EVENT, onPreset); };
  }, []);

  // When a voice preset is locked, make it the default voice for synthesis.
  useEffect(() => {
    if (activePreset) {
      const tts = SOUND_VOICES.find((v) => v.id === activePreset.voice)?.tts;
      if (tts) setVoice(tts);
    }
  }, [activePreset]);

  const dismissHint = () => {
    try { localStorage.setItem("cd-sound-hint", "1"); } catch {}
    setHintSeen(true);
  };

  const push = (m: Msg) => setMsgs((p) => [...p, m]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatBusy) return;
    const text = chatInput.trim(); setChatInput("");
    push({ role: "user", text });
    setChatBusy(true); setChatElapsed(0);
    chatTimer.current = setInterval(() => setChatElapsed((e) => e + 1), 1000);
    const stopTimer = () => { if (chatTimer.current) clearInterval(chatTimer.current); };
    const updateLast = (t: string) =>
      setMsgs((p) => { const n = [...p]; n[n.length - 1] = { ...n[n.length - 1], text: t }; return n; });
    try {
      const r = await fetch("/api/director/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: msgs.map((m) => ({ role: m.role === "director" ? "assistant" : "user", content: m.text })), stream: true }) });
      const ctype = r.headers.get("content-type") || "";
      if (!r.ok || !r.body || !ctype.includes("text/event-stream")) {
        // Fallback for a non-streaming backend response.
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || r.statusText);
        push({ role: "director", text: d.ok ? d.reply : `Trouble reaching the brain: ${d.error}` });
      } else {
        // Live token stream: words appear as the brain generates them.
        push({ role: "director", text: "" });
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let acc = ""; let buf = ""; let gotToken = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() || "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") { buf = ""; break; }
            if (!payload.startsWith("{")) continue;
            try {
              const d = JSON.parse(payload);
              if (d.token) { acc += d.token; gotToken = true; updateLast(acc); }
              else if (d.error) throw new Error(d.error);
            } catch (e) { if (e instanceof Error && !/token|JSON/i.test(e.message)) throw e; }
          }
        }
        if (!gotToken) updateLast("Cut! The brain answered with silence — try once more.");
      }
    } catch (e: any) { push({ role: "director", text: `Cut! The brain didn't answer: ${e.message}` }); }
    stopTimer();
    setChatBusy(false);
  };

  const onRefFile = (f: File) => {
    const rd = new FileReader();
    rd.onload = () => setRefImg(rd.result as string);
    rd.readAsDataURL(f);
  };

  const analyzeRef = async () => {
    if (!refImg || visionBusy) return;
    setVisionBusy(true); setVision("");
    try {
      const r = await fetch("/api/vision", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: refImg }) });
      const d = await r.json();
      setVision(d.ok ? d.analysis : `Vision failed: ${d.error}`);
    } catch (e: any) { setVision(`Vision failed: ${e.message}`); }
    setVisionBusy(false);
  };

  const save = (kind: GalleryItem["kind"], label: string, p: string, dataUrl: string, cost: string) =>
    onNewItem({ id: `${Date.now()}`, kind, label, prompt: p, dataUrl, createdAt: new Date().toLocaleString(), cost });

  const genImage = async (_tier: CostTier, q: TierQuote) => {
    setBusy("image"); setNote("Painting the frame… (cold start can take a couple minutes)");
    try {
      const r = await fetch("/api/generate/image", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, steps: _tier === "economy" ? 20 : _tier === "fast" ? 40 : 28, seed: Math.floor(Math.random() * 1e6) }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      save("image", `Image · ${_tier}`, prompt, d.image, `$${q.estUsd}`);
      setNote("That's a wrap on the frame — it's in your gallery.");
    } catch (e: any) { setNote(`Image failed: ${e.message}`); }
    setBusy("");
  };

  const genVideo = async (_tier: CostTier, q: TierQuote) => {
    const clips = _tier === "economy" ? 1 : _tier === "standard" ? 2 : 3;
    setBusy("video"); setNote(`Submitting ${clips} clip${clips > 1 ? "s" : ""}… each renders ~15 min. I'll poll for you.`);
    try {
      const r = await fetch("/api/generate/video", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, clips }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      for (const c of d.calls) {
        setNote(`Clip ${c.clip}/${d.calls.length} rendering…`);
        let done = false, tries = 0;
        while (!done && tries < 120) {
          await new Promise((res) => setTimeout(res, 30000));
          const pr = await fetch(`/api/generate/video/result?call_id=${encodeURIComponent(c.call_id)}`);
          const pd = await pr.json();
          if (pd.ok && pd.done && pd.video) {
            save("video", `Video clip ${c.clip}/${d.calls.length}`, prompt, pd.video, `$${q.estUsd}`);
            done = true;
          }
          tries++;
        }
        if (!done) setNote(`Clip ${c.clip} is still rendering — check the gallery later.`);
      }
      setNote("All clips are in your gallery. Chain them for the full scene.");
    } catch (e: any) { setNote(`Video failed: ${e.message}`); }
    setBusy("");
  };

  const genVoice = async () => {
    if (!voiceText.trim() || busy) return;
    setBusy("voice"); setNote("Recording the line…");
    try {
      const r = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceText, voice }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || r.statusText); }
      const blob = await r.blob();
      const url: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      save("audio", `Voice · ${VOICES.find((v) => v.id === voice)?.label.split(" — ")[0]}`, voiceText, url, "free");
      new Audio(url).play().catch(() => {});
      setNote("Line recorded — playing it back, and it's in your gallery.");
    } catch (e: any) { setNote(`Voice failed: ${e.message}`); }
    setBusy("");
  };

  const soundScene = deductions.length > 0
    ? deductions[deductions.length - 1]
    : closerTopic.trim() || prompt.trim() || "";

  return (
    <div className="flex flex-col gap-4">
    {!hintSeen && (
      <div className="card p-4 border-[rgba(212,175,55,0.5)]">
        <p className="text-sm">
          <span className="gold-text font-medium">🎬 First time here?</span> Describe the scene in the chat — the director designs the <em>picture and the sound</em>: he writes the voice lines, picks the voices and emotions, and lays out the effects and ambience. You review, tweak, and approve. You never have to type a phrase yourself.
        </p>
        <button className="btn-gold px-4 py-1.5 text-xs mt-2" onClick={dismissHint}>Got it</button>
      </div>
    )}
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Director chat + closers */}
      <div className="flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="font-display text-xl gold-text mb-2">The Director</h3>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-3 pr-1">
            {msgs.map((m, i) => (
              <div key={i} className={`text-sm p-2.5 rounded-lg ${m.role === "director" ? "bg-[rgba(212,175,55,0.07)] border border-[rgba(212,175,55,0.2)]" : "bg-white/5 self-end max-w-[90%]"}`}>
                {m.role === "director" && <div className="text-xs gold-text mb-1">DIRECTOR</div>}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
            {chatBusy && <div className="text-xs opacity-60">The director is thinking… {chatElapsed}s <span className="opacity-50">(the brain runs on a small CPU box — long answers can take a minute)</span></div>}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 px-3 py-2 text-sm" placeholder="Describe the world, the beat, the shot…" value={chatInput}
              onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <button className="btn-gold px-4 py-2 text-sm" onClick={sendChat} disabled={chatBusy}>Send</button>
          </div>
          <div className="flex gap-2 mt-2">
            <input className="flex-1 px-3 py-2 text-sm" placeholder="Closer topic — e.g. the opening shot" value={closerTopic}
              onChange={(e) => setCloserTopic(e.target.value)} />
            <button className="btn-ghost px-4 py-2 text-sm" onClick={() => closerTopic.trim() && setShowCloser(true)}>Run closer</button>
          </div>
          <button className="btn-ghost px-4 py-2 text-sm mt-2 w-full" onClick={() => setShowSound((s) => !s)}>
            {showSound ? "Hide sound design" : "🎧 Design the sound — the director writes the audio"}
          </button>
          <button className="btn-ghost px-4 py-2 text-sm mt-2 w-full" onClick={() => setShowLab((s) => !s)}>
            {showLab ? "Hide voice lab" : "🧪 Voice Lab — design her voice from images"}
          </button>
        </div>
        {showCloser && (
          <Closer topic={closerTopic} onDone={(deduction, trail) => {
            setDeductions((p) => [...p, `${trail.join(" › ")} ⇒ ${deduction}`]);
            push({ role: "director", text: `Locked: ${deduction}. Moving on.` });
            setShowCloser(false);
          }} />
        )}
        {deductions.length > 0 && (
          <div className="card p-4">
            <h3 className="font-display text-lg gold-text mb-2">Recorded deductions</h3>
            <ul className="text-sm flex flex-col gap-1.5">{deductions.map((d, i) => <li key={i} className="opacity-80">🎬 {d}</li>)}</ul>
          </div>
        )}
      </div>

      {/* Generation */}
      <div className="flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="font-display text-xl gold-text mb-2">Reference frame</h3>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onRefFile(e.target.files[0])} />
          <div className="flex gap-2 items-center">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={() => fileRef.current?.click()}>Upload frame</button>
            {refImg && <button className="btn-gold px-4 py-2 text-sm" onClick={analyzeRef} disabled={visionBusy}>{visionBusy ? "Reading…" : "Analyze it"}</button>}
          </div>
          {refImg && <img src={refImg} alt="reference" className="mt-3 rounded-lg max-h-48 object-contain border border-[rgba(212,175,55,0.2)]" />}
          {vision && <p className="text-sm opacity-80 mt-3 whitespace-pre-wrap">{vision}</p>}
        </div>

        <div className="card p-4">
          <div className="flex gap-2 mb-3">
            {(["image", "video", "voice"] as const).map((k) => (
              <button key={k} className={`px-4 py-2 text-sm rounded-lg border ${genKind === k ? "border-[rgba(212,175,55,0.8)] bg-[rgba(212,175,55,0.1)]" : "border-[rgba(212,175,55,0.25)] opacity-70"}`}
                onClick={() => setGenKind(k)}>{k === "image" ? "🖼 Image" : k === "video" ? "🎥 Video" : "🎙 Voice"}</button>
            ))}
          </div>

          {genKind !== "voice" ? (
            <>
              <textarea className="w-full px-3 py-2 text-sm mb-3" rows={3} placeholder="The shot: describe it like a trailer…" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              {!prompt.trim() ? <p className="text-xs opacity-60 mb-2">Write the shot first — then pick a cost tier.</p>
                : <CostPicker kind={genKind} onPick={(t, q) => (genKind === "image" ? genImage(t, q) : genVideo(t, q))} />}
            </>
          ) : (
            <>
              {activePreset && (
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.07)] mb-2 text-sm">
                  <span>🎙 Voice: <span className="gold-text font-medium">{activePreset.name}</span>
                    <span className="opacity-60"> · {activePreset.emotion}</span></span>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => saveActivePreset(null)} title="Clear preset">✕</button>
                </div>
              )}
              <p className="text-xs opacity-60 mb-2">Manual line entry <span className="opacity-70">(advanced)</span> — or open <span className="gold-text">🎧 Design the sound</span> and let the director write the lines for you.</p>
              <textarea className="w-full px-3 py-2 text-sm mb-2" rows={3} placeholder="The line — Arabic or English…" value={voiceText} onChange={(e) => setVoiceText(e.target.value)} />
              <select className="w-full px-3 py-2 text-sm mb-3" value={voice} onChange={(e) => setVoice(e.target.value)}>
                {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <button className="btn-gold px-5 py-2.5 text-sm w-full" onClick={genVoice} disabled={busy === "voice" || !voiceText.trim()}>
                {busy === "voice" ? "Recording…" : "Speak it — free"}
              </button>
            </>
          )}
          {busy && <p className="text-sm gold-text mt-3">🎬 {busy === "image" ? "Rendering image…" : busy === "video" ? "Rendering video…" : "Recording…"}</p>}
          {note && <p className="text-sm opacity-75 mt-2">{note}</p>}
        </div>
      </div>
    </div>

    {showLab && <VoiceLab />}

    {showSound && (
      <SoundDesign
        initialScene={soundScene}
        onNewItem={onNewItem}
        onPlanApproved={(summary) => {
          setDeductions((p) => [...p, summary]);
          push({ role: "director", text: `Sound locked. ${summary}` });
        }}
      />
    )}

    <Session items={items} onNewItem={onNewItem} />
    </div>
  );
}
