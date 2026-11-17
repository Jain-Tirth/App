import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPORT_TTL_MS,
  clearAllExportRequests,
  exportKey,
  readExportRequest,
  saveExportRequest,
} from './exportRequest';

function installStorage() {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

describe('export request storage', () => {
  beforeEach(installStorage);

  it('keys by user id', () => {
    expect(exportKey('u1')).toContain('u1');
    saveExportRequest('u1', 'r1', 1000);
    expect(readExportRequest('u1', 2000)?.requestId).toBe('r1');
    expect(readExportRequest('u2', 2000)).toBeNull();
  });

  it('stores the request time', () => {
    saveExportRequest('u1', 'r1', 1000);
    expect(readExportRequest('u1', 1001)?.requestedAt).toBe(1000);
  });

  it('expires after 24 hours and removes the entry', () => {
    saveExportRequest('u1', 'r1', 0);
    expect(readExportRequest('u1', EXPORT_TTL_MS - 1)?.requestId).toBe('r1');
    expect(readExportRequest('u1', EXPORT_TTL_MS)).toBeNull();
    expect(localStorage.getItem(exportKey('u1'))).toBeNull();
  });

  it('discards unreadable values', () => {
    localStorage.setItem(exportKey('u1'), '{nope');
    expect(readExportRequest('u1')).toBeNull();
    expect(localStorage.getItem(exportKey('u1'))).toBeNull();
  });

  it('is cleared for every member at logout', () => {
    saveExportRequest('u1', 'r1');
    saveExportRequest('u2', 'r2');
    localStorage.setItem('other', 'keep');
    clearAllExportRequests();
    expect(readExportRequest('u1')).toBeNull();
    expect(readExportRequest('u2')).toBeNull();
    expect(localStorage.getItem('other')).toBe('keep');
  });
});
