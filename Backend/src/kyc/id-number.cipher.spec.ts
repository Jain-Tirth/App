import { AesGcmIdNumberCipher } from './id-number.cipher';

describe('AesGcmIdNumberCipher', () => {
  const cipher = new AesGcmIdNumberCipher(Buffer.alloc(32, 9));

  it('round-trips an ID number', () => {
    expect(cipher.decrypt(cipher.encrypt('123456789012'))).toBe('123456789012');
  });

  it('does not store the number in clear and varies per call', () => {
    const first = cipher.encrypt('123456789012');

    expect(first).not.toContain('123456789012');
    expect(cipher.encrypt('123456789012')).not.toBe(first);
  });

  it('rejects a tampered value', () => {
    const parts = cipher.encrypt('ABCDE1234F').split('.');
    parts[3] = Buffer.from('tampered!!').toString('base64');

    expect(() => cipher.decrypt(parts.join('.'))).toThrow();
  });

  it('rejects an unknown format', () => {
    expect(() => cipher.decrypt('plain-text')).toThrow(/format/);
  });
});
