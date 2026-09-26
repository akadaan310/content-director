// Backend adapter interface. Modal is live; Kaggle/RunPod are clean stubs
// for later funding. Nothing here holds credential values — endpoints come
// from server env vars (see README).

export type BackendName = "modal" | "kaggle" | "runpod" | "local";

export interface BackendAdapter {
  name: BackendName;
  label: string;
  status: "live" | "stub";
  note: string;
  generateImage?: (prompt: string, steps: number, seed: number) => Promise<string>; // data URL
  submitVideo?: (prompt: string, numFrames: number) => Promise<string>; // call_id
  pollVideo?: (callId: string) => Promise<{ done: boolean; video?: string }>;
}

export const ADAPTERS: BackendAdapter[] = [
  {
    name: "modal",
    label: "Modal · A10G serverless",
    status: "live",
    note: "Pony SDXL images + Wan 2.1 video. Per-second billing, zero idle. ~$12 credit on the workspace.",
  },
  {
    name: "kaggle",
    label: "Kaggle · free 30h/week",
    status: "stub",
    note: "Free T4x2 — wired when the API key lands. Adapter interface ready.",
  },
  {
    name: "runpod",
    label: "RunPod · RTX 4090",
    status: "stub",
    note: "Cheapest paid path (~$0.34/hr). Plug in an endpoint + API key when funded.",
  },
];

export function activeBackend(): BackendAdapter {
  return ADAPTERS[0]; // modal — the only live one
}
