import { StoredVaultItem, VaultItemData, VaultItemMetadata } from '../types';
import { encryptData } from './crypto';
import { vaultStorage } from './storage';

export async function seedSampleVaultData(
  userId: string,
  masterKey: CryptoKey
): Promise<{ stored: StoredVaultItem[]; decryptedMap: Record<string, VaultItemData> }> {
  const now = Date.now();

  const samples: { meta: Omit<VaultItemMetadata, 'id' | 'userId' | 'createdAt' | 'updatedAt'>; data: VaultItemData }[] = [
    {
      meta: {
        type: 'document',
        title: 'Emergency Medical Summary & Insurance Policy',
        category: 'Medical Records',
        tags: ['health', 'urgent', 'insurance', 'emergency'],
        favorite: true,
        fileMeta: {
          originalName: 'Medical_Record_Summary_2026.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 124500,
        },
      },
      data: {
        notes: 'Emergency Blood Type: O-Positive. Allergies: Penicillin. Primary Physician: Dr. Sarah Vance (+1-555-0199). Health Insurance Policy #MED-9948201-B.',
        // A minimal valid placeholder PDF data URI
        fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoyIDAgb2JqCjw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbMyAwIFJdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL0NvbnRlbnRzIDQgMCBSID4+CmVuZG9iago0IDAgb2JqCjw8IC9MZW5ndGggNTAgPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRECihTZWN1cmVWYXVsdCBFbmNyeXB0ZWQgTWVkaWNhbCBSZWNvcmQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDExNyAwMDAwMCBuIAowMDAwMDAwMjE2IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNSA+PgpzdGFydHhyZWYKMzE2CiUlRU9GCg==',
      },
    },
    {
      meta: {
        type: 'identity',
        title: 'United States Official Passport',
        category: 'Identity Records',
        tags: ['travel', 'passport', 'gov-id'],
        favorite: true,
      },
      data: {
        idType: 'passport',
        idNumber: '984128503',
        fullName: 'ALEXANDER D. MORGAN',
        issueDate: '2023-04-12',
        expiryDate: '2033-04-11',
        country: 'United States of America',
        notes: 'Passport holder in home safe. Duplicate certified copy with family attorney.',
      },
    },
    {
      meta: {
        type: 'financial',
        title: 'Premier Infinite Rewards Visa',
        category: 'Banking & Cards',
        tags: ['finance', 'travel-card', 'primary'],
        favorite: true,
      },
      data: {
        accountType: 'credit_card',
        bankName: 'Chase Sapphire Reserve',
        cardHolder: 'Alexander D Morgan',
        cardNumber: '4147209384729104',
        cardExpiry: '08/29',
        cardCvv: '742',
        notes: 'Travel concierge: 1-800-436-7970. Lost or stolen replacement hotline priority member line.',
      },
    },
    {
      meta: {
        type: 'login',
        title: 'Primary Cloud Infrastructure & Email',
        category: 'Credentials & Logins',
        tags: ['tech', 'admin', 'critical'],
        favorite: false,
      },
      data: {
        username: 'alex.morgan@cybervault.internal',
        password: 'K9#m$X8pQ2@vW7z!L4tR',
        url: 'https://console.cloud.google.com',
        notes: 'Physical FIDO2 YubiKey required for hardware 2FA step.',
      },
    },
    {
      meta: {
        type: 'note',
        title: 'Family Safe Combination & Emergency Estate Plan',
        category: 'Confidential Notes',
        tags: ['safe', 'emergency', 'estate'],
        favorite: true,
      },
      data: {
        notes: `Master Fireproof Safe Location: Master bedroom closet, concealed sub-floor.
Combination: Turn Right 4 times to 72 -> Left 3 times to 18 -> Right 2 times to 39 -> Turn Left to stop at 04.

Emergency Legal Executor:
Evelyn Sterling, Attorney at Law
Sterling & Ross LLP, Suite 400
Direct Phone: (555) 234-8901
File Ref: #ESTATE-2026-ADM`,
      },
    },
  ];

  const stored: StoredVaultItem[] = [];
  const decryptedMap: Record<string, VaultItemData> = {};

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const itemId = crypto.randomUUID();
    const metadata: VaultItemMetadata = {
      id: itemId,
      userId,
      createdAt: now - (samples.length - i) * 3600000,
      updatedAt: now - (samples.length - i) * 3600000,
      ...s.meta,
    };

    const encryptedData = await encryptData(masterKey, s.data);
    const item: StoredVaultItem = { metadata, encryptedData };
    await vaultStorage.saveItem(item);
    stored.push(item);
    decryptedMap[itemId] = s.data;
  }

  return { stored, decryptedMap };
}
