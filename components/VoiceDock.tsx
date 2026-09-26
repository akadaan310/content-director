"use client";
import { useState, useEffect } from "react";
import { SOUND_VOICES } from "./SoundDesign";

// Emotion dial maps 1:1 to the portal backend's /api/director/tts `emotion` param.
export const DOCK_EMOTIONS = ["neutral", "warm", "soft", "cheerful", "dramatic", "tense"] as const;
export const VOICEDOCK_EVENT = "cd-voicedock";
const LS_KEY = "cd-voicedock";

export interface VoiceDockState {
  voice: string; // SOUND_VOICES id, default "sana"
  emotion: string; // DOCK_EMOTIONS, default "warm"
  autoVoice: boolean; // speak her replies automatically
}

export function getVoiceDock(): VoiceDockState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { voice: "sana", emotion: "warm", autoVoice: true, ...JSON.parse(raw) };
  } catch {}
  return { voice: "sana", emotion: "warm", autoVoice: true };
}

export function saveVoiceDock(s: VoiceDockState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
  window.dispatchEvent(new Event(VOICEDOCK_EVENT));
}

export default function VoiceDock() {
  const [s, setS] = useState<VoiceDockState>({ voice: "sana", emotion: "warm", autoVoice: true });

  useEffect(() => {
    setS(getVoiceDock());
  }, []);

  const upd = (patch: Partial<VoiceDockState>) => {
    const n = { ...s, ...patch };
    setS(n);
    saveVoiceDock(n);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xl gold-text">🎚 Her voice</h3>
        <button
          className={`px-3 py-1.5 text-xs rounded-lg border transition ${
            s.autoVoice
              ? "border-[rgba(212,175,55,0.6)] bg-[rgba(212,175,55,0.12)] gold-text"
              : "border-white/10 opacity-60"
          }`}
          onClick={() => upd({ autoVoice: !s.autoVoice })}
          title="Speak her replies automatically"
        >
          {s.autoVoice ? "🔊 auto-voice on" : "🔇 auto-voice off"}
        </button>
      </div>

      <label className="text-xs opacity-60 block mb-1">Dialect · voice</label>
      <select
        className="w-full px-3 py-2 text-sm mb-3"
        value={s.voice}
        onChange={(e) => upd({ voice: e.target.value })}
      >
        {SOUND_VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>

      <label className="text-xs opacity-60 block mb-2">Emotion · mood</label>
      <div className="flex gap-1.5 flex-wrap">
        {DOCK_EMOTIONS.map((e) => (
          <button
            key={e}
            onClick={() => upd({ emotion: e })}
            className={`px-3 py-1.5 text-xs rounded-full border capitalize transition ${
              s.emotion === e
                ? "border-[rgba(212,175,55,0.8)] bg-[rgba(212,175,55,0.15)] gold-text"
                : "border-white/10 opacity-60 hover:opacity-100"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <p className="text-xs opacity-50 mt-2">
        Voice {SOUND_VOICES.find((v) => v.id === s.voice)?.label.split(" — ")[0]} · feeling{" "}
        <span className="capitalize">{s.emotion}</span> — applies to every line she speaks.
      </p>
    </div>
  );
}
