import { NextResponse } from "next/server";

// POST { prompt, kind: "sfx" | "vocalization" | "ambience", duration } -> audio/*
// Adapter for a dedicated sound-effects / non-speech-vocalization engine
// (e.g. Bark for vocalizations, Stable Audio Open for SFX).
//
// Honest state: no engine is provisioned yet, so this returns
// { ok: false, pending: true } with a one-line note. The sound-DESIGN layer
// (the director's SFX/ambience/vocalization plans) works fully and is saved;
// synthesis lights up the moment SFX_ENGINE_URL points at a running engine.
// Provision: run a Bark or Stable Audio Open server exposing POST /generate
// { prompt, kind, duration } -> audio bytes, then set SFX_ENGINE_URL and redeploy.
export async function POST(req: Request) {
  const engineUrl = (process.env.SFX_ENGINE_URL || "").replace(/\/$/, "");
  const body = await req.json().catch(() => ({}));
  const { prompt, kind = "sfx", duration = 5 } = body;
  if (!prompt?.trim())
    return NextResponse.json({ ok: false, error: "Prompt is required." }, { status: 400 });

  if (!engineUrl) {
    return NextResponse.json(
      {
        ok: false,
        pending: true,
        error:
          "SFX engine not provisioned yet — the design is saved and ready; synthesis lights up once a Bark / Stable Audio engine is running.",
      },
      { status: 503 }
    );
  }

  try {
    const r = await fetch(`${engineUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: String(prompt).slice(0, 500),
        kind,
        duration: Math.min(Math.max(Number(duration) || 5, 1), 30),
      }),
      signal: AbortSignal.timeout(300000),
    });
    if (!r.ok) throw new Error(`sfx engine returned ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "audio/wav";
    return new NextResponse(buf, { headers: { "Content-Type": ct } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `SFX engine failed: ${e.message}` }, { status: 502 });
  }
}

// GET -> whether an engine is provisioned (no audio generated)
export async function GET() {
  const engineUrl = (process.env.SFX_ENGINE_URL || "").replace(/\/$/, "");
  return NextResponse.json({ ok: true, provisioned: !!engineUrl });
}
