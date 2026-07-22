import {
  globepayWithdrawalsEnabled,
  startGlobePayWithdrawal,
  withdrawalDetailsError,
  withdrawalIdempotencyReference,
  withdrawalRefundReference,
} from '../globepay-withdrawal';
import {
  unknownWithdrawalAction,
  withdrawalReconcileAction,
} from '../globepay-reconcile';

// startGlobePayWithdrawal talks to the gateway through globepay-client; stub
// that seam so these tests cover the MONEY ORDERING (row -> debit -> gateway,
// refund on refusal) rather than the HTTP layer.
jest.mock('../globepay-client', () => {
  const actual = jest.requireActual('../globepay-client');
  return {
    ...actual,
    globepayConfigFromEnv: jest.fn(() => ({
      baseUrl: 'https://mapi.example.test',
      merchantCode: 'Testpolycard',
      aesKey: 'test-aes-key',
      privateKey: 'priv',
      publicKey: 'pub',
      currencyCode: 'MYR',
    })),
    submitWithdrawal: jest.fn(),
  };
});

import { GlobePayError, submitWithdrawal } from '../globepay-client';

const submitMock = submitWithdrawal as jest.Mock;

function harness() {
  const packs = {
    createGlobePayWithdrawals: jest.fn().mockResolvedValue([{ id: 'gpw_1' }]),
    updateGlobePayWithdrawals: jest.fn().mockResolvedValue(undefined),
    mutateCreditAtomic: jest.fn().mockResolvedValue({
      id: 'ct_1',
      balance: 50,
      amount: -50,
      replayed: false,
      reference: null,
    }),
  };
  return {
    packs,
    scope: { resolve: () => packs } as never,
  };
}

const input = {
  customerId: 'cus_1',
  amount: 50,
  bankCode: 'MBB',
  accountNumber: '1234567890',
  accountHolderName: 'AHMAD BIN ALI',
  ipAddress: '1.2.3.4',
};

const start = (
  h: ReturnType<typeof harness>,
  over: Record<string, unknown> = {},
) =>
  startGlobePayWithdrawal(
    h.scope,
    { ...input, ...over },
    'https://us/notify-wd',
    'https://us/payout-verify',
  );

beforeEach(() => {
  submitMock.mockReset();
  submitMock.mockResolvedValue({ transactionId: 'W2026072200000001' });
  process.env.GLOBEPAY_ENABLED = 'true';
  process.env.GLOBEPAY_WITHDRAWALS_ENABLED = 'true';
  process.env.GLOBEPAY_MERCHANT_CODE = 'Testpolycard';
});

describe('globepayWithdrawalsEnabled', () => {
  it('is off unless BOTH switches are on and the merchant is configured', () => {
    expect(globepayWithdrawalsEnabled({})).toBe(false);
    expect(
      globepayWithdrawalsEnabled({
        GLOBEPAY_ENABLED: 'true',
        GLOBEPAY_MERCHANT_CODE: 'M',
      }),
    ).toBe(false);
    expect(
      globepayWithdrawalsEnabled({
        GLOBEPAY_WITHDRAWALS_ENABLED: 'true',
        GLOBEPAY_MERCHANT_CODE: 'M',
      }),
    ).toBe(false);
    expect(
      globepayWithdrawalsEnabled({
        GLOBEPAY_ENABLED: 'true',
        GLOBEPAY_WITHDRAWALS_ENABLED: 'true',
        GLOBEPAY_MERCHANT_CODE: 'M',
      }),
    ).toBe(true);
  });
});

describe('idempotency anchors', () => {
  it('debit and refund anchors NEVER collide, and are stable per payout', () => {
    const debit = withdrawalIdempotencyReference('cus_1', 'PC-abc');
    const refund = withdrawalRefundReference('cus_1', 'PC-abc');
    expect(debit).not.toBe(refund);
    expect(withdrawalIdempotencyReference('cus_1', 'PC-abc')).toBe(debit);
    expect(withdrawalRefundReference('cus_1', 'PC-abc')).toBe(refund);
    // Different customers or payouts -> different anchors.
    expect(withdrawalIdempotencyReference('cus_2', 'PC-abc')).not.toBe(debit);
    expect(withdrawalIdempotencyReference('cus_1', 'PC-def')).not.toBe(debit);
  });
});

describe('withdrawalDetailsError', () => {
  it('accepts sane bank details', () => {
    expect(withdrawalDetailsError(input)).toBeNull();
  });
  it.each([
    [{ ...input, bankCode: '' }, /bank/i],
    [{ ...input, bankCode: 'not a code!' }, /bank/i],
    [{ ...input, accountNumber: '12ab' }, /account number/i],
    [{ ...input, accountNumber: '12345' }, /account number/i],
    [{ ...input, accountHolderName: ' ' }, /holder name/i],
  ])('rejects bad details (%#)', (bad, message) => {
    expect(withdrawalDetailsError(bad)).toMatch(message);
  });
});

describe('startGlobePayWithdrawal — money ordering', () => {
  it('row, then DEBIT, then gateway — in that exact order', async () => {
    const h = harness();
    const order: string[] = [];
    h.packs.createGlobePayWithdrawals.mockImplementation(async () => {
      order.push('row');
      return [{ id: 'gpw_1' }];
    });
    h.packs.mutateCreditAtomic.mockImplementation(async () => {
      order.push('debit');
      return { id: 'ct_1', balance: 0, amount: -50, replayed: false };
    });
    submitMock.mockImplementation(async () => {
      order.push('gateway');
      return { transactionId: 'W1' };
    });

    await start(h);
    // Reversed, money could be queued to leave the merchant balance while the
    // customer's site balance still shows it.
    expect(order).toEqual(['row', 'debit', 'gateway']);
  });

  it('debits with floor 0 and the wd: anchor', async () => {
    const h = harness();
    await start(h);
    expect(h.packs.mutateCreditAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_1',
        amount: -50,
        reason: 'cashout',
        floor: 0,
        idempotencyReference: expect.stringMatching(/^wd:/),
      }),
    );
  });

  it('REFUNDS the debit and closes the row when the gateway refuses', async () => {
    const h = harness();
    submitMock.mockRejectedValue(new GlobePayError('nope', ['PMT10013'], 200));
    await expect(start(h)).rejects.toThrow(/could not start your withdrawal/i);

    // Second mutate call is the refund: positive amount, wd-refund: anchor.
    expect(h.packs.mutateCreditAtomic).toHaveBeenCalledTimes(2);
    expect(h.packs.mutateCreditAtomic.mock.calls[1][0]).toMatchObject({
      customerId: 'cus_1',
      amount: 50,
      reason: 'cashout',
    });
    expect(
      h.packs.mutateCreditAtomic.mock.calls[1][0].idempotencyReference,
    ).toMatch(/^wd-refund:/);
    expect(h.packs.updateGlobePayWithdrawals).toHaveBeenCalledWith({
      id: 'gpw_1',
      status: 'failed',
    });
  });

  it('closes the row WITHOUT refunding when the debit itself fails (insufficient balance)', async () => {
    const h = harness();
    h.packs.mutateCreditAtomic.mockRejectedValue(
      new Error('Insufficient credits'),
    );
    await expect(start(h)).rejects.toThrow(/insufficient/i);
    // Nothing was debited, so nothing to refund — one call only.
    expect(h.packs.mutateCreditAtomic).toHaveBeenCalledTimes(1);
    expect(submitMock).not.toHaveBeenCalled();
    expect(h.packs.updateGlobePayWithdrawals).toHaveBeenCalledWith({
      id: 'gpw_1',
      status: 'failed',
    });
  });

  it('stamps their W… id on the row after a successful submit', async () => {
    const h = harness();
    const result = await start(h);
    expect(h.packs.updateGlobePayWithdrawals).toHaveBeenCalledWith({
      id: 'gpw_1',
      gateway_transaction_id: 'W2026072200000001',
    });
    expect(result.transactionId).toBe('W2026072200000001');
    expect(result.balance).toBe(50);
  });

  it.each([29, 1001])(
    'rejects RM %s — outside the payout band — before any row or debit',
    async (amount) => {
      const h = harness();
      await expect(start(h, { amount })).rejects.toThrow(
        /between RM 30 and RM 1,000/,
      );
      expect(h.packs.createGlobePayWithdrawals).not.toHaveBeenCalled();
      expect(h.packs.mutateCreditAtomic).not.toHaveBeenCalled();
    },
  );

  it('rejects bad bank details before any row or debit', async () => {
    const h = harness();
    await expect(start(h, { accountNumber: 'abc' })).rejects.toThrow(
      /account number/i,
    );
    expect(h.packs.createGlobePayWithdrawals).not.toHaveBeenCalled();
    expect(h.packs.mutateCreditAtomic).not.toHaveBeenCalled();
  });

  it('refuses to run when withdrawals are not enabled', async () => {
    process.env.GLOBEPAY_WITHDRAWALS_ENABLED = 'false';
    const h = harness();
    await expect(start(h)).rejects.toThrow(/not open yet/i);
    expect(h.packs.mutateCreditAtomic).not.toHaveBeenCalled();
  });
});

describe('withdrawal reconcile decisions', () => {
  it('settles on success, refunds on failure, waits otherwise', () => {
    expect(withdrawalReconcileAction('success')).toEqual({ kind: 'settle' });
    expect(withdrawalReconcileAction('failed')).toEqual({ kind: 'refund' });
    expect(withdrawalReconcileAction('pending')).toEqual({ kind: 'wait' });
  });

  it('refunds an unknown payout only once it is too old for an in-flight submit', () => {
    const created = new Date('2026-07-22T10:00:00Z');
    expect(
      unknownWithdrawalAction(created, new Date('2026-07-22T10:30:00Z')),
    ).toEqual({ kind: 'wait' });
    expect(
      unknownWithdrawalAction(created, new Date('2026-07-22T11:30:00Z')),
    ).toEqual({ kind: 'refund' });
  });
});
