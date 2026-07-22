import { createHash } from 'node:crypto';
import { MedusaError } from '@medusajs/framework/utils';
import { PACKS_MODULE } from './index';
import type PacksModuleService from './service';
import {
  globepayConfigFromEnv,
  submitWithdrawal,
  GlobePayError,
} from './globepay-client';
import { newMerchantTransactionId } from './globepay-deposit';

// The submit half of the GlobePay365 payout loop (method WD), the inverse of
// globepay-deposit.ts with the money ordering flipped:
//
//   DEBIT the ledger first (atomic, floor 0) -> write the pending row ->
//   SubmitWithdrawal. If the gateway refuses, REFUND the debit immediately.
//
// The debit-first ordering is the security property: real money must never be
// queued to leave the merchant balance while the customer's site balance still
// shows it. The refund path shares the row's idempotency anchor, so a crash
// between debit and refund is recoverable by the reconcile sweep, never a
// double refund.

/**
 * Per-transaction payout band. The provider has NOT confirmed payout-specific
 * limits (deposit band is RM 30–1000, confirmed 2026-07-22); until they do,
 * mirror it. Their own rejection names no numbers, so we say them.
 */
export const GLOBEPAY_WD_MIN_RM = 30;
export const GLOBEPAY_WD_MAX_RM = 1000;

/**
 * Withdrawals get their OWN switch on top of globepayEnabled(): deposits can
 * (and did) go live while payouts wait on the provider activating the WD
 * channel. Fail closed — absent config means "not open".
 */
export function globepayWithdrawalsEnabled(
  env: {
    GLOBEPAY_ENABLED?: string;
    GLOBEPAY_WITHDRAWALS_ENABLED?: string;
    GLOBEPAY_MERCHANT_CODE?: string;
  } = process.env,
): boolean {
  return (
    env.GLOBEPAY_ENABLED === 'true' &&
    env.GLOBEPAY_WITHDRAWALS_ENABLED === 'true' &&
    Boolean(env.GLOBEPAY_MERCHANT_CODE)
  );
}

/**
 * Idempotency anchor for the DEBIT row. Deterministic from (customer, our
 * reference) so a retried submit can never debit twice. Prefixed to stay
 * disjoint from every other anchor family in the ledger.
 */
export function withdrawalIdempotencyReference(
  customerId: string,
  merchantTransactionId: string,
): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ customerId, merchantTransactionId }))
    .digest('hex');
  return `wd:${digest}`;
}

/**
 * Idempotency anchor for the REFUND row of a failed payout. Derived from the
 * same inputs but a different prefix: however many times a failure is
 * observed (submit error, callback status 5, requery status 5 — any mix),
 * exactly one refund is appended.
 */
export function withdrawalRefundReference(
  customerId: string,
  merchantTransactionId: string,
): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ customerId, merchantTransactionId }))
    .digest('hex');
  return `wd-refund:${digest}`;
}

/** Bank account fields, validated at the boundary. Their API gives no field
 * length errors a customer could act on, so sanity-check here. */
export function withdrawalDetailsError(input: {
  bankCode?: unknown;
  accountNumber?: unknown;
  accountHolderName?: unknown;
}): string | null {
  const bankCode = input.bankCode;
  if (typeof bankCode !== 'string' || !/^[A-Z0-9]{2,20}$/.test(bankCode)) {
    return 'Choose a bank from the list.';
  }
  const accountNumber = input.accountNumber;
  if (
    typeof accountNumber !== 'string' ||
    !/^[0-9]{6,34}$/.test(accountNumber)
  ) {
    return 'Enter a valid account number (digits only).';
  }
  const holder = input.accountHolderName;
  if (
    typeof holder !== 'string' ||
    holder.trim().length < 2 ||
    holder.trim().length > 120
  ) {
    return 'Enter the account holder name exactly as the bank has it.';
  }
  return null;
}

export type StartWithdrawalInput = {
  /** From the verified token — NEVER the request body. */
  customerId: string;
  amount: unknown;
  bankCode: unknown;
  accountNumber: unknown;
  accountHolderName: unknown;
  /** The CUSTOMER's IP (they require it), not our server's. */
  ipAddress: string;
};

export type StartWithdrawalResult = {
  merchantTransactionId: string;
  /** Their withdrawal id (W…). */
  transactionId: string;
  amount: number;
  /** Ledger balance after the debit. */
  balance: number;
};

/**
 * Create a payout. Ordering is load-bearing:
 *   1. row (pending) — the callback needs it to find the customer
 *   2. ledger debit (atomic, floor 0, idempotent)
 *   3. SubmitWithdrawal
 * A gateway refusal refunds the debit and closes the row; a transient crash
 * after 2 leaves a pending row whose sweep resolves it (requery "not found"
 * -> refund).
 */
export async function startGlobePayWithdrawal(
  scope: { resolve: <T>(key: string) => T },
  input: StartWithdrawalInput,
  notifyUrl: string,
  verifyUrl: string,
): Promise<StartWithdrawalResult> {
  if (!globepayWithdrawalsEnabled()) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Withdrawals are not open yet.',
    );
  }

  const amount = input.amount;
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Enter a valid amount.',
    );
  }
  if (amount < GLOBEPAY_WD_MIN_RM || amount > GLOBEPAY_WD_MAX_RM) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Withdrawals must be between RM ${GLOBEPAY_WD_MIN_RM} and RM ${GLOBEPAY_WD_MAX_RM.toLocaleString('en-US')}.`,
    );
  }

  const detailsInvalid = withdrawalDetailsError(input);
  if (detailsInvalid) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, detailsInvalid);
  }
  const bankCode = input.bankCode as string;
  const accountNumber = input.accountNumber as string;
  const accountHolderName = (input.accountHolderName as string).trim();

  const config = globepayConfigFromEnv();
  const packs = scope.resolve<PacksModuleService>(PACKS_MODULE);
  const merchantTransactionId = newMerchantTransactionId();

  // 1) Row first — the callback echoes MerchantTransactionId but not our
  // customer id, so this row is the only way back (same shape as deposits).
  const [row] = await packs.createGlobePayWithdrawals([
    {
      merchant_transaction_id: merchantTransactionId,
      customer_id: input.customerId,
      amount,
      bank_code: bankCode,
      account_number: accountNumber,
      account_holder_name: accountHolderName,
      status: 'pending',
    },
  ]);

  // 2) Debit. floor 0 makes "insufficient balance" atomic with the balance
  // read — no separate check-then-debit race.
  let debit;
  try {
    debit = await packs.mutateCreditAtomic({
      customerId: input.customerId,
      amount: -amount,
      reason: 'cashout',
      reference: merchantTransactionId,
      idempotencyReference: withdrawalIdempotencyReference(
        input.customerId,
        merchantTransactionId,
      ),
      floor: 0,
    });
  } catch (error) {
    // Nothing was debited; the row must not sit pending or the sweep would
    // chase a withdrawal that never existed at the gateway.
    await packs.updateGlobePayWithdrawals({ id: row.id, status: 'failed' });
    throw error;
  }

  // 3) Only now is money allowed to move on their side.
  let result;
  try {
    result = await submitWithdrawal(
      {
        merchantTransactionId,
        merchantClientId: input.customerId,
        amount,
        destinationBankCode: bankCode,
        destinationAccountNumber: accountNumber,
        destinationAccountHolderName: accountHolderName,
        notifyUrl,
        returnUrl: verifyUrl,
        ipAddress: input.ipAddress,
      },
      config,
    );
  } catch (error) {
    // The gateway refused, so no payout exists on their side. Refund the debit
    // (idempotent) and close the row.
    await packs.mutateCreditAtomic({
      customerId: input.customerId,
      amount,
      reason: 'cashout',
      reference: merchantTransactionId,
      idempotencyReference: withdrawalRefundReference(
        input.customerId,
        merchantTransactionId,
      ),
    });
    await packs.updateGlobePayWithdrawals({ id: row.id, status: 'failed' });
    if (error instanceof GlobePayError) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'We could not start your withdrawal. Please check the bank details and try again.',
      );
    }
    throw error;
  }

  await packs.updateGlobePayWithdrawals({
    id: row.id,
    gateway_transaction_id: result.transactionId,
  });

  return {
    merchantTransactionId,
    transactionId: result.transactionId,
    amount,
    balance: debit.balance,
  };
}
