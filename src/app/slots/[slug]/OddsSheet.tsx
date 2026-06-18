// src/app/slots/[slug]/OddsSheet.tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ODDS } from '@/app/claw/packs-data';

/** Published rarity-odds list. Never exposes the win-rate lock (PRD §3.7/§8). */
export function OddsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Published pull odds by rarity"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold tracking-tight text-white">
            Pull odds by rarity
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close odds"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ul className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          {ODDS.map((o) => (
            <li
              key={o.rarity}
              className="flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-b-0"
            >
              <span className="flex items-center gap-2.5 text-[13px] font-medium text-white">
                <span className={cn('h-2.5 w-2.5 rounded-full', o.dot)} />
                {o.rarity}
              </span>
              <span className="text-[13px] tabular-nums text-white/55">
                {o.chance}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-[11px] text-white/35">
          Indicative odds — final rates are published by the backend.
        </p>
      </div>
    </div>
  );
}
