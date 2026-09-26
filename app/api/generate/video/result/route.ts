import { NextResponse } from "next/server";

// GET ?call_id=... -> { ok, done, video?: dataUrl }
export async function GET(req: Request) {
  const resultUrl = (process.env.MODAL_VIDEO_RESULT_URL || "").replace(/\/$/, "");
  const callId = new URL(req.url).searchParams.get("call_id");
  if (!resultUrl) return NextResponse.json({ ok: false, error: "Video engine not configured." }, { status: 500 });
  if (!callId) return NextResponse.json({ ok: false, error: "call_id required." }, { status: 400 });

  try {
    const r = await fetch(`${resultUrl}?call_id=${encodeURIComponent(callId)}`, {
      signal: AbortSignal.timeout(120000),
    });
    if (r.status === 202) return NextResponse.json({ ok: true, done: false });
    if (!r.ok) throw new Error(`engine returned ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await r.json();
      if (data.status === "pending" || data.done === false) return NextResponse.json({ ok: true, done: false });
      return NextResponse.json({ ok: true, done: true, video: data.video || data.url });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) return NextResponse.json({ ok: true, done: false });
    return NextResponse.json({ ok: true, done: true, video: `data:video/mp4;base64,${buf.toString("base64")}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Video poll failed: ${e.message}` }, { status: 502 });
  }
}
