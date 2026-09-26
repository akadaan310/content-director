import { NextResponse } from "next/server";

// POST { image (base64/dataURL), prompt? } -> { ok, analysis }
export async function POST(req: Request) {
  const apiUrl = (process.env.DIRECTOR_API_URL || "").replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ ok: false, error: "Vision service not configured." }, { status: 500 });
  const { image, prompt } = await req.json();
  if (!image) return NextResponse.json({ ok: false, error: "Image is required." }, { status: 400 });

  try {
    const r = await fetch(`${apiUrl}/api/director/vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, prompt }),
      signal: AbortSignal.timeout(300000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || `vision service returned ${r.status}`);
    }
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Vision failed: ${e.message}` }, { status: 502 });
  }
}
