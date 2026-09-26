"use client";
import { useState } from "react";
import { imageQuotes, videoQuotes, VOICE_QUOTE, CHAT_QUOTE, fmtUsd } from "@/lib/pricing";

type EngineState = "idle" | "warming" | "ready" | "error";

export default function ActivatePanel({ onReady }: { onReady: () => void }) {
  const [state, setState] = useState<EngineState>("idle");
  const [detail, setDetail] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const img = imageQuotes()[1];
  const vid = videoQuotes(3)[2];

  const activate = async () => {
    setState("warming"); setError("");
    try {
      const r = await fetch("/api/status");
      const d = await r.json();
      setDetail({ director: d.director, image: d.image, video: d.video });
      if (d.ready) { setState("ready"); onReady(); }
      else { setState("error"); setError("Something didn't come up. Check the details below — nothing was spent."); }
    } catch (e: any) { setState("error"); setError(e.message); }
  };

  const dot = (s: string) => s === "up" ? "status-ready" : s === "down" ? "status-error" : "status-cold";

  return (
    <div className="card p-6 max-w-2xl mx-auto">
      <h2 className="font-display text-3xl gold-text mb-1">Content Director</h2>
      <p className="text-sm opacity-70 mb-5">On-demand studio. Engines sleep until you wake them — zero idle cost.</p>

      <div className="mb-5">
        <h3 className="text-sm font-medium mb-2 opacity-80">What things cost — before you spend a cent</h3>
        <div className="grid gap-1.5 text-sm">
          <div className="flex justify-between"><span>Image (Standard)</span><span className="gold-text">{fmtUsd(img.estUsd)}</span></div>
          <div className="flex justify-between"><span>Video, 15s (Fast)</span><span className="gold-text">{fmtUsd(vid.estUsd)} <span className="opacity-60 text-xs">({fmtUsd(vid.hiUsd)} max)</span></span></div>
          <div className="flex justify-between"><span>Voice — Jordanian Arabic</span><span className="gold-text">{fmtUsd(VOICE_QUOTE.estUsd)}</span></div>
          <div className="flex justify-between"><span>Director chat</span><span className="gold-text">{fmtUsd(CHAT_QUOTE.estUsd)}</span></div>
        </div>
        <p className="text-xs opacity-50 mt-2">Per-second serverless billing. First generation may take 1–3 min (cold start) — after that it's fast.</p>
      </div>

      {state === "idle" && (
        <button className="btn-gold activate-glow px-8 py-4 text-lg w-full" onClick={activate}>
          ● ACTIVATE THE STUDIO
        </button>
      )}
      {state === "warming" && (
        <div className="text-center py-4">
          <div className="status-dot status-warming mx-auto mb-3" style={{ width: 18, height: 18 }}></div>
          <p className="text-sm opacity-80">Warming the engines… checking the director brain, image and video.</p>
        </div>
      )}
      {state === "ready" && (
        <div className="text-center py-2">
          <p className="gold-text font-display text-2xl mb-1">Studio is live.</p>
          <p className="text-xs opacity-60">Go to the Studio tab. Deactivate when you're done — engines go back to sleep.</p>
        </div>
      )}
      {state === "error" && (
        <div>
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button className="btn-ghost px-5 py-2.5 text-sm w-full" onClick={activate}>Try again</button>
        </div>
      )}

      {Object.keys(detail).length > 0 && (
        <div className="mt-4 pt-4 border-t border-[rgba(212,175,55,0.15)] grid gap-1.5 text-sm">
          <div className="flex items-center gap-2"><span className={`status-dot ${dot(detail.director)}`}></span>Director brain + Arabic voice + frame vision<span className="opacity-50 text-xs ml-auto">{detail.director}</span></div>
          <div className="flex items-center gap-2"><span className={`status-dot ${dot(detail.image)}`}></span>Image engine<span className="opacity-50 text-xs ml-auto">{detail.image}</span></div>
          <div className="flex items-center gap-2"><span className={`status-dot ${dot(detail.video)}`}></span>Video engine<span className="opacity-50 text-xs ml-auto">{detail.video}</span></div>
        </div>
      )}
    </div>
  );
}
