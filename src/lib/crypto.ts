import { EncryptedPayload } from '../types';

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert string to Uint8Array
export function stringToBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to string
export function bufferToString(buffer: ArrayBuffer | Uint8Array): string {
  return new TextDecoder().decode(buffer);
}

// Generate random cryptographic salt as hex string
export function generateSaltHex(length: number = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert hex string to Uint8Array
export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derive Master Encryption Key (AES-GCM 256-bit) from password and salt
 */
export async function deriveMasterKey(password: string, saltHex: string): Promise<CryptoKey> {
  const salt = hexToBuffer(saltHex);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(password),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive Auth Hash for authentication verification (never store raw password)
 */
export async function deriveAuthHash(password: string, saltHex: string): Promise<string> {
  const salt = hexToBuffer(saltHex);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Extra iteration and salt tweak for distinct auth hash
  const tweakedSalt = new Uint8Array(salt.length + 4);
  tweakedSalt.set(salt);
  tweakedSalt.set([0x41, 0x55, 0x54, 0x48], salt.length); // 'AUTH' suffix

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: tweakedSalt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return bufferToBase64(derivedBits);
}

/**
 * Encrypt arbitrary plain text or JSON object with AES-GCM-256
 */
export async function encryptData(key: CryptoKey, data: any): Promise<EncryptedPayload> {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const encoded = stringToBuffer(jsonStr);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt AES-GCM-256 payload back into original data object
 */
export async function decryptData<T = any>(key: CryptoKey, payload: EncryptedPayload): Promise<T> {
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ciphertext
  );

  const jsonStr = bufferToString(decryptedBuffer);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return jsonStr as unknown as T;
  }
}

// ==================== TOTP / 2FA RFC 6238 ====================

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random Base32 TOTP secret (160 bits / 32 chars)
 */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_CHARS[bytes[i] % 32];
  }
  return secret;
}

/**
 * Decode Base32 string to Uint8Array
 */
function base32ToBuffer(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

/**
 * Generate TOTP code for a given timestamp and secret
 */
export async function generateTotpCode(secret: string, timestampMs: number = Date.now()): Promise<string> {
  const timeStep = 30; // 30 seconds
  const counter = Math.floor(timestampMs / 1000 / timeStep);
  
  // Counter as 8-byte big-endian buffer
  const counterBuffer = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const secretBuffer = base32ToBuffer(secret);
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', hmacKey, counterBuffer);
  const hmacBytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226)
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify TOTP code with time window tolerance (+- 1 step = +- 30s)
 */
export async function verifyTotpCode(secret: string, inputCode: string): Promise<boolean> {
  const cleanInput = inputCode.trim();
  if (cleanInput.length !== 6) return false;

  const now = Date.now();
  // Check current, previous (-30s), and next (+30s) steps
  const steps = [0, -30000, 30000];
  for (const offset of steps) {
    const code = await generateTotpCode(secret, now + offset);
    if (code === cleanInput) {
      return true;
    }
  }
  return false;
}

/**
 * Generate 8 emergency one-time recovery backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const chars = '0123456789ABCDEF';
  for (let i = 0; i < 8; i++) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let code = '';
    for (let j = 0; j < 6; j++) {
      code += chars[bytes[j] % 16];
    }
    codes.push(`${code.slice(0, 3)}-${code.slice(3, 6)}`);
  }
  return codes;
}

/**
 * Build OTPAuth URL for QR Code scanner
 */
export function buildOtpAuthUri(email: string, secret: string, issuer: string = 'SecureVault'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ==================== Password Tools ====================

export function generateSecurePassword(options: {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
} = {}): string {
  const {
    length = 20,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options;

  let pool = '';
  if (includeUppercase) pool += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  if (includeLowercase) pool += 'abcdefghijkmnopqrstuvwxyz';
  if (includeNumbers) pool += '23456789';
  if (includeSymbols) pool += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!pool) pool = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += pool[randomBytes[i] % pool.length];
  }
  return result;
}

export function evaluatePasswordStrength(password: string): {
  score: number; // 0 to 4
  entropyBits: number;
  label: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
  feedback: string[];
} {
  if (!password) {
    return { score: 0, entropyBits: 0, label: 'Very Weak', feedback: ['Password is empty'] };
  }

  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

  const entropyBits = Math.round(password.length * Math.log2(charsetSize || 1));
  const feedback: string[] = [];

  if (password.length < 12) feedback.push('Use at least 12 characters for strong security');
  if (!/[A-Z]/.test(password)) feedback.push('Include uppercase letters');
  if (!/[a-z]/.test(password)) feedback.push('Include lowercase letters');
  if (!/[0-9]/.test(password)) feedback.push('Include numbers');
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Include special symbols');

  let score = 0;
  if (entropyBits >= 80) score = 4;
  else if (entropyBits >= 60) score = 3;
  else if (entropyBits >= 40) score = 2;
  else if (entropyBits >= 24) score = 1;
  else score = 0;

  const labels: ('Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong')[] = [
    'Very Weak',
    'Weak',
    'Medium',
    'Strong',
    'Very Strong',
  ];

  return {
    score,
    entropyBits,
    label: labels[score],
    feedback: feedback.length === 0 ? ['Excellent, high entropy passphrase'] : feedback,
  };
}
