import type { Metadata } from 'next';
import LeaderboardClient from './LeaderboardClient';
import { getLeaderboard } from '@/lib/data/leaderboard';
import { getOwnProfileHandle } from '@/lib/data/profiles';
import { getAvatarFrames } from '@/lib/data/avatar-frames';

// Live leaderboard, aggregated from the gacha Pull ledger. Fetched server-side
// (the storefront origin can reach the backend; the browser is CORS-blocked) and
// rendered per-request so it always reflects the current ledger.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaderboard',
};

export default async function LeaderboardPage() {
  const [avatarFrames, ownHandle] = await Promise.all([
    getAvatarFrames(),
    // null when logged out — the client hides the "your rank" card then.
    getOwnProfileHandle().catch(() => null),
  ]);
  const [weekly, alltime] = await Promise.all([
    getLeaderboard('weekly', avatarFrames),
    getLeaderboard('alltime', avatarFrames),
  ]);

  return (
    <LeaderboardClient
      weekly={weekly}
      alltime={alltime}
      ownHandle={ownHandle}
    />
  );
}
