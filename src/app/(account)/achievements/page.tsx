import type { Metadata } from "next";
import { Crown, Flame, Star, Award, Trophy, Gem, Rocket, Target } from "lucide-react";
import { AccountHeader, DemoNote } from "@/components/account/ui";

export const metadata: Metadata = { title: "Achievements | Pokenic" };

const BADGES = [
  { icon: Crown, label: "Top 100", desc: "Reach the weekly top 100", tint: "text-amber-400", done: true },
  { icon: Flame, label: "Century", desc: "Open 100 packs", tint: "text-orange-400", done: true },
  { icon: Star, label: "First Legendary", desc: "Pull a legendary card", tint: "text-fuchsia-400", done: true },
  { icon: Award, label: "Vault Veteran", desc: "Vault 50 cards", tint: "text-sky-400", done: true },
  { icon: Gem, label: "Grail Hunter", desc: "Own a $1,000+ card", tint: "text-emerald-400", done: false },
  { icon: Trophy, label: "Champion", desc: "Finish #1 weekly", tint: "text-amber-400", done: false },
  { icon: Rocket, label: "Big Spender", desc: "$10k lifetime volume", tint: "text-rose-400", done: false },
  { icon: Target, label: "Sharpshooter", desc: "Pull 10 chase cards", tint: "text-violet-400", done: false },
];

export default function AchievementsPage() {
  return (
    <>
      <AccountHeader title="Achievements" sub="Earn badges as you collect, compete, and trade." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {BADGES.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.label} className={`flex flex-col items-center gap-2 rounded-2xl border border-white/10 p-6 text-center ${b.done ? "bg-white/[0.04]" : "bg-white/[0.01] opacity-55"}`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <Icon className={`h-6 w-6 ${b.tint}`} aria-hidden />
              </span>
              <span className="text-[13px] font-semibold text-white">{b.label}</span>
              <span className="text-[11px] leading-snug text-white/45">{b.desc}</span>
            </div>
          );
        })}
      </div>
      <DemoNote />
    </>
  );
}
