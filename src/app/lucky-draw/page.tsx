"use client";

import { useState } from "react";
import Link from "next/link";
import { Ticket, Clock, Users, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Reveal from "@/components/Reveal";
import { usd } from "@/lib/format";
import { MOCK_CARDS, RARITY_RGB } from "@/lib/mock/cards";

const STATUS = ["Live", "Ended"] as const;
const GRADE = ["All", "Graded", "Ungraded"] as const;

// Mock draws (raffles for a prize card).
const DRAWS = MOCK_CARDS.slice(0, 15).map((card, i) => ({
  card,
  entry: 1 + (i % 5),
  filled: 12 + ((i * 17) % 80),
  total: 100,
  time: i % 7 === 6 ? "Ended" : `${(i % 5) + 1}h ${(i * 9) % 60}m`,
  graded: i % 3 !== 0,
  ended: i % 7 === 6,
}));

export default function LuckyDrawPage() {
  const [status, setStatus] = useState<(typeof STATUS)[number]>("Live");
  const [grade, setGrade] = useState<(typeof GRADE)[number]>("All");

  const draws = DRAWS.filter((d) => (status === "Ended" ? d.ended : !d.ended)).filter((d) =>
    grade === "All" ? true : grade === "Graded" ? d.graded : !d.graded,
  );

  return (
    <div className="mx-auto w-full px-fluid py-4">
      {/* Header */}
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            <Ticket className="h-6 w-6 text-fuchsia-400" aria-hidden /> Live Draws
          </h1>
          <p className="mt-2 text-sm text-white/55">Enter for a chance to win graded cards. Every ticket counts.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">How It Works</button>
          <button type="button" className="rounded-xl bg-neutral-200 px-4 py-2 text-[13px] font-semibold text-neutral-950 transition-colors hover:bg-white">Create Draw</button>
        </div>
      </section>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {STATUS.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-lg px-4 py-1.5 text-sm font-medium transition-colors", status === s ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80")}>{s}</button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {GRADE.map((g) => (
            <button key={g} type="button" onClick={() => setGrade(g)} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", grade === g ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70")}>{g}</button>
          ))}
        </div>
        <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] font-medium text-white/70 transition-colors hover:text-white">
          Ends Soonest <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* Draw grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {draws.map((d, i) => {
          const ring = RARITY_RGB[d.card.rarity];
          const pct = Math.min(100, Math.round((d.filled / d.total) * 100));
          return (
            <Reveal key={d.card.id} delay={Math.min(i, 6) * 50} className="h-full">
              <div
                className="group flex h-full flex-col rounded-2xl p-px transition-all duration-300 hover:-translate-y-1"
                style={{ background: d.ended ? "rgba(255,255,255,0.1)" : `linear-gradient(160deg, rgb(${ring}), rgba(${ring},0.25) 48%, rgba(255,255,255,0.06))` }}
              >
                <div className="flex h-full flex-col overflow-hidden rounded-[15px] bg-neutral-900">
                  <div className="relative aspect-[3/4] overflow-hidden bg-neutral-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.card.image} alt={d.card.name} loading="lazy" className={cn("h-full w-full object-contain p-3", d.ended && "opacity-60 saturate-[0.7]")} />
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/10 backdrop-blur-sm">
                      {d.ended ? "Ended" : <><Sparkles className="h-3 w-3 text-fuchsia-400" aria-hidden /> {d.card.rarity}</>}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="line-clamp-2 min-h-[32px] text-[12px] font-medium leading-4 text-white">{d.card.name}</p>
                    <div className="flex items-center justify-between text-[11px] text-white/55">
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden />{d.filled}/{d.total}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5"><Clock className="h-3 w-3" aria-hidden />{d.time}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `rgb(${ring})` }} />
                    </div>
                    {d.ended ? (
                      <button type="button" disabled className="mt-1 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white/40">Drawn</button>
                    ) : (
                      <Link href={`/card/${d.card.id}`} className="mt-1 w-full rounded-xl bg-neutral-200 py-2 text-center text-xs font-semibold text-neutral-950 transition-colors hover:bg-white">Enter · {usd(d.entry)}</Link>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
      {draws.length === 0 && <p className="py-16 text-center text-sm text-white/40">No {status.toLowerCase()} draws right now.</p>}
    </div>
  );
}
