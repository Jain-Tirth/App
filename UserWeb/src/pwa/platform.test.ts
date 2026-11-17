import { describe, expect, it } from 'vitest';
import { isIosSafari } from './platform';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15';
const IPAD_SAFARI_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const MAC_SAFARI = IPAD_SAFARI_DESKTOP_UA;

describe('isIosSafari', () => {
  it('detects Safari on iPhone', () => {
    expect(isIosSafari({ userAgent: IPHONE_SAFARI })).toBe(true);
  });
  it('detects iPadOS Safari that reports a Mac user agent with touch points', () => {
    expect(isIosSafari({ userAgent: IPAD_SAFARI_DESKTOP_UA, maxTouchPoints: 5 })).toBe(true);
  });
  it('rejects Chrome and Firefox on iOS', () => {
    expect(isIosSafari({ userAgent: IPHONE_CHROME })).toBe(false);
    expect(isIosSafari({ userAgent: IPHONE_FIREFOX })).toBe(false);
  });
  it('rejects Android Chrome and desktop Safari', () => {
    expect(isIosSafari({ userAgent: ANDROID_CHROME })).toBe(false);
    expect(isIosSafari({ userAgent: MAC_SAFARI, maxTouchPoints: 0 })).toBe(false);
  });
});
