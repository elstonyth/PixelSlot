// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getConsent, setConsent, CONSENT_KEY } from '../consent';

describe('consent store', () => {
  beforeEach(() => localStorage.clear());

  it('returns null before any choice', () => {
    expect(getConsent()).toBeNull();
  });

  it('persists and reads back an accepted choice', () => {
    setConsent('accepted');
    expect(getConsent()).toBe('accepted');
    expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted');
  });

  it('ignores an unrecognised stored value', () => {
    localStorage.setItem(CONSENT_KEY, 'garbage');
    expect(getConsent()).toBeNull();
  });
});
