import { MedusaError } from '@medusajs/framework/utils';

/**
 * Extracts and validates `reason` from a request body.
 * Required, 1–500 chars, trimmed. Mirrors the freeze-route inline check
 * but extracted so it can be reused without duplication.
 */
export function reqReason(body: unknown): string {
  const reason = (body as Record<string, unknown> | null)?.reason;
  if (
    typeof reason !== 'string' ||
    reason.trim().length === 0 ||
    reason.length > 500
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'A reason (1–500 chars) is required.',
    );
  }
  return reason.trim();
}
