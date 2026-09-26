import { NextResponse } from "next/server";
import { imageQuotes, videoQuotes, VOICE_QUOTE, CHAT_QUOTE } from "@/lib/pricing";

export async function GET() {
  return NextResponse.json({
    ok: true,
    image: imageQuotes(),
    video: videoQuotes(3),
    voice: VOICE_QUOTE,
    chat: CHAT_QUOTE,
    currency: "USD",
    billing: "per-second serverless — zero idle cost. Estimates before, never after.",
  });
}
