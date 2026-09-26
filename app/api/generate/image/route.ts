import { NextResponse } from "next/server";

// POST { prompt, steps, seed } -> { ok, image: dataUrl, usd }
export async function POST(req: Request) {
  const endpoint = (process.env.MODAL_IMAGE_URL || "").replace(/\/$/, "");
  if (!endpoint) return NextResponse.json({ ok: false, error: "Image engine not configured." }, { status: 500 });
  const { prompt, steps = 28, seed = 42 } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ ok: false, error: "Prompt is required." }, { status: 400 });

  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: Math.min(60, Math.max(10, steps)), seed }),
      signal: AbortSignal.timeout(600000),
    });
    if (!r.ok) throw new Error(`engine returned ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    return NextResponse.json({
      ok: true,
      image: `data:image/png;base64,${buf.toString("base64")}`,
      engine: "Pony SDXL · A10G",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Image engine failed: ${e.message}` }, { status: 502 });
  }
}
