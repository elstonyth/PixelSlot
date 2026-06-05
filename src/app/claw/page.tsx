"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Reveal from "@/components/Reveal";
import { type Pack, CATEGORIES } from "./packs-data";

// Pack catalog + types live in ./packs-data (shared with the /claw/[slug] detail page).
const TABS = [{ id: "all", tab: "All Packs" }, ...CATEGORIES.map((c) => ({ id: c.id, tab: c.tab }))];

// ---------------------------------------------------------------------------
// Pack card
// ---------------------------------------------------------------------------

function PackCard({
  pack,
  icon,
  qty,
  onQty,
}: {
  pack: Pack;
  icon: string;
  qty: number;
  onQty: (id: string, next: number) => void;
}) {
  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-colors duration-300 hover:border-white/20">
      {/* Green buyback-boost badge — only on boosted tiers */}
      {pack.boost && (
        <span className="absolute left-3 top-3 z-[2] rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white shadow-sm sm:text-[10px]">
          +90% Buyback Boost
        </span>
      )}

      {/* Category badge (top-right) — real per-category icon from the live site */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
        className="absolute right-3 top-3 z-[2] h-6 w-6 object-contain opacity-80"
      />

      {/* Pack image */}
      <div className="flex items-center justify-center pb-2 pt-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pack.image}
          alt={pack.name}
          width={200}
          height={260}
          loading="lazy"
          className="h-40 w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out group-hover:-translate-y-1"
        />
      </div>

      {/* Name + price */}
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-white sm:text-sm">{pack.name}</span>
        <span className="shrink-0 text-[13px] font-semibold text-white/90 sm:text-sm">{pack.price}</span>
      </div>

      {/* Quantity stepper */}
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${pack.name} quantity`}
          onClick={() => onQty(pack.id, qty - 1)}
          disabled={qty <= 1}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="flex h-7 flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[13px] font-medium tabular-nums text-white">
          {qty}
        </span>
        <button
          type="button"
          aria-label={`Increase ${pack.name} quantity`}
          onClick={() => onQty(pack.id, qty + 1)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Set ${pack.name} to max quantity`}
          onClick={() => onQty(pack.id, 99)}
          className="flex h-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 text-[10px] font-bold uppercase tracking-wide text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          Max
        </button>
      </div>

      {/* Open button → pack detail / opening template */}
      <Link
        href={`/claw/${pack.id}`}
        className="mt-auto flex h-9 w-full items-center justify-center rounded-xl bg-neutral-200 text-[13px] font-semibold text-neutral-950 transition-colors duration-200 hover:bg-white"
      >
        Open
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClawPage() {
  const [active, setActive] = useState<string>("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const setQty = (id: string, next: number) => {
    const clamped = Math.min(99, Math.max(1, next));
    setQuantities((prev) => ({ ...prev, [id]: clamped }));
  };

  const visible = active === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.id === active);

  return (
    <div className="mx-auto w-full px-fluid py-4">
      {/* Top filter bar */}
      <div className="sticky top-2 z-20 mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-950/80 p-2 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60 sm:flex-row sm:items-center sm:justify-between">
        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              aria-pressed={active === t.id}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors sm:text-[13px]",
                active === t.id
                  ? "bg-white text-neutral-950"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              {t.tab}
            </button>
          ))}
        </div>

        {/* Sort + Create (presentational) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:text-[13px]"
          >
            Most Popular
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] font-semibold text-neutral-950 transition-colors hover:bg-white sm:text-[13px]"
          >
            Create Pack
          </button>
        </div>
      </div>

      {/* Category sections */}
      <div className="flex flex-col gap-10">
        {visible.map((cat) => (
          <section key={cat.id}>
            <Reveal as="div" className="mb-4 flex items-center gap-1.5">
              <h2 className="font-heading text-lg font-bold tracking-tight text-white sm:text-xl">
                {cat.heading}
              </h2>
              <ArrowUpRight className="h-4 w-4 text-white/30" aria-hidden />
            </Reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {cat.packs.map((pack, i) => (
                <Reveal key={pack.id} delay={Math.min(i, 8) * 60} className="h-full">
                  <PackCard
                    pack={pack}
                    icon={cat.icon}
                    qty={quantities[pack.id] ?? 1}
                    onQty={setQty}
                  />
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
