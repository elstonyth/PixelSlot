import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import type { INotificationModuleService } from '@medusajs/framework/types';
import { PACKS_MODULE } from '../../../../modules/packs';
import type PacksModuleService from '../../../../modules/packs/service';

// POST /store/notifications/read-all
//
// Marks every currently-unread feed notification read for the authenticated
// customer, in one request.
//
// Why this exists: toasts are driven by a client-side watermark and never write
// read_at (so the bell badge and the toast keep answering different questions).
// That means notifications accumulate as unread indefinitely, and the per-id
// limiter (20/10s) makes a client-side loop over 50 rows impossible. This is
// the only way to clear the badge.
//
// Owner-scoping: receiver_id comes ONLY from the verified bearer token, never
// from the body. The write set is derived from that same owner-scoped list, so
// there is no id input to forge.
//
// Idempotent: rows that already have a notification_read entry are skipped, so
// a second call marks 0 and leaves the original timestamps intact.
//
// Auth + rate-limit middleware is registered in src/api/middlewares.ts.
//
// Page size mirrors RECENT_NOTIFICATIONS in the sibling list route: the feed UI
// only ever shows that page, so "mark all read" means "mark all the customer
// can actually see".
const RECENT_NOTIFICATIONS = 50;

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Unauthorized');
  }

  const notif = req.scope.resolve<INotificationModuleService>(
    Modules.NOTIFICATION,
  );
  const notifications = await notif.listNotifications(
    { receiver_id: customerId, channel: 'feed' },
    { take: RECENT_NOTIFICATIONS, order: { created_at: 'DESC' } },
  );

  const now = new Date();
  if (notifications.length === 0) {
    res.json({ marked: 0, read_at: now.toISOString() });
    return;
  }

  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const ids = notifications.map((n) => n.id);
  const existing = await packs.listNotificationReads(
    { customer_id: customerId, notification_id: ids },
    { take: ids.length },
  );
  const alreadyRead = new Set(
    existing.map((r: { notification_id: string }) => r.notification_id),
  );

  const toCreate = ids
    .filter((id) => !alreadyRead.has(id))
    .map((id) => ({
      notification_id: id,
      customer_id: customerId,
      read_at: now,
    }));

  if (toCreate.length === 0) {
    res.json({ marked: 0, read_at: now.toISOString() });
    return;
  }

  try {
    await packs.createNotificationReads(toCreate);
  } catch {
    // TOCTOU: a concurrent per-id mark-read may have inserted between the read
    // above and this write, tripping the (notification_id, customer_id) unique
    // index. Re-derive what is actually unread and report that, rather than
    // failing a request whose intent ("leave nothing unread") is satisfied.
    const after = await packs.listNotificationReads(
      { customer_id: customerId, notification_id: ids },
      { take: ids.length },
    );
    res.json({
      marked: Math.max(0, after.length - existing.length),
      read_at: now.toISOString(),
    });
    return;
  }

  res.json({ marked: toCreate.length, read_at: now.toISOString() });
}
