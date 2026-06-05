"use client";

import { useState } from "react";
import { Store, Star, ArrowUpRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import Reveal from "@/components/Reveal";

type Merchant = { name: string; region: string; cat: string; rating: number; blurb: string };
const MERCHANTS: Merchant[] = [
  { name: "CardVault EU", region: "Europe", cat: "Pokémon", rating: 4.9, blurb: "A continent-wide marketplace with tracked, insured worldwide shipping." },
  { name: "Kingdom Cards", region: "USA", cat: "Sports", rating: 4.8, blurb: "A trusted source for graded sports cards and supplies since 2007." },
  { name: "TCG Bazaar", region: "North America", cat: "Magic", rating: 4.7, blurb: "One of the largest marketplaces for collectible card games online." },
  { name: "Collector's Den", region: "USA", cat: "Yu-Gi-Oh!", rating: 4.6, blurb: "Trading cards, board games, and collectibles — a partner since 1991." },
  { name: "Prisma Cards", region: "Japan", cat: "Pokémon", rating: 4.9, blurb: "Direct-from-Japan singles, sealed product, and exclusive promos." },
  { name: "Vintage Vault", region: "USA", cat: "Sports", rating: 4.7, blurb: "Specialists in vintage and high-grade slabs with white-glove handling." },
  { name: "DuelHaus", region: "Europe", cat: "Yu-Gi-Oh!", rating: 4.5, blurb: "Competitive singles and tournament supplies shipped fast across the EU." },
  { name: "Spellbound Cards", region: "North America", cat: "Magic", rating: 4.8, blurb: "Curated rares, foils, and commander staples with buylist pricing." },
];
const CATS = ["All", "Pokémon", "Magic", "Yu-Gi-Oh!", "Sports"];

export default function MerchantsPage() {
  const [cat, setCat] = useState("All");
  const list = cat === "All" ? MERCHANTS : MERCHANTS.filter((m) => m.cat === cat);

  return (
    <div className="mx-auto w-full px-fluid py-6">
      <Reveal as="header" className="mb-5">
        <div className="flex items-center gap-2.5">
          <Store className="h-5 w-5 text-amber-400" aria-hidden />
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Trusted Merchants</h1>
        </div>
        <p className="mt-2 text-sm text-white/55">A curated selection of verified trading-card merchants worldwide.</p>
      </Reveal>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={cn("rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors", cat === c ? "bg-white text-neutral-950" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white")}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m, i) => (
          <Reveal key={m.name} delay={Math.min(i, 8) * 50} className="h-full">
            <a href="#" className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-white/15 to-white/5 font-heading text-base font-bold text-white">
                  {m.name.charAt(0)}
                </span>
                <ArrowUpRight className="h-4 w-4 text-white/30 transition-colors group-hover:text-white/60" aria-hidden />
              </div>
              <h2 className="mt-3 font-heading text-base font-bold text-white">{m.name}</h2>
              <div className="mt-1 flex items-center gap-3 text-[12px] text-white/45">
                <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" aria-hidden />{m.region}</span>
                <span className="inline-flex items-center gap-1 text-amber-400"><Star className="h-3 w-3 fill-current" aria-hidden />{m.rating}</span>
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">{m.cat}</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-white/55">{m.blurb}</p>
            </a>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
