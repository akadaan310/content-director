"use client";
import { useState, useRef, useEffect } from "react";
import { SOUND_VOICES } from "./SoundDesign";
import { getActivePreset, PRESET_EVENT, type VoicePreset } from "./VoiceLab";

interface Msg {
  role: "user" | "her";
  text: string;
}

export const WORLD_EVENT = "cd-world";

// Sleepy bedtime greeting — spoken the moment he wakes her (instant, no brain wait).
const GREETING = "يا هلا بعبود… اشتقت لك. أنا نعسانة كتير، بس بدي أسمع صوتك قبل ما أنام.";

const blobToUrl = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });

const playUrl = (url: string): Promise<void> =>
  new Promise((res) => {
    const a = new Audio(url);
    a.onended = () => res();
    a.onerror = () => res();
    a.play().catch(() => res());
  });

export default function Tasneem() {
  const [awake, setAwake] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [preset, setPreset] = useState<VoicePreset | null>(null);
  const [world, setWorld] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [listening, setListening] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setPreset(getActivePreset());
    } catch {}
    const onPreset = () => {
      try {
        setPreset(getActivePreset());
      } catch {}
    };
    const onWorld = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) {
        setWorld((p) => [...p, detail].slice(-6));
        setNote("🌙 Her world updated — she'll feel it in the conversation.");
        setTimeout(() => setNote(""), 4000);
      }
    };
    window.addEventListener(PRESET_EVENT, onPreset);
    window.addEventListener(WORLD_EVENT, onWorld);
    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener(PRESET_EVENT, onPreset);
      window.removeEventListener(WORLD_EVENT, onWorld);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs]);

  const voiceId = preset?.voice || "sana";
  const ttsVoice = SOUND_VOICES.find((v) => v.id === voiceId)?.tts || "ar-JO-SanaNeural";

  // Live turns use PLAIN text (no SSML): prosody wrappers make Edge-TTS
  // render ar-JO speech 2-4x slower — wrong for real-time conversation.
  const synth = async (text: string): Promise<string> => {
    const r = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: ttsVoice }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || r.statusText);
    }
    return blobToUrl(await r.blob());
  };

  const push = (m: Msg) => setMsgs((p) => [...p, m]);

  const wake = async () => {
    if (awake) return;
    setAwake(true);
    push({ role: "her", text: GREETING });
    if (!muted) {
      setSpeaking(true);
      try {
        const url = await synth(GREETING);
        await playUrl(url);
      } catch {
        /* she still shows the words */
      }
      setSpeaking(false);
    }
  };

  const send = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || busy || !awake) return;
    setInput("");
    push({ role: "user", text });
    setBusy(true);
    setElapsed(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    const history = msgs.slice(-4).map((m) => ({
      role: m.role === "her" ? "assistant" : "user",
      content: m.text.slice(0, 300),
    }));
    const contextPrefix =
      world.length > 0
        ? `[What you know about her world right now: ${world.join(" | ").slice(0, 600)}]\n\n`
        : "";

    const audioQueue: Promise<string>[] = [];
    let queuedLen = 0;
    const queueSentences = (acc: string) => {
      let rest = acc.slice(queuedLen);
      for (;;) {
        const m = rest.match(/^(.+?[.؟?!\n…])\s*/);
        if (!m) break;
        const sentence = m[1].trim();
        if (sentence.length > 2) audioQueue.push(synth(sentence));
        queuedLen += m[0].length;
        rest = acc.slice(queuedLen);
      }
    };

    try {
      const r = await fetch("/api/director/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: contextPrefix + text,
          history,
          stream: true,
          persona: "tasneem",
          max_tokens: 80,
        }),
      });
      const ctype = r.headers.get("content-type") || "";
      if (!r.ok || !r.body || !ctype.includes("text/event-stream")) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || r.statusText);
      }
      push({ role: "her", text: "" });
      const updateLast = (t: string) =>
        setMsgs((p) => {
          const n = [...p];
          n[n.length - 1] = { ...n[n.length - 1], text: t };
          return n;
        });
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buf = "";
      let gotToken = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") {
            buf = "";
            break;
          }
          if (!payload.startsWith("{")) continue;
          try {
            const d = JSON.parse(payload);
            if (d.token) {
              acc += d.token;
              gotToken = true;
              updateLast(acc);
              if (!muted) queueSentences(acc);
            } else if (d.error) throw new Error(d.error);
          } catch (e) {
            if (e instanceof Error && !/token|JSON/i.test(e.message)) throw e;
          }
        }
      }
      if (!gotToken) {
        updateLast("…عيوني بتسكر، عبود. قولها مرة تانية؟");
      } else if (!muted) {
        // Speak: sentence-chunked — first sentence was already synthesizing while she kept talking.
        const tail = acc.slice(queuedLen).trim();
        if (tail.length > 2) audioQueue.push(synth(tail));
        setSpeaking(true);
        for (const p of audioQueue) {
          try {
            const url = await p;
            await playUrl(url);
          } catch {
            /* keep going with the rest */
          }
        }
        setSpeaking(false);
      }
    } catch (e: unknown) {
      push({
        role: "her",
        text: `…الخط عم يقطع. جرب مرة تانية يا حبيبي. (${e instanceof Error ? e.message : "unknown"})`,
      });
    }
    if (timer.current) clearInterval(timer.current);
    setBusy(false);
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR =
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition;
    if (!SR) {
      setNote("🎙 Voice input isn't supported in this browser — type to her instead.");
      setTimeout(() => setNote(""), 4000);
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "ar-JO";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const t: string = e.results?.[0]?.[0]?.transcript || "";
        setListening(false);
        if (t.trim()) send(t.trim());
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setNote("🎙 Couldn't start the microphone.");
      setTimeout(() => setNote(""), 4000);
    }
  };

  const orbClass = `orb ${!awake ? "orb-asleep" : ""} ${speaking ? "orb-speaking" : ""} ${
    busy && !speaking ? "orb-thinking" : ""
  }`;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div className="card p-6 text-center">
        <div className={orbClass} onClick={wake} title={awake ? "Tasneem" : "Tap to wake her"}>
          <div className="orb-ring" />
        </div>
        <h2 className="font-display text-3xl gold-text mt-4">Tasneem</h2>
        <p className="text-xs opacity-60 mt-1">
          {!awake ? (
            <button className="gold-text underline underline-offset-4" onClick={wake}>
              tap to wake her 💤
            </button>
          ) : speaking ? (
            <span className="gold-text">
              <span className="speaking-bars mr-2">
                <span />
                <span />
                <span />
                <span />
              </span>
              speaking…
            </span>
          ) : busy ? (
            <span>she's thinking… {elapsed}s</span>
          ) : (
            <span>
              live · {preset ? `voice: ${preset.name}` : "Jordanian Arabic · sleepy"} ·{" "}
              <button className="underline underline-offset-4 opacity-70" onClick={() => setMuted((m) => !m)}>
                {muted ? "unmute her" : "mute"}
              </button>
            </span>
          )}
        </p>
      </div>

      {awake && (
        <>
          <div className="card p-4 flex flex-col gap-2 max-h-96 overflow-y-auto">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`text-sm p-2.5 rounded-lg max-w-[92%] ${
                  m.role === "her"
                    ? "bg-[rgba(212,175,55,0.07)] border border-[rgba(212,175,55,0.2)]"
                    : "bg-white/5 self-end"
                }`}
              >
                {m.role === "her" && <div className="text-xs gold-text mb-1">TASNEEM</div>}
                <div className="whitespace-pre-wrap" dir="auto">
                  {m.text}
                </div>
              </div>
            ))}
            {busy && msgs.length > 0 && msgs[msgs.length - 1].role === "user" && (
              <div className="text-xs opacity-60">she's thinking… {elapsed}s</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="card p-3">
            <div className="flex gap-2">
              <button
                className={`btn-ghost px-4 py-2 text-sm ${listening ? "activate-glow" : ""}`}
                onClick={toggleMic}
                title="Talk to her"
              >
                {listening ? "●…" : "🎙"}
              </button>
              <input
                className="flex-1 px-3 py-2 text-sm"
                placeholder="Talk to her…"
                value={input}
                dir="auto"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button className="btn-gold px-5 py-2 text-sm" onClick={() => send()} disabled={busy || !input.trim()}>
                Send
              </button>
            </div>
            {note && <p className="text-xs opacity-70 mt-2">{note}</p>}
          </div>
        </>
      )}
    </div>
  );
}
