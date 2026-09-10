export type VaultItemType = 'document' | 'identity' | 'financial' | 'login' | 'note';

export interface VaultUser {
  id: string;
  email: string;
  authHash: string; // PBKDF2 derived hash for authentication
  saltHex: string; // Salt used for PBKDF2 key derivation
  twoFactorEnabled: boolean;
  totpSecret?: string; // Base32 encoded TOTP secret
  backupCodes?: string[]; // Hashed or plaintext emergency recovery codes
  createdAt: number;
  lastLoginAt: number;
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded encrypted bytes
  iv: string; // Base64 encoded 12-byte initialization vector
}

export interface VaultItemMetadata {
  id: string;
  userId: string;
  type: VaultItemType;
  title: string;
  category: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  fileMeta?: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
}

export interface VaultItemData {
  // Common
  notes?: string;
  
  // Document specific
  fileDataUrl?: string; // Decrypted base64 data URL for documents/images
  
  // Login specific
  username?: string;
  password?: string;
  url?: string;
  
  // Identity specific
  idType?: 'passport' | 'drivers_license' | 'national_id' | 'ssn' | 'other';
  idNumber?: string;
  fullName?: string;
  issueDate?: string;
  expiryDate?: string;
  country?: string;

  // Financial specific
  accountType?: 'bank_account' | 'credit_card' | 'debit_card' | 'crypto_wallet' | 'investment';
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardHolder?: string;

  // Custom fields
  customFields?: { label: string; value: string; isSecret?: boolean }[];
}

export interface StoredVaultItem {
  metadata: VaultItemMetadata;
  encryptedData: EncryptedPayload;
}

export interface DecryptedVaultItem extends VaultItemMetadata {
  data: VaultItemData;
}

export interface SecurityAuditSummary {
  totalItems: number;
  documentsCount: number;
  identitiesCount: number;
  financialCount: number;
  loginsCount: number;
  notesCount: number;
  twoFactorEnabled: boolean;
  weakPasswordsCount: number;
  reusedPasswordsCount: number;
  lastBackupDate?: number;
}
