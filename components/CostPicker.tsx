"use client";
import { useState } from "react";
import { imageQuotes, videoQuotes, VOICE_QUOTE, CHAT_QUOTE, fmtUsd, type TierQuote, type CostTier } from "@/lib/pricing";

export default function CostPicker({ kind, onPick }: { kind: "image" | "video"; onPick: (tier: CostTier, quote: TierQuote) => void }) {
  const quotes = kind === "image" ? imageQuotes() : videoQuotes(3);
  const [sel, setSel] = useState<TierQuote | null>(null);
  return (
    <div>
      <div className="grid gap-2 mb-3">
        {quotes.map((q) => (
          <button
            key={q.tier}
            className={`option-chip p-3 ${sel?.tier === q.tier ? "picked" : ""}`}
            onClick={() => setSel(q)}
          >
            <div className="flex justify-between items-baseline">
              <span className="font-medium text-sm">{q.label}</span>
              <span className="gold-text font-display text-lg">{fmtUsd(q.estUsd)} <span className="text-xs opacity-60">({fmtUsd(q.hiUsd)} max)</span></span>
            </div>
            <div className="text-xs opacity-60 mt-1">{q.desc} · {q.detail}</div>
          </button>
        ))}
      </div>
      <button
        className="btn-gold px-5 py-2.5 text-sm w-full"
        disabled={!sel}
        onClick={() => sel && onPick(sel.tier, sel)}
      >
        {sel ? `Generate — ${sel.label} (${fmtUsd(sel.estUsd)})` : "Pick a cost tier first"}
      </button>
      <p className="text-xs opacity-50 mt-2">Voice ({fmtUsd(VOICE_QUOTE.estUsd)}) and director chat ({fmtUsd(CHAT_QUOTE.estUsd)}) are always free.</p>
    </div>
  );
}
