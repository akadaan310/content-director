import { NextResponse } from "next/server";

// Live status: VM director service (tunnel) + Modal endpoints.
export async function GET() {
  const apiUrl = (process.env.DIRECTOR_API_URL || "").replace(/\/$/, "");
  const imgUrl = (process.env.MODAL_IMAGE_URL || "").replace(/\/$/, "");
  const vidUrl = (process.env.MODAL_VIDEO_SUBMIT_URL || "").replace(/\/$/, "");

  const check = async (url: string, timeoutMs = 12000): Promise<"up" | "down" | "unconfigured"> => {
    if (!url) return "unconfigured";
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const r = await fetch(url, { signal: ctl.signal });
      clearTimeout(t);
      return r.ok || r.status === 405 ? "up" : "down"; // 405 = alive, POST-only
    } catch {
      return "down";
    }
  };

  const [director, image, video] = await Promise.all([
    check(apiUrl ? `${apiUrl}/api/health` : ""),
    check(imgUrl),
    check(vidUrl),
  ]);

  return NextResponse.json({
    ok: true,
    director, // VM: chat + Arabic TTS + reference-frame vision
    image,    // Modal: Pony SDXL
    video,    // Modal: Wan 2.1
    ready: director !== "down" && image !== "down",
    ts: new Date().toISOString(),
  });
}
