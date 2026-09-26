import { NextResponse } from "next/server";

// POST { message, history, closer, closer_options, stream } -> { ok, reply } or { ok, closer } or SSE token stream
export async function POST(req: Request) {
  const apiUrl = (process.env.DIRECTOR_API_URL || "").replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ ok: false, error: "Director brain not configured." }, { status: 500 });
  const body = await req.json();
  const stream = !!body.stream;

  try {
    const r = await fetch(`${apiUrl}/api/director/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: (body.message || "").slice(0, 4000),
        history: Array.isArray(body.history) ? body.history.slice(-10) : [],
        closer: !!body.closer,
        closer_options: body.closer_options || 4,
        stream,
      }),
      signal: AbortSignal.timeout(300000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || `director brain returned ${r.status}`);
    }
    if (stream) {
      // Pass the backend's SSE token stream straight through so words appear as they're generated.
      return new Response(r.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Director brain failed: ${e.message}` }, { status: 502 });
  }
}
