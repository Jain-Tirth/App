/** SHA-256 of the bytes as lowercase hex, via the platform's Web Crypto. */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  // Web Crypto takes ArrayBuffer-backed bytes only; a typed-array input is copied onto one.
  const bytes = new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256HexOfBlob(blob: Blob): Promise<string> {
  return sha256Hex(await blob.arrayBuffer());
}
