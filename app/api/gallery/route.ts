import { NextResponse } from "next/server";

// GET -> { ok, items: [{ id, name, url (absolute), created }] }
// Uploads live on the portal backend under /data/director-uploads,
// served at {DIRECTOR_API_URL}/uploads/...
export async function GET() {
  const apiUrl = (process.env.DIRECTOR_API_URL || "").replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ ok: false, error: "Director backend not configured." }, { status: 500 });
  try {
    const r = await fetch(`${apiUrl}/api/director/gallery`, { signal: AbortSignal.timeout(30000) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "gallery failed");
    const items = (d.items || []).map((it: any) => ({
      id: it.id,
      name: it.name,
      url: `${apiUrl}${it.url}`,
      created: it.created,
    }));
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Gallery failed: ${e.message}` }, { status: 502 });
  }
}
