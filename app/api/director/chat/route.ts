import { NextResponse } from "next/server";

// The VM brain can take 60-120s to first token; give Vercel room to stream it.
export const maxDuration = 300;

// POST { message, history, closer, closer_options, stream, persona, max_tokens } -> { ok, reply } or { ok, closer } or SSE token stream
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
        persona: body.persona === "tasneem" ? "tasneem" : "director",
        max_tokens: Number(body.max_tokens) > 0 ? Math.min(Number(body.max_tokens), 300) : 0,
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
