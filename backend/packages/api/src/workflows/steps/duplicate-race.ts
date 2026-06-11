// Insert-then-probe mapping for UNIQUE-constraint races, shared by every step
// whose advisory pre-check can lose to a concurrent writer (create-card's
// handle, buyback-pull's credit row — and any future ledger insert): run the
// insert; on failure, probe whether a row holding the contested key exists.
// If it does, the truthful outcome is "duplicate" regardless of what threw —
// surface the friendly error. If it doesn't, rethrow the ORIGINAL error; the
// probe gets its own guard so a probe that fails too (DB down) is logged but
// can never replace the original fault.
export async function insertOrMapDuplicate<T>(opts: {
  insert: () => Promise<T>;
  /** true when a row holding the contested unique key exists (the race's winner). */
  probeDuplicate: () => Promise<boolean>;
  /** Built lazily — the happy path never constructs it. */
  duplicateError: () => Error;
  logger: { warn: (message: string) => unknown };
  /** Step name for the log line, e.g. "create-card". */
  label: string;
}): Promise<T> {
  try {
    return await opts.insert();
  } catch (error) {
    let isDuplicate = false;
    try {
      isDuplicate = await opts.probeDuplicate();
    } catch (probeError) {
      opts.logger.warn(
        `${opts.label}: duplicate probe failed after insert error — surfacing the insert error. ${
          probeError instanceof Error ? probeError.message : String(probeError)
        }`
      );
    }
    if (isDuplicate) {
      throw opts.duplicateError();
    }
    throw error;
  }
}
