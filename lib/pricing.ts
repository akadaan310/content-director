// Pricing — Modal GPU $/sec, re-verified live 2026-09-25 via modal.com/pricing.
// Mirrors /home/azureuser/hermes-agent/modal_cost.py PRICE_TABLE.

export const PRICE_PER_SEC: Record<string, number> = {
  T4: 0.000164,
  L4: 0.000222,
  A10G: 0.000306,
  L40S: 0.000542,
  "A100-40GB": 0.000583,
  "A100-80GB": 0.000694,
  H100: 0.001097,
};

export type CostTier = "economy" | "standard" | "fast";

export interface TierQuote {
  tier: CostTier;
  label: string;
  desc: string;
  estSeconds: number;
  estUsd: number;
  hiUsd: number;
  detail: string;
}

// Measured/estimated render times on A10G (from live probes + dispatch research).
const IMAGE_GPU = "A10G";
const VIDEO_GPU = "A10G";

export function imageQuotes(): TierQuote[] {
  const p = PRICE_PER_SEC[IMAGE_GPU];
  const mk = (tier: CostTier, label: string, desc: string, secs: number, steps: number): TierQuote => ({
    tier, label, desc,
    estSeconds: secs,
    estUsd: +(p * secs).toFixed(3),
    hiUsd: +(p * secs * 1.8 + 0.04).toFixed(3),
    detail: `Pony SDXL · ${steps} steps · 1024px · ~${secs}s on ${IMAGE_GPU}`,
  });
  return [
    mk("economy", "Economy", "Draft quality, fastest buck", 25, 20),
    mk("standard", "Standard", "Balanced quality", 37, 28),
    mk("fast", "Fast", "Max detail", 55, 40),
  ];
}

export function videoQuotes(clips = 3): TierQuote[] {
  const p = PRICE_PER_SEC[VIDEO_GPU];
  // Wan 2.1 1.3B: ~900s central / 1500s hi per 5s clip on A10G (measured research).
  const perClip = 900, perClipHi = 1500;
  const mk = (tier: CostTier, label: string, desc: string, n: number): TierQuote => {
    const secs = perClip * n;
    return {
      tier, label, desc,
      estSeconds: secs,
      estUsd: +(p * secs).toFixed(2),
      hiUsd: +(p * perClipHi * n + 0.08).toFixed(2),
      detail: `Wan 2.1 1.3B · ${n} clip${n > 1 ? "s" : ""} × 5s · 16fps · ~${Math.round(secs / 60)} min on ${VIDEO_GPU}`,
    };
  };
  return [
    mk("economy", "Economy", "One 5-second clip", Math.min(1, clips)),
    mk("standard", "Standard", "Two 5-second clips, chained", Math.min(2, clips)),
    mk("fast", "Fast", "Three 5-second clips, chained", Math.max(3, clips)),
  ];
}

export const VOICE_QUOTE: TierQuote = {
  tier: "standard",
  label: "Voice",
  desc: "Arabic dialect TTS",
  estSeconds: 3,
  estUsd: 0,
  hiUsd: 0,
  detail: "Edge-TTS · Jordanian/Gaza Arabic + English · free, ~3s",
};

export const CHAT_QUOTE: TierQuote = {
  tier: "standard",
  label: "Director chat",
  desc: "Creative-director AI",
  estSeconds: 30,
  estUsd: 0,
  hiUsd: 0,
  detail: "Local uncensored 7B · free · ~4 tok/s",
};

export function fmtUsd(n: number): string {
  return n === 0 ? "free" : `$${n.toFixed(n < 1 ? 3 : 2)}`;
}
