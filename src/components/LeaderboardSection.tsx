'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useInView, usePrefersReducedMotion } from '@/lib/use-reveal';

type LeaderboardEntry = {
  rank: number;
  name: string;
  volume: string;
  pulls: string;
  points: string;
  avatar: string;
};

// Real data + avatar URLs extracted verbatim from phygitals.com homepage "Weekly Leaderboard".
const ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1,
    name: 'FightingProdigy3098',
    volume: 'US$8,173,374.26',
    pulls: '1403',
    points: '812,296,655',
    avatar: '/images/pfps/pfp-30.webp',
  },
  {
    rank: 2,
    name: 'love',
    volume: 'US$4,293,513.36',
    pulls: '232',
    points: '428,287,429',
    avatar: '/images/pfps/pfp-81.webp',
  },
  {
    rank: 3,
    name: 'PsychicGuardian5685',
    volume: 'US$1,399,630.64',
    pulls: '723',
    points: '139,937,985',
    avatar: '/images/pfps/pfp-71.webp',
  },
  {
    rank: 4,
    name: 'HyperResearcher7463',
    volume: 'US$1,189,685.65',
    pulls: '360',
    points: '118,968,718',
    avatar: '/images/pfps/pfp-58.webp',
  },
  {
    rank: 5,
    name: 'PrinceOfDragons',
    volume: 'US$469,126.15',
    pulls: '827',
    points: '46,912,908',
    avatar: '/images/pfps/pfp-31.webp',
  },
  {
    rank: 6,
    name: 'AncientMaster2024',
    volume: 'US$392,343.09',
    pulls: '41',
    points: '39,234,328',
    avatar: '/images/pfps/pfp-60.webp',
  },
  {
    rank: 7,
    name: 'RapidDefender3371',
    volume: 'US$358,774.38',
    pulls: '120',
    points: '35,737,514',
    avatar: '/images/pfps/pfp-1.webp',
  },
  {
    rank: 8,
    name: 'EnergyProdigy7233',
    volume: 'US$298,032.28',
    pulls: '33',
    points: '29,803,240',
    avatar: '/images/pfps/pfp-76.webp',
  },
  {
    rank: 9,
    name: 'RockHunter9181',
    volume: 'US$230,400',
    pulls: '12',
    points: '23,040,000',
    avatar: '/images/pfps/pfp-66.webp',
  },
  {
    rank: 10,
    name: 'AquaCatcher6841',
    volume: 'US$214,782.06',
    pulls: '82',
    points: '21,478,238',
    avatar: '/images/pfps/pfp-28.webp',
  },
];

function Avatar({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={32}
      height={32}
      loading="lazy"
      className="h-8 w-8 shrink-0 rounded-full object-cover"
    />
  );
}

export default function LeaderboardSection({ showHeading = true }: { showHeading?: boolean }) {
  // Rows stagger-fade-up when the leaderboard scrolls into view (the "leaderboard
  // goes in" animation). Fires once; respects prefers-reduced-motion.
  const [ref, shown] = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const show = shown || reduced;

  return (
    <div ref={ref} className="mt-10 sm:mt-14">
      {/* Header — shown on the homepage section; hidden on the /leaderboard route
          (which has its own podium/tabs), matching the live site. */}
      {showHeading && (
        <div className="mb-4 flex items-baseline justify-between sm:mb-5">
          <h2 className="font-heading bg-gradient-to-b from-white via-white/80 to-white/30 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Weekly Leaderboard
          </h2>
          <a
            href="/leaderboard?tab=prizes"
            className="text-[12px] font-medium text-white/45 transition-colors hover:text-white/60"
          >
            View prizes →
          </a>
        </div>
      )}

      {/* Card */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
        {/* Mobile list */}
        <div className="block divide-y divide-neutral-800 sm:hidden">
          {ENTRIES.map((e, i) => (
            <div
              key={e.rank}
              style={{ transitionDelay: show && !reduced ? `${i * 45}ms` : "0ms" }}
              className={cn(
                "flex items-center justify-between px-4 py-3 hover:bg-neutral-800/50",
                !reduced && "transition-[opacity,transform] duration-500 ease-out",
                show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-5 shrink-0 text-sm text-neutral-400">
                  {e.rank}
                </span>
                <Avatar src={e.avatar} name={e.name} />
                <Link href={`/profile/${e.name}`} className="truncate text-sm text-neutral-50 hover:underline">
                  {e.name}
                </Link>
              </div>
              <span className="shrink-0 pl-3 text-sm text-neutral-50">
                {e.points}{' '}
                <span className="text-neutral-400">pts</span>
              </span>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="px-6 py-1 text-center text-sm font-medium text-neutral-400">
                  #
                </th>
                <th className="px-4 py-1 text-left text-sm font-medium text-neutral-400">
                  Name
                </th>
                <th className="px-4 py-1 text-left text-sm font-medium text-neutral-400">
                  Volume
                </th>
                <th className="px-4 py-1 text-center text-sm font-medium text-neutral-400">
                  Claw Pulls
                </th>
                <th className="px-6 py-1 text-right text-sm font-medium text-neutral-400">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {ENTRIES.map((e, i) => (
                <tr
                  key={e.rank}
                  style={{ transitionDelay: show && !reduced ? `${i * 45}ms` : "0ms" }}
                  className={cn(
                    "border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50",
                    !reduced && "transition-[opacity,transform] duration-500 ease-out",
                    show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                  )}
                >
                  <td className="px-6 py-4 text-center text-sm text-neutral-50">
                    {e.rank}
                  </td>
                  <td className="px-4 py-4 text-left text-sm text-neutral-50">
                    <div className="flex items-center gap-3">
                      <Avatar src={e.avatar} name={e.name} />
                      <Link href={`/profile/${e.name}`} className="whitespace-nowrap hover:underline">{e.name}</Link>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-left text-sm text-neutral-50">
                    {e.volume}
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-neutral-50">
                    {e.pulls}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-neutral-50">
                    {e.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
