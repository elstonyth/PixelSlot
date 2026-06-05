'use client';

import { cn } from '@/lib/utils';

// Helper to build the real phygitals CDN card-image URL (Cloudflare image-resizing
// wrapper around the original img.phygitals.com source). Hotlinking the live CDN is
// fine for this dev clone.
const cardImg = (id: string) => `/cdn/cards/${id.replace(/[^\w.-]/g, "_")}.webp`;

const ROOKIE_ICON = '/images/claw/rookie-pack-icon.webp';
const ELITE_ICON = '/images/claw/elite-pack-icon.webp';

type Pull = {
  time: string;
  title: string;
  pack: 'Rookie Pack' | 'Elite Pack';
  image: string;
};

// Real extracted text + image URLs from the live phygitals.com "Recent Pulls" section.
const PULLS: Pull[] = [
  {
    time: '1m ago',
    title: '2021 Pokemon Japanese Sword & Shield Jet-Black Spirit Celebi V #3 CGC 10 GEM MINT',
    pack: 'Rookie Pack',
    image: cardImg('FQEYWuGiKTkJpZSG6XqGHDBmH6EmxctEqk1kAT2MYzHc'),
  },
  {
    time: '6m ago',
    title: '2025 Pokemon Japanese SV Glory Of Rocket Gang Holo Team Rockets Mewtwo ex CGC 10',
    pack: 'Rookie Pack',
    image: cardImg('9kRLkdbbvzm335GBvraQrWrNVs72gzEzynvP1RPvftTx'),
  },
  {
    time: '15m ago',
    title: '2023 Pokemon Sword and Shield Crown Zenith Galarian Gallery Darkrai Vstar #GG50 PSA 10',
    pack: 'Elite Pack',
    image: cardImg('4h13RDtFX4MWNYjvgMPeBS1hcL4AewupiFzDvyFUUTkd'),
  },
  {
    time: '15m ago',
    title: '2024 Pokemon Japanese Scarlet & Violet Terastal Fest ex Holo Jolteon ex #52 CGC 10 PRISTINE',
    pack: 'Elite Pack',
    image: cardImg('BEnddEeBXBHyL5qWXCg6sKS5VmUbUtZaKJ1aVB8yCWHN'),
  },
  {
    time: '15m ago',
    title: '2022 Pokemon Japanese Sword & Shield Star Birth Holo Shaymin VSTAR #13 CGC 9.5 MINT+',
    pack: 'Elite Pack',
    image: cardImg('FQEYWuGiKTkJpZSG6XqGHDBmH6EmxctEqk1kAT2MYzHc'),
  },
  {
    time: '16m ago',
    title: '2025 Pokemon Japanese Mega Start Deck 100 Battle Collection Reverse Holo Rapidash #90 CGC 10',
    pack: 'Rookie Pack',
    image: cardImg('FFbo5jfXHHQWN8bmc88UDYSDP5QzYCCj6RwUkiWYyffC'),
  },
  {
    time: '16m ago',
    title: '2022 Pokemon Japanese Sword & Shield Incandescent Arcana Ho-Oh V #55 CGC 10 GEM MINT',
    pack: 'Rookie Pack',
    image: cardImg('FjAJZ7en585MpnoLUGbuALHEmbBAPd61EZCefQzFMmRX'),
  },
  {
    time: '16m ago',
    title: '2023 Pokemon Japanese Scarlet & Violet 151 Holo Gengar #94 CGC 10 GEM MINT',
    pack: 'Rookie Pack',
    image: cardImg('6noxMybjBLtLqicAUTrG63VhWG2FgWzDBsQGnnZEyNCG'),
  },
];

function PullCard({ pull }: { pull: Pull }) {
  const icon = pull.pack === 'Elite Pack' ? ELITE_ICON : ROOKIE_ICON;
  return (
    <div
      className={cn(
        'group/card w-[240px] shrink-0 overflow-hidden rounded-2xl',
        'border border-neutral-700 bg-neutral-800',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:border-neutral-500 hover:shadow-xl hover:shadow-black/40',
      )}
    >
      <div className="flex flex-col">
        {/* Card image on a dark pedestal / spotlight backdrop */}
        <div className="relative aspect-square w-full overflow-hidden bg-[radial-gradient(120%_80%_at_50%_15%,#2e2e2e_0%,#1c1c1c_55%,#141414_100%)]">
          {/* Xm ago badge, top-right */}
          <span className="absolute right-2 top-2 z-10 rounded-full border border-white/10 bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {pull.time}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pull.image}
            alt={pull.title}
            width={238}
            height={238}
            loading="lazy"
            className="h-full w-full object-contain p-4 transition-transform duration-300 ease-out group-hover/card:scale-[1.04]"
          />
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 p-3">
          <p className="line-clamp-2 min-h-[40px] text-sm font-bold leading-5 text-white">
            {pull.title}
          </p>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={icon}
              alt={pull.pack}
              width={28}
              height={28}
              loading="lazy"
              className="h-7 w-7 shrink-0 object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-white">{pull.pack}</span>
              <span className="text-[10px] font-medium text-neutral-400">Just revealed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecentPullsSection() {
  return (
    <section className="w-full bg-neutral-950 py-16 sm:py-20">
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">
            Live from the claw
          </p>
          <h2 className="font-heading mt-1.5 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-2xl font-bold leading-tight tracking-tight text-transparent md:text-3xl">
            Recent Pulls
          </h2>
          <p className="mt-1.5 text-sm text-neutral-400">
            See what collectors are pulling right now.
          </p>
        </div>

        {/* Horizontally-scrollable row of pulled-card cards */}
        <div
          className={cn(
            'flex gap-4 overflow-x-auto pb-4',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            'snap-x snap-mandatory scroll-px-4',
          )}
        >
          {PULLS.map((pull, i) => (
            <div key={i} className="snap-start">
              <PullCard pull={pull} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
