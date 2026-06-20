export type ConsentState = 'accepted' | 'rejected';
export const CONSENT_KEY = 'pokenic.cookie-consent';

export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === 'accepted' || v === 'rejected' ? v : null;
}

export function setConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_KEY, state);
  // Mirror to a cookie so server middleware can read it later if needed.
  document.cookie = `${CONSENT_KEY}=${state}; path=/; max-age=31536000; SameSite=Lax`;
}
