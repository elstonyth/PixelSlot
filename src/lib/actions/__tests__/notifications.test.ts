import { describe, it, expect, vi, beforeEach } from 'vitest';

// The real data modules import 'server-only' (throws outside an RSC) and touch
// next/headers — mock them wholesale so only the action logic under test runs.
const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  clientFetch: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/data/customer', () => ({
  getAuthToken: mocks.getAuthToken,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/medusa', () => ({
  sdk: { client: { fetch: mocks.clientFetch } },
}));
vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { markRead, markAllRead } from '../notifications';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthToken.mockResolvedValue('tok_1');
});

// Regression guard for the stale-feed bug: the rows on /notifications are
// LINKS, so marking one read unmounts the page and navigates away. Without an
// explicit revalidate, returning to /notifications serves the cached RSC
// payload rendered BEFORE the click — the row reappears unread even though the
// write committed. `cache: 'no-store'` does not help: it governs the fetch, not
// the router cache.
describe('markRead invalidates the notifications route', () => {
  it('revalidates /notifications after a successful mark-read', async () => {
    mocks.clientFetch.mockResolvedValue({
      id: 'noti_1',
      read_at: '2026-07-20T10:00:00.000Z',
    });

    const res = await markRead('noti_1');

    expect(res.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/notifications');
  });

  it('does NOT revalidate when the write failed', async () => {
    mocks.clientFetch.mockRejectedValue(new Error('boom'));

    const res = await markRead('noti_1');

    expect(res.ok).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('does NOT revalidate when logged out — nothing was written', async () => {
    mocks.getAuthToken.mockResolvedValue(undefined);

    const res = await markRead('noti_1');

    expect(res.ok).toBe(false);
    expect(mocks.clientFetch).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('markAllRead invalidates the notifications route', () => {
  it('revalidates /notifications after a successful bulk mark-read', async () => {
    mocks.clientFetch.mockResolvedValue({
      marked: 3,
      read_at: '2026-07-20T10:00:00.000Z',
    });

    const res = await markAllRead();

    expect(res.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/notifications');
  });

  it('does NOT revalidate when the bulk write failed', async () => {
    mocks.clientFetch.mockRejectedValue(new Error('boom'));

    const res = await markAllRead();

    expect(res.ok).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
