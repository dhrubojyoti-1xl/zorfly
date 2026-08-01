import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function deriveKey(hashKey: string): Buffer {
  return createHash('sha256').update(`${hashKey}:candidate-pii`).digest();
}

/** Encrypts a candidate PII field (email, name, phone) at rest. */
export function encryptPii(hashKey: string, plaintext: string): Uint8Array<ArrayBuffer> {
  const key = deriveKey(hashKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  const out = new Uint8Array(combined.byteLength);
  out.set(combined);
  return out;
}

export function decryptPii(hashKey: string, ciphertext: Uint8Array): string {
  const key = deriveKey(hashKey);
  const buffer = Buffer.from(ciphertext);
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** Deterministic lookup hash for a normalized email — never used for decryption. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
