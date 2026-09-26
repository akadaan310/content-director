"use client";
import { useState } from "react";

interface CloserOption { label: string; note?: string }
interface CloserData { say: string; options: CloserOption[] }

const STAGES = [4, 3, 2]; // 4 options -> 3 -> final 2

export default function Closer({ topic, onDone }: { topic: string; onDone: (deduction: string, trail: string[]) => void }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [data, setData] = useState<CloserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [trail, setTrail] = useState<string[]>([]);
  const [error, setError] = useState("");

  const ask = async (n: number, context: string) => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/director/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: context, closer: true, closer_options: n }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "brain failed");
      if (d.closer) setData(d.closer);
      else setData({ say: d.reply || "The director weighs in:", options: [] });
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const start = () => {
    setStageIdx(0); setTrail([]);
    ask(4, `We are deciding: ${topic}. Open the closer with 4 distinct creative options.`);
  };

  const pick = (opt: CloserOption) => {
    const newTrail = [...trail, opt.label];
    setTrail(newTrail);
    if (stageIdx >= STAGES.length - 1) {
      onDone(opt.label, newTrail);
      setData(null);
      return;
    }
    const next = stageIdx + 1;
    setStageIdx(next);
    ask(STAGES[next], `Deciding: ${topic}. So far chosen: ${newTrail.join(" > ")}. Narrow to ${STAGES[next]} refined options building on that choice.`);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-xl gold-text">Closer</h3>
        {trail.length > 0 && <div className="text-xs opacity-60">{trail.join(" › ")}</div>}
      </div>
      {!data && !loading && (
        <button className="btn-gold px-5 py-2.5 text-sm" onClick={start}>
          Run the closer — {topic.slice(0, 40)}{topic.length > 40 ? "…" : ""}
        </button>
      )}
      {loading && <div className="text-sm opacity-70 py-4">The director is narrowing it down…</div>}
      {error && <div className="text-sm text-red-400 py-2">{error}</div>}
      {data && (
        <div>
          <p className="text-sm italic opacity-80 mb-3">“{data.say}”</p>
          <div className="grid gap-2">
            {data.options.map((o, i) => (
              <button key={i} className="option-chip p-3" onClick={() => pick(o)}>
                <div className="font-medium text-sm">{o.label}</div>
                {o.note && <div className="text-xs opacity-60 mt-1">{o.note}</div>}
              </button>
            ))}
          </div>
          <div className="text-xs opacity-50 mt-2">Stage {stageIdx + 1} of {STAGES.length} — tap one to narrow.</div>
        </div>
      )}
    </div>
  );
}
