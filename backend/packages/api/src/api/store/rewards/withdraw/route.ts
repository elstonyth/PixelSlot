import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../../../modules/packs';
import type PacksModuleService from '../../../../modules/packs/service';

// POST /store/rewards/withdraw — ship a vaulted reward-prize Pull as a physical
// delivery. Body: { pull_id, address_id }.
//
// NOT env-gated: a withdrawal is balance-neutral (it ships a prize the customer
// already owns), so the global redemption gate does NOT apply here — the only
// limit is the withdrawals_per_day cap enforced inside recordRewardWithdrawal.
//
// OWNERSHIP: recordRewardWithdrawal snapshots the address VERBATIM and trusts the
// route for ownership (mirroring requestDeliveryStep). So this route MUST resolve
// the address from the CALLER's own address book (id + customer_id scoped) and 404
// on a miss BEFORE handing it down — otherwise a caller could ship a prize to an
// address id that isn't theirs. The Pull's ownership + reward-source + vaulted
// state are re-validated under the lock inside recordRewardWithdrawal.
//
// AUTH + RATE LIMIT: registered in api/middlewares.ts. The customer id comes ONLY
// from the verified bearer token, never the body.
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Unauthorized');
  }

  const body = req.body as
    | { pull_id?: unknown; address_id?: unknown }
    | undefined;
  const pullId = body?.pull_id;
  const addressId = body?.address_id;
  if (
    typeof pullId !== 'string' ||
    pullId.trim() === '' ||
    typeof addressId !== 'string' ||
    addressId.trim() === ''
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      '`pull_id` (string) and `address_id` (string) are required.',
    );
  }

  // Resolve + ownership-check the address against the caller's own address book.
  // A foreign or unknown id misses this scoped lookup → 404 (no cross-account
  // leak). recordRewardWithdrawal snapshots whatever it is handed, so this guard
  // is the ownership boundary for the shipping address.
  const customerModule = req.scope.resolve(Modules.CUSTOMER);
  const [address] = await customerModule.listCustomerAddresses(
    { id: addressId, customer_id: customerId },
    { take: 1 },
  );
  if (!address) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'Shipping address not found.',
    );
  }

  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const result = await packs.recordRewardWithdrawal(customerId, pullId, address);
  res.json(result);
}
