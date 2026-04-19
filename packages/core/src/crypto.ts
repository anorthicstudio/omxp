// ─────────────────────────────────────────────────────────────────────────────
// OMXP Cryptographic Utilities
// Built on Node.js crypto — no external libraries
// ─────────────────────────────────────────────────────────────────────────────

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  sign,
  verify,
  createHash,
} from 'crypto';

// ─── Key Generation ─────────────────────────────────────────────────────────

export interface OmxpKeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateVaultKeyPair(): OmxpKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });
  return {
    publicKey: 'ed25519:' + publicKey.toString('base64'),
    privateKey: privateKey.toString('base64')
  };
}

// ─── ID & Token Generation ─────────────────────────────────────────────────

// nanoid-compatible alphabet (URL-safe)
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';

/** Generates a nanoid-style random string of the given length */
function nanoid(size: number): string {
  const bytes = randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

/** Generates a vault ID: "v_" + nanoid(12) */
export function generateVaultId(): string {
  return `v_${nanoid(12)}`;
}

/** Generates a memory unit ID: "mu_" + nanoid(10) */
export function generateMemoryId(): string {
  return `mu_${nanoid(10)}`;
}

/** Generates a generic ID with the given prefix (fallback for other entity types) */
export function generateId(prefix: string): string {
  return `${prefix}${nanoid(12)}`;
}

export function generateToken(prefix: string): string {
  return prefix + randomBytes(18).toString('base64url');
}

/** Generates a secure access token: "omxp_tok_" + base64url */
export function generateAccessToken(): string {
  return generateToken('omxp_tok_');
}

/** Generates a secure refresh token: "omxp_ref_" + base64url */
export function generateRefreshToken(): string {
  return generateToken('omxp_ref_');
}

/** Generates a one-time authorization code */
export function generateAuthCode(): string {
  return generateToken('omxp_code_');
}

/** SHA-256 hash of a token for safe database storage */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── AES-256-GCM Encryption ────────────────────────────────────────────────

/**
 * Derives a 256-bit symmetric encryption key from a private key.
 * Used for encrypting memory unit values at rest.
 */
export function deriveEncryptionKey(privateKey: string): Buffer {
  return createHash('sha256').update(privateKey).digest();
}

export function encryptMemory(data: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return iv.toString('base64') + ':' + 
         authTag.toString('base64') + ':' + 
         encrypted.toString('base64');
}

export function decryptMemory(encryptedData: string, key: Buffer): string {
  const [ivB64, authTagB64, dataB64] = encryptedData.split(':') as [string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final('utf8');
}

// ─── Signing ────────────────────────────────────────────────────────────────

/** Signs data with the user's Ed25519 private key */
export function signPayload(data: string, privateKeyPem: string): string {
  const signature = sign(null, Buffer.from(data), privateKeyPem);
  return signature.toString('base64');
}

/** Verifies an Ed25519 signature against the public key */
export function verifySignature(
  data: string,
  signature: string,
  publicKeyPem: string,
): boolean {
  try {
    return verify(null, Buffer.from(data), publicKeyPem, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
