import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import type { INotificationModuleService } from '@medusajs/framework/types';
import { PACKS_MODULE } from '../../../../../modules/packs';
import type PacksModuleService from '../../../../../modules/packs/service';

// POST /store/notifications/:id/read
//
// Marks an in-app feed notification as read for the authenticated customer.
//
// IDOR guard: the notification is fetched scoped to both the supplied id AND
// the verified bearer's actor_id as receiver_id — a missing row returns 404
// and never reveals whether that id belongs to another customer.
//
// Idempotent: if a notification_read row already exists for this
// (notification_id, customer_id) pair, the existing read_at is returned
// without creating a duplicate (unique index in Task 1 would also reject it,
// but the check-then-create pattern returns the original timestamp instead of
// throwing a conflict error).
//
// Auth + rate-limit middleware is registered in src/api/middlewares.ts.
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Unauthorized');
  }
  const notificationId = req.params.id;

  // IDOR guard: retrieve the notification by id, then verify ownership.
  // Using retrieveNotification (by id) + manual receiver_id check prevents
  // the type error from FilterableNotificationProps lacking an `id` field,
  // while preserving the no-existence-leak guarantee (NOT_FOUND either way).
  const notif = req.scope.resolve<INotificationModuleService>(
    Modules.NOTIFICATION,
  );
  let owned: Awaited<ReturnType<typeof notif.retrieveNotification>> | null;
  try {
    owned = await notif.retrieveNotification(notificationId);
  } catch {
    owned = null;
  }
  // Fail-closed: treat wrong owner as not-found (no existence leak).
  if (!owned || owned.receiver_id !== customerId || owned.channel !== 'feed') {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'Notification not found',
    );
  }

  // Upsert: check-then-create to return the original read_at on a replay.
  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const [existing] = await packs.listNotificationReads(
    { notification_id: notificationId, customer_id: customerId },
    { take: 1 },
  );
  if (existing) {
    res.json({ id: notificationId, read_at: existing.read_at });
    return;
  }

  const now = new Date();
  await packs.createNotificationReads({
    notification_id: notificationId,
    customer_id: customerId,
    read_at: now,
  });
  res.json({ id: notificationId, read_at: now });
}
