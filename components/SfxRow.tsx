"use client";
import { useState, useEffect } from "react";

// Compact SFX trigger row for the Tasneem studio.
// Honest wiring: GET /api/sfx tells us whether an engine is provisioned.
// If not, the triggers render disabled with an "arriving" state — no fake audio.
const TRIGGERS = [
  { id: "ambience", label: "🌊 Ambience", prompt: "quiet night ambience, soft room tone, distant city hum", kind: "ambience" },
  { id: "whoosh", label: "💨 Whoosh", prompt: "cinematic whoosh transition, airy sweep", kind: "sfx" },
  { id: "impact", label: "💥 Impact", prompt: "soft cinematic impact, deep thud with a gentle tail", kind: "sfx" },
  { id: "transition", label: "✨ Transition", prompt: "dreamy shimmer transition, gentle chimes fading out", kind: "sfx" },
];

export default function SfxRow() {
  const [provisioned, setProvisioned] = useState<boolean | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/sfx")
      .then((r) => r.json())
      .then((d) => setProvisioned(!!d.provisioned))
      .catch(() => setProvisioned(false));
  }, []);

  const fire = async (t: (typeof TRIGGERS)[number]) => {
    if (busy || !provisioned) return;
    setBusy(t.id);
    setNote("");
    try {
      const r = await fetch("/api/sfx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: t.prompt, kind: t.kind, duration: 5 }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && d.pending) {
        setNote("⏳ SFX engine arriving — the cue is queued for when synthesis lights up.");
      } else if (!r.ok) {
        throw new Error(d.error || r.statusText);
      } else {
        const blob = await r.blob();
        new Audio(URL.createObjectURL(blob)).play().catch(() => {});
        setNote(`🔊 ${t.label} played.`);
      }
    } catch (e: unknown) {
      setNote(`SFX failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    setBusy("");
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-xl gold-text">🔊 Sound effects</h3>
        {provisioned === false && (
          <span className="text-xs opacity-50">engine arriving…</span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {TRIGGERS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm rounded-lg border transition ${
              provisioned
                ? "border-[rgba(212,175,55,0.4)] hover:bg-[rgba(212,175,55,0.1)]"
                : "border-white/10 opacity-40 cursor-not-allowed"
            }`}
            onClick={() => fire(t)}
            disabled={!provisioned || busy !== ""}
            title={provisioned ? t.prompt : "SFX engine arriving — triggers enable when synthesis is live"}
          >
            {busy === t.id ? "…" : t.label}
          </button>
        ))}
      </div>
      {provisioned === false && (
        <p className="text-xs opacity-50 mt-2">
          ⏳ The SFX engine isn't provisioned yet — these light up the moment it is. Sound
          <em> design</em> (plans, voice lines) works today in the Director tab.
        </p>
      )}
      {note && <p className="text-xs opacity-70 mt-2">{note}</p>}
    </div>
  );
}
