// Global fail-closed redemption gate (spec §13). Default OFF: redemption stays
// dark until REWARDS_REDEMPTION_ENABLED is explicitly set to the string 'true'.
// Guards the CLAIM + DRAW paths (which mint value); WITHDRAW is balance-neutral
// and intentionally NOT gated (its only limit is the per-day cap in
// recordRewardWithdrawal).
export const rewardsRedemptionEnabled = (): boolean =>
  process.env.REWARDS_REDEMPTION_ENABLED === 'true';
