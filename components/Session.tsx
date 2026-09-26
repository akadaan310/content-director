"use client";
import { useState, useRef, useEffect } from "react";
import type { GalleryItem } from "./Studio";

// Scene composer: picture + sound designed TOGETHER.
// Pick one visual (image or video) + up to 4 audio tracks (voice lines, SFX,
// ambience), then render a single combined video. Rendering happens entirely
// in the browser — the visual is drawn to a canvas, the audio tracks are mixed
// with WebAudio, and the mix is captured with MediaRecorder. No server needed.
export default function Session({ items, onNewItem }: { items: GalleryItem[]; onNewItem: (item: GalleryItem) => void }) {
  const [visualId, setVisualId] = useState("");
  const [audioIds, setAudioIds] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState("");
  const [result, setResult] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const visuals = items.filter((i) => i.kind === "image" || i.kind === "video");
  const audios = items.filter((i) => i.kind === "audio");
  const visual = visuals.find((v) => v.id === visualId);
  const chosenAudios = audioIds.map((id) => audios.find((a) => a.id === id)).filter((a): a is GalleryItem => !!a);

  const toggleAudio = (id: string) =>
    setAudioIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));

  const dataUrlToObjectUrl = async (d: string) => {
    const r = await fetch(d);
    return URL.createObjectURL(await r.blob());
  };

  const loadMedia = <T extends HTMLMediaElement>(el: T, url: string): Promise<T> =>
    new Promise((res, rej) => {
      el.onloadedmetadata = () => res(el);
      el.onerror = () => rej(new Error("could not load media"));
      el.src = url;
    });

  const pickMime = () => {
    const c = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", ""];
    for (const m of c) {
      try { if (!m || (window as any).MediaRecorder?.isTypeSupported(m)) return m; } catch {}
    }
    return "";
  };

  const render = async () => {
    if (!visual || rendering) return;
    setRendering(true); setResult(""); setNote("Setting up the mix…"); setElapsed(0);
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    const urls: string[] = [];
    try {
      const W = 1280, H = 720;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");

      const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
      await actx.resume();
      const mixDest = actx.createMediaStreamDestination();

      // Audio tracks -> one mixed stream
      const audioEls: HTMLAudioElement[] = [];
      for (const a of chosenAudios) {
        const url = await dataUrlToObjectUrl(a.dataUrl); urls.push(url);
        const el = await loadMedia(new Audio(), url);
        const src = actx.createMediaElementSource(el);
        const gain = actx.createGain(); gain.gain.value = 1;
        src.connect(gain); gain.connect(mixDest); gain.connect(actx.destination);
        audioEls.push(el);
      }

      // Visual -> canvas
      let duration = 6;
      let stopDraw = false;
      let vel: HTMLVideoElement | undefined;
      if (visual.kind === "video") {
        const vurl = await dataUrlToObjectUrl(visual.dataUrl); urls.push(vurl);
        const v = await loadMedia(document.createElement("video"), vurl);
        v.muted = true; v.playsInline = true;
        duration = v.duration || 6;
        const draw = () => {
          if (stopDraw) return;
          const s = Math.max(W / v.videoWidth, H / v.videoHeight);
          const dw = v.videoWidth * s, dh = v.videoHeight * s;
          ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
          requestAnimationFrame(draw);
        };
        draw();
        v.play().catch(() => {});
        vel = v;
      } else {
        const iurl = await dataUrlToObjectUrl(visual.dataUrl); urls.push(iurl);
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("image failed")); img.src = iurl; });
        const s = Math.max(W / img.width, H / img.height);
        const dw = img.width * s, dh = img.height * s;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        const longest = Math.max(0, ...audioEls.map((e) => e.duration || 0));
        duration = Math.max(4, Math.min(longest || 6, 120));
      }

      const canvasStream = (canvas as HTMLCanvasElement).captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...mixDest.stream.getAudioTracks(),
      ]);
      const mime = pickMime();
      const rec = new MediaRecorder(combined, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<void>((res) => { rec.onstop = () => res(); });
      rec.start(500);

      for (const e of audioEls) { e.currentTime = 0; e.play().catch(() => {}); }
      setNote(`Rolling… rendering ${Math.round(duration)}s of picture + ${chosenAudios.length} audio track${chosenAudios.length === 1 ? "" : "s"} (${elapsed}s)`);
      await new Promise((r) => setTimeout(r, Math.min(duration, 180) * 1000));
      stopDraw = true;
      if (vel) vel.pause();
      for (const e of audioEls) e.pause();
      rec.stop();
      await done;

      const blob = new Blob(chunks, { type: "video/webm" });
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      setResult(dataUrl);
      onNewItem({
        id: `${Date.now()}-scene`,
        kind: "video",
        label: `🎬 Scene · ${visual.label} + ${chosenAudios.length} audio`,
        prompt: `Composed scene: ${visual.label} with ${chosenAudios.map((a) => a.label).join(", ") || "no audio"}`,
        dataUrl,
        createdAt: new Date().toLocaleString(),
        cost: "free",
      });
      setNote("Scene rendered — preview it above, it's in your gallery too.");
      actx.close().catch(() => {});
    } catch (e: any) {
      setNote(`Render failed: ${e.message}`);
    }
    urls.forEach((u) => URL.revokeObjectURL(u));
    if (timer.current) clearInterval(timer.current);
    setRendering(false);
  };

  if (visuals.length === 0)
    return (
      <div className="card p-4">
        <h3 className="font-display text-xl gold-text mb-1">🎬 Scene Composer</h3>
        <p className="text-sm opacity-60">Generate an image or a video clip first — then come back and marry it to sound here.</p>
      </div>
    );

  return (
    <div className="card p-4">
      <h3 className="font-display text-xl gold-text mb-1">🎬 Scene Composer</h3>
      <p className="text-xs opacity-60 mb-3">
        Picture and sound, designed together: pick one visual, stack up to 4 audio tracks (voice lines, effects, ambience) — then render one combined video, right in your browser.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm gold-text mb-2">1 · The visual</h4>
          <div className="grid grid-cols-3 gap-2">
            {visuals.map((v) => (
              <button key={v.id} onClick={() => setVisualId(v.id)}
                className={`rounded-lg overflow-hidden border-2 ${visualId === v.id ? "border-[rgba(212,175,55,0.9)]" : "border-transparent opacity-60"}`}>
                {v.kind === "image"
                  ? <img src={v.dataUrl} alt={v.label} className="w-full h-16 object-cover" />
                  : <video src={v.dataUrl} className="w-full h-16 object-cover" muted playsInline />}
              </button>
            ))}
          </div>
          {visual && <p className="text-xs opacity-60 mt-1.5">{visual.label}</p>}
        </div>
        <div>
          <h4 className="text-sm gold-text mb-2">2 · The sound <span className="opacity-50">({audioIds.length}/4)</span></h4>
          {audios.length === 0 && <p className="text-xs opacity-60">No audio yet — design some in 🎧 Sound Design above, or record a line.</p>}
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {audios.map((a) => (
              <button key={a.id} onClick={() => toggleAudio(a.id)}
                className={`text-left text-xs px-3 py-2 rounded-lg border ${audioIds.includes(a.id) ? "border-[rgba(212,175,55,0.8)] bg-[rgba(212,175,55,0.08)]" : "border-white/10 opacity-70"}`}>
                {audioIds.includes(a.id) ? "✓ " : ""}{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="btn-gold px-5 py-2.5 text-sm w-full mt-4" onClick={render} disabled={!visual || rendering}>
        {rendering ? `Rendering… ${elapsed}s` : "🎬 Render the scene"}
      </button>
      {note && <p className="text-sm opacity-75 mt-2">{note}</p>}
      {result && (
        <div className="mt-3">
          <video src={result} controls playsInline className="rounded-lg w-full max-h-72 bg-black" />
        </div>
      )}
    </div>
  );
}
