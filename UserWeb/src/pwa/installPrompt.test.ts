import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPromptMode, rememberShown, wasShown } from './installPrompt';

describe('shown-once flag', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  it('is false until recorded, then true', () => {
    expect(wasShown('u1')).toBe(false);
    rememberShown('u1');
    expect(wasShown('u1')).toBe(true);
  });
  it('is per user id', () => {
    rememberShown('u1');
    expect(wasShown('u2')).toBe(false);
  });
  it('is false when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(wasShown('u1')).toBe(false);
  });
});

const base = { installed: false, dismissed: false, hasNativeEvent: false, iosSafari: false };

describe('installPromptMode', () => {
  it('uses the captured event on Chromium', () => {
    expect(installPromptMode({ ...base, hasNativeEvent: true })).toBe('native');
  });
  it('shows the manual instruction on iOS Safari', () => {
    expect(installPromptMode({ ...base, iosSafari: true })).toBe('ios-manual');
  });
  it('shows nothing when no install route exists', () => {
    expect(installPromptMode(base)).toBeNull();
  });
  it('never shows after dismissal or install', () => {
    expect(installPromptMode({ ...base, hasNativeEvent: true, dismissed: true })).toBeNull();
    expect(installPromptMode({ ...base, iosSafari: true, dismissed: true })).toBeNull();
    expect(installPromptMode({ ...base, hasNativeEvent: true, installed: true })).toBeNull();
  });
});
