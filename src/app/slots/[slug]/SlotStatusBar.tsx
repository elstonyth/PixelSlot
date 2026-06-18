// src/app/slots/[slug]/SlotStatusBar.tsx
'use client';

import { usd } from '@/lib/format';
import type { RecentPull } from '@/lib/data/packs';

export function SlotStatusBar({
  balance,
  recent,
  reduced,
}: {
  balance: number | null;
  recent: RecentPull[];
  reduced: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-5">
        {balance !== null && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Credit
            </p>
            <p className="font-heading text-lg font-bold tabular-nums text-white">
              {usd(balance)}
            </p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Wins
          </p>
          <p className="font-heading text-lg font-bold tabular-nums text-white">
            {recent.length}
          </p>
        </div>
      </div>
      {/* RECENT WINS marquee — reuses sp-scroll-x (frozen under reduced motion).
          sp-scroll-x is defined inline in CommunitySection.tsx (not globals.css),
          so the Tailwind arbitrary class won't resolve — use inline style fallback. */}
      {recent.length > 0 && (
        <div className="relative max-w-full overflow-hidden sm:max-w-[55%]">
          <div
            className="flex w-max gap-4"
            style={{
              animation: reduced
                ? undefined
                : 'sp-scroll-x 30s linear infinite',
            }}
          >
            {[...recent, ...recent].map((p, i) => (
              <span
                key={`${p.id}-${i}`}
                className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/50"
              >
                <span className="font-medium text-white/75">{p.name}</span>
                <span className="tabular-nums text-white/40">{p.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
