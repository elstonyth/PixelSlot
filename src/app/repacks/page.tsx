"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Reveal from "@/components/Reveal";
import { usd } from "@/lib/format";
import { MOCK_USERS } from "@/lib/mock/users";

const CATS = [
  { tab: "All Packs", icon: "" },
  { tab: "Pokémon", icon: "/pack-index-icons/pokemon.webp" },
  { tab: "Basketball", icon: "/pack-index-icons/nba.webp" },
  { tab: "Football", icon: "/pack-index-icons/nfl.webp" },
  { tab: "One Piece", icon: "/pack-index-icons/onepiece.webp" },
  { tab: "Baseball", icon: "/pack-index-icons/mlb.webp" },
  { tab: "Soccer", icon: "/pack-index-icons/soccer.webp" },
  { tab: "Yu-Gi-Oh!", icon: "/pack-index-icons/yugioh.webp" },
  { tab: "Riftbound", icon: "/pack-index-icons/riftbound.webp" },
  { tab: "Dragon Ball", icon: "/pack-index-icons/dragonball.webp" },
];

const ART = [
  "/images/claw/mythic-pack-icon.webp", "/images/claw/legend-pack-icon.webp", "/images/claw/elite-pack-icon.webp",
  "/images/claw/platinum-pack-icon.webp", "/images/claw/rookie-pack-icon.webp", "/images/claw/legend-one-piece-pack-icon.webp",
  "/images/claw/black-pack-jjnfuk-icon.webp", "/images/claw/pro-baseball-pack-icon.webp",
];
const NAMES = ["Party Pack", "Mini 50/50 Pack", "Double Chance", "10% Mythic Mini", "Chase Hunter", "Grail Pack", "Daily Ripper", "Lucky Dip", "Rookie Rush", "High Roller", "Budget Banger", "Whale Pack"];
const CAT_OF = ["Pokémon", "Basketball", "One Piece", "Pokémon", "Football", "Baseball", "Soccer", "Pokémon", "Yu-Gi-Oh!", "Basketball", "Pokémon", "One Piece"];

const PACKS = NAMES.map((name, i) => ({
  id: `repack-${i}`,
  name,
  cat: CAT_OF[i],
  image: ART[i % ART.length],
  price: [10, 50, 15, 50, 150, 250, 5, 25, 25, 500, 10, 1000][i],
  creator: MOCK_USERS[i % MOCK_USERS.length],
  boost: i % 2 === 0,
}));

export default function RepacksPage() {
  const [cat, setCat] = useState("All Packs");
  const packs = cat === "All Packs" ? PACKS : PACKS.filter((p) => p.cat === cat);

  return (
    <div className="mx-auto w-full px-fluid py-4">
      <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Community Repacks</h1>
          <p className="mt-2 text-sm text-white/55">Curated pulls with 85% guaranteed buyback. Filter and sort to find your next rip.</p>
        </div>
        <button type="button" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-neutral-200 px-4 py-2 text-[13px] font-semibold text-neutral-950 transition-colors hover:bg-white">
          <Plus className="h-4 w-4" aria-hidden /> Create a Claw
        </button>
      </section>

      {/* Category tabs */}
      <div className="mb-4 flex gap-0 overflow-x-auto border-b border-white/10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATS.map((c) => (
          <button key={c.tab} type="button" onClick={() => setCat(c.tab)} className={cn("-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors", cat === c.tab ? "border-white text-white" : "border-transparent text-neutral-400 hover:text-white")}>
            {c.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.icon} alt="" aria-hidden className="h-5 w-5 shrink-0 rounded-full object-cover" />
            )}
            {c.tab}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex items-center gap-2">
        <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/10"><SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters</button>
        <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] font-medium text-white/70 transition-colors hover:text-white">Last Pulled <ChevronDown className="h-3.5 w-3.5" aria-hidden /></button>
      </div>

      {/* Pack grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {packs.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i, 8) * 50} className="h-full">
            <div className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors duration-300 hover:border-white/20">
              {p.boost && <span className="absolute left-3 top-3 z-[2] rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white shadow-sm">+85% Buyback</span>}
              <div className="flex items-center justify-center pb-2 pt-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.name} loading="lazy" className="h-36 w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-1" />
              </div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-white">{p.name}</span>
                <span className="shrink-0 text-[13px] font-semibold text-white/90">{usd(p.price)}</span>
              </div>
              <Link href={`/profile/${p.creator.username}`} className="mb-2 flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.creator.pfp} alt="" className="h-4 w-4 rounded-full object-cover" />
                <span className="truncate">by {p.creator.username}</span>
              </Link>
              <Link href="/claw" className="mt-auto flex h-9 w-full items-center justify-center rounded-xl bg-neutral-200 text-[13px] font-semibold text-neutral-950 transition-colors hover:bg-white">Open</Link>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
