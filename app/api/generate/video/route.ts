import { NextResponse } from "next/server";

// POST { prompt, clips } -> { ok, calls: [{ clip, call_id }] }
// Each clip = 5s (81 frames @16fps). Chain clips for longer scenes.
export async function POST(req: Request) {
  const submitUrl = (process.env.MODAL_VIDEO_SUBMIT_URL || "").replace(/\/$/, "");
  if (!submitUrl) return NextResponse.json({ ok: false, error: "Video engine not configured." }, { status: 500 });
  const { prompt, clips = 1 } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ ok: false, error: "Prompt is required." }, { status: 400 });
  const n = Math.min(3, Math.max(1, clips));

  try {
    const calls: { clip: number; call_id: string }[] = [];
    for (let i = 0; i < n; i++) {
      const r = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${prompt.slice(0, 1500)} — clip ${i + 1} of ${n}, continuous scene`, num_frames: 81 }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error(`engine returned ${r.status}`);
      const data = await r.json();
      const callId = data.call_id || data.callId || data.id;
      if (!callId) throw new Error("engine gave no call id");
      calls.push({ clip: i + 1, call_id: callId });
    }
    return NextResponse.json({ ok: true, calls, engine: "Wan 2.1 1.3B · A10G" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Video submit failed: ${e.message}` }, { status: 502 });
  }
}
