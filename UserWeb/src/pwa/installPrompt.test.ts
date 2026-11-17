import { describe, expect, it } from 'vitest';
import { installPromptMode } from './installPrompt';

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
