# Content Director

On-demand uncensored creative-director studio. Open the app → **Activate** → the engines warm up → direct your session → deactivate. Zero idle cost.

## How it works

- **Activate tab** — shows real cost estimates *before* anything spins up, then warms the engines (Modal serverless endpoints + the VM director service). Nothing generates without an explicit pick.
- **Studio tab** — the creative director AI (method-acting, trailer mode), decision **closers** (4 → 3 → final 2, recorded), reference-frame upload + analysis, and generation: image / video / Arabic-dialect voice.
- **🎧 Sound Design** (in Studio) — the director designs the AUDIO for your scene: he writes the voice lines, picks the voices (Jordanian/Gaza Arabic or English) and the emotion direction (whisper → intense, via SSML), and lays out sound effects, ambience beds, and non-speech emotional vocalizations. You review, tweak, and approve each cue — you never have to type a phrase yourself. Voice lines synthesize free via Edge-TTS. SFX/vocalization synthesis is *pending engine* (see below).
- **🎬 Scene Composer** (in Studio) — picture + sound designed together: pick one visual (image or video) + up to 4 audio tracks, then render one combined video right in the browser (canvas + WebAudio mix + MediaRecorder). Lands in the gallery as a `.webm`, downloadable.
- **Gallery tab** — everything generated, viewable and downloadable.

## Wired vs stubbed (honest)

**LIVE:**
- Image — Modal A10G, Pony SDXL, 1024px (~$0.008–0.02)
- Video — Modal A10G, Wan 2.1 1.3B, 5s clips, chained up to 15s (~$0.3–1.8)
- Voice — Edge-TTS, **free**: Jordanian Arabic (Sana/Taim), Egyptian, Saudi, Lebanese, Syrian + English. SSML supported for phoneme/synthesis research.
- Director chat + closers — uncensored 7B brain on the VM (free, ~4 tok/s)
- Reference-frame analysis — moondream VLM on the VM (free)

**STUBBED (interface ready, needs funding/keys):**
- Kaggle adapter — free 30 GPU-h/week, needs API key
- RunPod adapter — RTX 4090 ~$0.34/hr, needs account + funds
- **SFX / vocalization engine — PENDING.** The design layer is fully wired (`/api/sfx` adapter + UI), but no synthesis engine is running yet. Candidates: Bark (non-speech vocalizations — sighs, breaths, exertion — for phoneme/perturbation research) or Stable Audio Open (SFX/ambience). Both need a GPU box; current options are a Modal endpoint (would burn from the ~$7 left on abed-2622 — needs his explicit go) or the koda-vm CPU (slow). To provision: run a server exposing `POST /generate { prompt, kind, duration } -> audio bytes`, set `SFX_ENGINE_URL`, redeploy. Nothing explicit ever; real people non-explicit; no adult workloads on Modal.

**Notes:**
- Cost estimates are pre-"speed package" (a parallel optimization may make video 3–5× faster/cheaper).
- Video clips render ~15 min each on current settings; the UI polls for you.
- The Telegram director keeps running as-is; this app is the new home for generation sessions.

## Vercel env vars (names only — set values in the Vercel dashboard)

| Name | What |
|---|---|
| `DIRECTOR_API_URL` | VM tunnel URL of the portal backend (no trailing slash). Powers chat, voice, vision. |
| `MODAL_IMAGE_URL` | Modal image endpoint URL |
| `MODAL_VIDEO_SUBMIT_URL` | Modal video submit endpoint URL |
| `MODAL_VIDEO_RESULT_URL` | Modal video result endpoint URL |
| `SFX_ENGINE_URL` | (optional) SFX/vocalization engine base URL — unset = synthesis shows "pending engine" |

No secrets are stored in this repo. Ever.

## Develop

```bash
npm install
npm run dev
```
