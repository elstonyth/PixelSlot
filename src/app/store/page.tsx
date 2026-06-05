import type { Metadata } from "next";
import Link from "next/link";
import { Store as StoreIcon } from "lucide-react";
import Reveal from "@/components/Reveal";
import { usd } from "@/lib/format";

export const metadata: Metadata = {
  title: "Store — Pokenic",
  description: "Buy packs directly across every category.",
};

type Product = { name: string; sub: string; image: string; price: number; boost?: boolean };
const PRODUCTS: Product[] = [
  { name: "Pokémon Elite", sub: "Pokémon", image: "/images/claw/elite-pack-icon.webp", price: 50, boost: true },
  { name: "Pokémon Mythic", sub: "Pokémon", image: "/images/claw/mythic-pack-icon.webp", price: 1000, boost: true },
  { name: "Pokémon Legend", sub: "Pokémon", image: "/images/claw/legend-pack-icon.webp", price: 250, boost: true },
  { name: "One Piece Legend", sub: "One Piece", image: "/images/claw/legend-one-piece-pack-icon.webp", price: 250, boost: true },
  { name: "One Piece Starter", sub: "One Piece", image: "/images/claw/starter-one-piece-pack-icon.webp", price: 25 },
  { name: "Basketball Black", sub: "Basketball", image: "/images/claw/black-pack-jjnfuk-icon.webp", price: 1000, boost: true },
  { name: "Baseball Pro", sub: "Baseball", image: "/images/claw/pro-baseball-pack-icon.webp", price: 100 },
  { name: "Football Elite", sub: "Football", image: "/images/claw/elite-football-pack-icon.webp", price: 50 },
  { name: "Soccer Pro", sub: "Soccer", image: "/images/claw/pro-soccer-pack-icon.webp", price: 100 },
  { name: "Yu-Gi-Oh! Pro", sub: "Yu-Gi-Oh!", image: "/images/claw/yugioh-pro-pack-icon.webp", price: 25 },
];

export default function StorePage() {
  return (
    <div className="mx-auto w-full px-fluid py-6">
      <Reveal as="header" className="mb-6">
        <div className="flex items-center gap-2.5">
          <StoreIcon className="h-5 w-5 text-white/70" aria-hidden />
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">Store</h1>
        </div>
        <p className="mt-2 text-sm text-white/55">Buy packs directly — every category, instant delivery to your vault.</p>
      </Reveal>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {PRODUCTS.map((p, i) => (
          <Reveal key={p.name} delay={Math.min(i, 9) * 50} className="h-full">
            <div className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors duration-300 hover:border-white/20">
              {p.boost && (
                <span className="self-start rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white shadow-sm">
                  +90% Buyback
                </span>
              )}
              <div className="flex flex-1 items-center justify-center py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.name} loading="lazy" className="h-32 w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-1" />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-white/40">{p.sub}</p>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-white">{p.name}</span>
                <span className="shrink-0 text-[13px] font-semibold text-white/90">{usd(p.price)}</span>
              </div>
              <Link href="/claw" className="mt-auto flex h-9 w-full items-center justify-center rounded-xl bg-neutral-200 text-[13px] font-semibold text-neutral-950 transition-colors hover:bg-white">
                Buy pack
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
