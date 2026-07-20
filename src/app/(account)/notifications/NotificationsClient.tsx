'use client';

import { useState } from 'react';
import Link from 'next/link';
import { relativeTime } from '@/lib/format';
import { markRead, markAllRead } from '@/lib/actions/notifications';
import type { Notification } from '@/lib/actions/notifications';
import { copyFor } from '@/lib/notifications/copy';

export default function NotificationsClient({
  initial,
}: {
  initial: Notification[];
}) {
  const [items, setItems] = useState<Notification[]>(initial);
  const [clearing, setClearing] = useState(false);
  const unread = items.filter((n) => !n.readAt).length;

  async function onRead(id: string) {
    // Optimistic — mark read locally immediately.
    setItems((xs) =>
      xs.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    );
    const r = await markRead(id);
    if (!r.ok) {
      setItems((xs) =>
        xs.map((n) => (n.id === id ? { ...n, readAt: null } : n)),
      );
    }
  }

  async function onClearAll() {
    // Snapshot for rollback: only the rows this action actually flips.
    const wasUnread = items.filter((n) => !n.readAt).map((n) => n.id);
    if (wasUnread.length === 0) return;
    setClearing(true);
    const now = new Date().toISOString();
    setItems((xs) => xs.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    const r = await markAllRead();
    if (!r.ok) {
      const revert = new Set(wasUnread);
      setItems((xs) =>
        xs.map((n) => (revert.has(n.id) ? { ...n, readAt: null } : n)),
      );
    }
    setClearing(false);
  }

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-white/50">No notifications yet.</p>;
  }

  return (
    <>
      {/* Derived from the rows we already hold — the server's unread_count is
          page-scoped over the same 50 rows, so passing it in would be a second
          source of truth for the same number. */}
      {unread > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void onClearAll()}
            disabled={clearing}
            className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : `Mark all read (${unread})`}
          </button>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {items.map((n) => {
          const copy = copyFor(n.template);
          const Icon = copy.icon;
          const body = copy.body(n.data);
          const isUnread = !n.readAt;

          const inner = (
            <>
              <span
                aria-hidden
                className={
                  isUnread
                    ? 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white'
                    : 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-white/50'
                }
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/90">
                  {copy.title}
                </p>
                {body && (
                  <p className="mt-0.5 text-[13px] leading-snug text-white/55">
                    {body}
                  </p>
                )}
                {copy.href && (
                  <span className="mt-1 inline-block text-[12px] font-semibold text-white/70">
                    {copy.action} →
                  </span>
                )}
              </div>
              <span className="shrink-0 whitespace-nowrap text-[11px] text-white/40">
                {relativeTime(n.createdAt)}
              </span>
            </>
          );

          const shell = isUnread
            ? 'flex w-full items-start gap-3 rounded-xl border border-white/25 bg-white/[0.06] p-3 text-left transition-colors hover:bg-white/10'
            : 'flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left opacity-70 transition-colors hover:opacity-100';

          return (
            <li key={n.id}>
              {copy.href ? (
                // Opening the destination is the read signal — a row you acted
                // on is a row you dealt with.
                <Link
                  href={copy.href}
                  onClick={() => {
                    if (isUnread) void onRead(n.id);
                  }}
                  className={shell}
                >
                  {inner}
                  {isUnread && <span className="sr-only">, unread</span>}
                </Link>
              ) : isUnread ? (
                <button
                  type="button"
                  onClick={() => void onRead(n.id)}
                  className={shell}
                >
                  {inner}
                  <span className="sr-only">, unread — mark as read</span>
                </button>
              ) : (
                <div className={shell}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
