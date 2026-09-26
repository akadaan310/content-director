import { NextResponse } from "next/server";

// POST { image (base64/dataURL), name } -> { ok, id, name, url (absolute) }
// Persists to the portal backend -> /data/director-uploads.
export async function POST(req: Request) {
  const apiUrl = (process.env.DIRECTOR_API_URL || "").replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ ok: false, error: "Director backend not configured." }, { status: 500 });
  const { image, name } = await req.json().catch(() => ({}));
  if (!image) return NextResponse.json({ ok: false, error: "Image is required." }, { status: 400 });
  try {
    const r = await fetch(`${apiUrl}/api/director/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, name: String(name || "upload").slice(0, 60) }),
      signal: AbortSignal.timeout(120000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.detail || d.error || `upload returned ${r.status}`);
    return NextResponse.json({ ok: true, id: d.id, name: d.name, url: `${apiUrl}${d.url}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Upload failed: ${e.message}` }, { status: 502 });
  }
}
