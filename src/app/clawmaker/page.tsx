"use client";

import { useState } from "react";
import { Check, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/format";
import { MOCK_CARDS, RARITY_RGB } from "@/lib/mock/cards";

const POOL = MOCK_CARDS.slice(0, 18);

export default function ClawMakerPage() {
  const [name, setName] = useState("My Custom Pack");
  const [price, setPrice] = useState(25);
  const [picked, setPicked] = useState<Set<string>>(new Set(POOL.slice(0, 5).map((c) => c.id)));

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chosen = POOL.filter((c) => picked.has(c.id));
  const ev = chosen.length ? Math.round(chosen.reduce((a, c) => a + c.fmv, 0) / chosen.length) : 0;

  return (
    <div className="mx-auto w-full px-fluid py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <Wand2 className="h-5 w-5 text-fuchsia-400" aria-hidden />
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Claw Maker</h1>
        </div>
        <p className="mt-2 text-sm text-white/55">Build your own pack — pick the cards, set the price, publish a Claw.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Builder */}
        <div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/55">Pack name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white focus:border-white/25 focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/55">Entry price (USD)</span>
              <input type="number" min={1} value={price} onChange={(e) => setPrice(Math.max(1, Number(e.target.value) || 1))} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white focus:border-white/25 focus:outline-none" />
            </label>
          </div>

          <p className="mb-3 text-[13px] font-medium text-white/60">Choose cards ({chosen.length} selected)</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {POOL.map((c) => {
              const on = picked.has(c.id);
              const ring = RARITY_RGB[c.rarity];
              return (
                <button key={c.id} type="button" onClick={() => toggle(c.id)} className={cn("relative overflow-hidden rounded-xl border bg-neutral-800 p-1.5 transition-all", on ? "scale-[0.98]" : "border-white/10 hover:border-white/25")} style={on ? { borderColor: `rgb(${ring})`, boxShadow: `0 0 14px -6px rgb(${ring})` } : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image} alt={c.name} loading="lazy" className={cn("aspect-[3/4] w-full rounded-md object-contain", !on && "opacity-70")} />
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-neutral-950" style={{ background: `rgb(${ring})` }}>
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-heading text-lg font-bold text-white">{name || "Untitled Pack"}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="font-heading text-xl font-bold text-white">{usd(price)}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Entry</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="font-heading text-xl font-bold text-white">{chosen.length}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Cards</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="font-heading text-xl font-bold text-emerald-400">{usd(ev)}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Avg EV</p>
              </div>
            </div>
            <button type="button" disabled={chosen.length === 0} className="mt-4 w-full rounded-xl bg-neutral-200 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
              Publish Claw
            </button>
            <p className="mt-3 text-[11px] text-white/35">Demo only — odds tuning &amp; publishing connect to the backend.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
