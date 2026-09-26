import { NextResponse } from "next/server";

// TTS synthesis can take a while on the VM; give Vercel room.
export const maxDuration = 180;

// POST { text, voice, ssml, emotion } -> audio/mpeg (proxied through the VM's Edge-TTS)
export async function POST(req: Request) {
  const apiUrl = (process.env.DIRECTOR_API_URL || "").replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ ok: false, error: "Voice service not configured." }, { status: 500 });
  const { text, voice = "ar-JO-SanaNeural", ssml = false, emotion = "neutral" } = await req.json();
  if (!text?.trim()) return NextResponse.json({ ok: false, error: "Text is required." }, { status: 400 });

  try {
    const r = await fetch(`${apiUrl}/api/director/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2000), voice, ssml, emotion }),
      signal: AbortSignal.timeout(120000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || `voice service returned ${r.status}`);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return new NextResponse(buf, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Voice failed: ${e.message}` }, { status: 502 });
  }
}

// GET -> voice list
export async function GET() {
  const apiUrl = (process.env.DIRECTOR_API_URL || "").replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ ok: false, error: "Voice service not configured." }, { status: 500 });
  try {
    const r = await fetch(`${apiUrl}/api/director/voices`, { signal: AbortSignal.timeout(30000) });
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Voice list failed: ${e.message}` }, { status: 502 });
  }
}
