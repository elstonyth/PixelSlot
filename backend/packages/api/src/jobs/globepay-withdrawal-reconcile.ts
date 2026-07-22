import { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../modules/packs';
import type PacksModuleService from '../modules/packs/service';
import {
  globepayWithdrawalsEnabled,
  withdrawalRefundReference,
} from '../modules/packs/globepay-withdrawal';
import {
  GlobePayError,
  getWithdrawalDetail,
  globepayConfigFromEnv,
} from '../modules/packs/globepay-client';
import { notifyFeed } from '../modules/packs/notify-feed';
import { withdrawalFeedKey } from '../modules/packs/feed-events';
import {
  GLOBEPAY_RECONCILE_BATCH,
  GLOBEPAY_WD_SLOW_AFTER_MS,
  unknownWithdrawalAction,
  withdrawalReconcileAction,
} from '../modules/packs/globepay-reconcile';

/**
 * GlobePay365 withdrawal reconciliation.
 *
 * Higher stakes than the deposit sweep: every pending row here is a customer
 * balance already debited. A lost withdrawal callback must resolve to exactly
 * one of "the bank got it" (settle) or "the money comes back" (refund) — and
 * a crash between the ledger debit and SubmitWithdrawal resolves here too,
 * via the gateway's "not found" answer once the row is stale.
 *
 * The refund shares the callback route's idempotency anchor, so a sweep and a
 * late callback racing on the same payout refund exactly once.
 */
export default async function globepayWithdrawalReconcileJob(
  container: MedusaContainer,
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  if (!globepayWithdrawalsEnabled()) return;

  const packs = container.resolve<PacksModuleService>(PACKS_MODULE);
  const config = globepayConfigFromEnv();
  const now = new Date();

  const outstanding = await packs.listGlobePayWithdrawals(
    { status: 'pending' },
    { take: GLOBEPAY_RECONCILE_BATCH, order: { created_at: 'ASC' } },
  );
  if (outstanding.length === 0) return;

  let settled = 0;
  let refunded = 0;

  for (const withdrawal of outstanding) {
    try {
      let action;
      let gatewayStatus: number | null = null;
      try {
        const detail = await getWithdrawalDetail(
          withdrawal.merchant_transaction_id,
          config,
        );
        gatewayStatus = detail.statusId;
        action = withdrawalReconcileAction(detail.state);
      } catch (error) {
        const notFound =
          error instanceof GlobePayError &&
          (error.httpStatus === 400 || error.has('PMT10016'));
        if (!notFound) throw error;
        action = unknownWithdrawalAction(new Date(withdrawal.created_at), now);
      }

      if (action.kind === 'wait') {
        const age = now.getTime() - new Date(withdrawal.created_at).getTime();
        if (age > GLOBEPAY_WD_SLOW_AFTER_MS) {
          logger.error(
            `[globepay-wd-reconcile] payout ${withdrawal.merchant_transaction_id} still unresolved after ${Math.round(age / 3_600_000)}h — customer ${withdrawal.customer_id} has RM ${withdrawal.amount} in limbo; chase the provider`,
          );
        }
        continue;
      }

      if (action.kind === 'settle') {
        await packs.updateGlobePayWithdrawals({
          selector: { id: withdrawal.id, status: 'pending' },
          data: {
            status: 'settled',
            gateway_status: gatewayStatus,
            settled_at: now,
          },
        });
        settled += 1;
        logger.warn(
          `[globepay-wd-reconcile] settled ${withdrawal.merchant_transaction_id} from a REQUERY — the callback for this payout was never received`,
        );
        try {
          await notifyFeed(container, {
            receiverId: withdrawal.customer_id,
            template: 'withdrawal_paid',
            data: {
              amount_myr: Number(withdrawal.amount),
              reference:
                withdrawal.gateway_transaction_id ??
                withdrawal.merchant_transaction_id,
            },
            idempotencyKey: withdrawalFeedKey(
              withdrawal.merchant_transaction_id,
              'paid',
            ),
          });
        } catch {
          // Never fail a committed settle over a notification.
        }
        continue;
      }

      // refund: gateway says failed, or it never heard of a stale row.
      const refund = await packs.mutateCreditAtomic({
        customerId: withdrawal.customer_id,
        amount: Number(withdrawal.amount),
        reason: 'cashout',
        reference:
          withdrawal.gateway_transaction_id ??
          withdrawal.merchant_transaction_id,
        idempotencyReference: withdrawalRefundReference(
          withdrawal.customer_id,
          withdrawal.merchant_transaction_id,
        ),
      });
      await packs.updateGlobePayWithdrawals({
        selector: { id: withdrawal.id, status: 'pending' },
        data: { status: 'failed', gateway_status: gatewayStatus },
      });
      refunded += 1;
      if (!refund.replayed) {
        try {
          await notifyFeed(container, {
            receiverId: withdrawal.customer_id,
            template: 'withdrawal_refunded',
            data: {
              amount_myr: Number(withdrawal.amount),
              reference:
                withdrawal.gateway_transaction_id ??
                withdrawal.merchant_transaction_id,
            },
            idempotencyKey: withdrawalFeedKey(
              withdrawal.merchant_transaction_id,
              'refunded',
            ),
          });
        } catch {
          // Never fail a committed refund over a notification.
        }
      }
    } catch (error) {
      // One bad payout must not abort the sweep. It stays pending and is
      // retried next run.
      logger.error(
        `[globepay-wd-reconcile] ${withdrawal.merchant_transaction_id} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (settled || refunded) {
    logger.info(
      `[globepay-wd-reconcile] swept ${outstanding.length}: ${settled} settled, ${refunded} refunded`,
    );
  }
}

export const config = {
  name: 'globepay-withdrawal-reconcile',
  // Every 10 minutes, same cadence as deposits — a customer whose payout
  // callback was dropped waits minutes for resolution, not hours.
  schedule: '*/10 * * * *',
};
