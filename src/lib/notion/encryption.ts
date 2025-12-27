/**
 * Encryption helpers for Notion tokens
 * Uses AES-256-GCM for authenticated encryption
 * 
 * Security: Tokens are encrypted at rest using ENCRYPTION_KEY from environment
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment
 * Derives a key from ENCRYPTION_KEY using PBKDF2
 */
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  // Use a fixed salt for key derivation (stored in env or derived from a master key)
  // In production, consider using a key derivation service or hardware security module
  const salt = process.env.ENCRYPTION_SALT || 'mb-cockpit-notion-salt-v1';
  
  return crypto.pbkdf2Sync(encryptionKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string value
 * Returns base64-encoded string: salt:iv:tag:encrypted
 */
export function encryptString(plaintext: string): string {
  if (!plaintext) {
    return '';
  }
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive key with random salt for this encryption
    const derivedKey = crypto.pbkdf2Sync(
      process.env.ENCRYPTION_KEY!,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );
    
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    // Combine: salt:iv:tag:encrypted (all base64)
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      encrypted
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt string');
  }
}

/**
 * Decrypt a string value
 * Expects base64-encoded string: salt:iv:tag:encrypted
 */
export function decryptString(ciphertext: string): string {
  if (!ciphertext) {
    return '';
  }
  
  try {
    const combined = Buffer.from(ciphertext, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive key using the salt from ciphertext
    const derivedKey = crypto.pbkdf2Sync(
      process.env.ENCRYPTION_KEY!,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt string - invalid ciphertext or key');
  }
}

