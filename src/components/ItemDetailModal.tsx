import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  Trash2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Key,
  CreditCard,
  UserCheck,
  File,
  AlertCircle,
  Tag,
  Clock,
  RefreshCw
} from 'lucide-react';
import { decryptData } from '../lib/crypto';
import { StoredVaultItem, VaultItemData } from '../types';

interface ItemDetailModalProps {
  item: StoredVaultItem | null;
  decryptedData?: VaultItemData;
  masterKey: CryptoKey;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCacheDecrypted: (id: string, data: VaultItemData) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  decryptedData,
  masterKey,
  onClose,
  onDelete,
  onCacheDecrypted,
}) => {
  const [data, setData] = useState<VaultItemData | null>(decryptedData || null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showIdNumber, setShowIdNumber] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCipherInfo, setShowCipherInfo] = useState(false);

  useEffect(() => {
    if (!item) return;

    if (decryptedData) {
      setData(decryptedData);
      return;
    }

    const decryptItem = async () => {
      setDecrypting(true);
      setDecryptError(null);
      try {
        const decrypted = await decryptData<VaultItemData>(masterKey, item.encryptedData);
        setData(decrypted);
        onCacheDecrypted(item.metadata.id, decrypted);
      } catch (err: any) {
        setDecryptError('Failed to decrypt item with master key: ' + (err.message || 'Cipher error'));
      } finally {
        setDecrypting(false);
      }
    };

    decryptItem();
  }, [item, decryptedData, masterKey]);

  if (!item) return null;

  const { metadata, encryptedData } = item;

  const copyField = (text: string | undefined, keyName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadFile = () => {
    if (!data?.fileDataUrl || !metadata.fileMeta) return;

    const link = document.createElement('a');
    link.href = data.fileDataUrl;
    link.download = metadata.fileMeta.originalName || `${metadata.title}.dat`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              {metadata.type}
            </span>
            <span className="text-xs text-slate-400 font-medium">{metadata.category}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCipherInfo(!showCipherInfo)}
              className="text-xs text-slate-400 hover:text-cyan-400 font-mono px-2 py-1 rounded-lg hover:bg-slate-800 transition"
              title="Show AES-256 cipher payload"
            >
              Cipher Stats
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {/* Header Title & Date */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {metadata.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
              <span>
                Added {new Date(metadata.createdAt).toLocaleDateString()} at{' '}
                {new Date(metadata.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span>•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> AES-256-GCM
              </span>
            </div>
          </div>

          {/* Decrypting spinner */}
          {decrypting && (
            <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <p className="text-xs font-mono">Decrypting payload in-memory with derived Master Key...</p>
            </div>
          )}

          {/* Decrypt Error */}
          {decryptError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{decryptError}</span>
            </div>
          )}

          {/* Cipher Debug Info drawer */}
          {showCipherInfo && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1.5">
              <div className="text-cyan-400 font-semibold mb-1">Encrypted Payload Metadata (Zero-Knowledge)</div>
              <div><span className="text-slate-500">IV (12 bytes):</span> {encryptedData.iv}</div>
              <div>
                <span className="text-slate-500">Ciphertext:</span>{' '}
                <span className="break-all">{encryptedData.ciphertext.slice(0, 80)}...</span>
              </div>
              <div><span className="text-slate-500">Payload length:</span> {encryptedData.ciphertext.length} chars</div>
            </div>
          )}

          {/* Main Decrypted Content Render */}
          {data && !decrypting && (
            <div className="space-y-4">
              {/* 1. DOCUMENT VIEW */}
              {metadata.type === 'document' && (
                <div className="space-y-4">
                  {/* File Metadata Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm truncate max-w-[280px]">
                          {metadata.fileMeta?.originalName || metadata.title}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono">
                          {formatFileSize(metadata.fileMeta?.sizeBytes)} • {metadata.fileMeta?.mimeType}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition shadow-md shadow-cyan-950/50 flex items-center gap-2 shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      Download Decrypted File
                    </button>
                  </div>

                  {/* Image Document Preview if applicable */}
                  {data.fileDataUrl && metadata.fileMeta?.mimeType.startsWith('image/') && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center">
                      <div className="text-[11px] text-slate-400 font-mono mb-2">Decrypted In-Memory Preview</div>
                      <img
                        src={data.fileDataUrl}
                        alt="Decrypted Document"
                        className="max-h-96 rounded-lg object-contain shadow"
                      />
                    </div>
                  )}

                  {/* PDF Document Preview notice */}
                  {data.fileDataUrl && metadata.fileMeta?.mimeType.includes('pdf') && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center">
                      <FileText className="w-12 h-12 text-cyan-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white mb-1">Encrypted PDF Document</p>
                      <p className="text-xs text-slate-400 mb-4">
                        This confidential PDF was decrypted directly into browser memory. Click below to view or save.
                      </p>
                      <button
                        type="button"
                        onClick={handleDownloadFile}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-medium inline-flex items-center gap-2 transition"
                      >
                        <Download className="w-4 h-4" /> Open / Save Decrypted PDF
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. LOGIN CREDENTIALS VIEW */}
              {metadata.type === 'login' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800">
                  {data.username && (
                    <div className="p-3.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Username / Email</span>
                        <span className="text-sm font-mono text-white font-medium">{data.username}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyField(data.username, 'username')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
                      >
                        {copiedKey === 'username' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  {data.password && (
                    <div className="p-3.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Password</span>
                        <span className="text-sm font-mono text-white font-medium">
                          {showPassword ? data.password : '••••••••••••••••'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyField(data.password, 'password')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
                        >
                          {copiedKey === 'password' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {data.url && (
                    <div className="p-3.5 flex items-center justify-between gap-4">
                      <div className="truncate">
                        <span className="text-[11px] text-slate-500 font-medium block">Website</span>
                        <span className="text-sm font-mono text-cyan-400 truncate block">{data.url}</span>
                      </div>
                      <a
                        href={data.url.startsWith('http') ? data.url : `https://${data.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* 3. IDENTITY DETAILS VIEW */}
              {metadata.type === 'identity' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Document Type
                      </span>
                      <h4 className="text-base font-bold text-white uppercase">{data.idType || 'Official Document'}</h4>
                    </div>
                    {data.country && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-medium">
                        {data.country}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.fullName && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Full Name</span>
                        <span className="text-sm text-white font-medium">{data.fullName}</span>
                      </div>
                    )}

                    {data.idNumber && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Document / Number</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-white font-medium">
                            {showIdNumber ? data.idNumber : '•••• •••• ' + data.idNumber.slice(-4)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowIdNumber(!showIdNumber)}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {showIdNumber ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyField(data.idNumber, 'idNumber')}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {copiedKey === 'idNumber' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {data.issueDate && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Issue Date</span>
                        <span className="text-sm text-slate-300 font-mono">{data.issueDate}</span>
                      </div>
                    )}

                    {data.expiryDate && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Expiration Date</span>
                        <span className="text-sm text-slate-300 font-mono">{data.expiryDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. FINANCIAL & BANKING VIEW */}
              {metadata.type === 'financial' && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-base font-bold text-white">{data.bankName || 'Financial Institution'}</span>
                    <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      {data.accountType?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.cardHolder && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Cardholder</span>
                        <span className="text-sm text-white font-medium">{data.cardHolder}</span>
                      </div>
                    )}

                    {data.cardNumber && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Card Number</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-white font-medium">
                            {showCardNumber ? data.cardNumber : '•••• •••• •••• ' + data.cardNumber.slice(-4)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCardNumber(!showCardNumber)}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {showCardNumber ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyField(data.cardNumber, 'cardNumber')}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {copiedKey === 'cardNumber' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {data.cardExpiry && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Expires</span>
                        <span className="text-sm font-mono text-slate-300">{data.cardExpiry}</span>
                      </div>
                    )}

                    {data.cardCvv && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">CVV / Security Code</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-white font-medium">
                            {showCvv ? data.cardCvv : '•••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCvv(!showCvv)}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {showCvv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyField(data.cardCvv, 'cardCvv')}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {copiedKey === 'cardCvv' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {data.accountNumber && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Account Number</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-white font-medium">{data.accountNumber}</span>
                          <button
                            type="button"
                            onClick={() => copyField(data.accountNumber, 'accountNumber')}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {copiedKey === 'accountNumber' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {data.routingNumber && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">Routing / Sort Code</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-slate-300">{data.routingNumber}</span>
                          <button
                            type="button"
                            onClick={() => copyField(data.routingNumber, 'routingNumber')}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {copiedKey === 'routingNumber' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. NOTES (FOR ALL TYPES OR SECURE NOTE) */}
              {data.notes && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">Confidential Notes / Details</span>
                    <button
                      type="button"
                      onClick={() => copyField(data.notes, 'notes')}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedKey === 'notes' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Notes
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap break-words leading-relaxed">
                    {data.notes}
                  </pre>
                </div>
              )}

              {/* Custom fields display if any */}
              {data.customFields && data.customFields.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block mb-2">Custom Fields</span>
                  {data.customFields.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                      <span className="text-slate-400 font-medium">{f.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white">{f.value}</span>
                        <button
                          type="button"
                          onClick={() => copyField(f.value, `custom_${i}`)}
                          className="text-slate-500 hover:text-white"
                        >
                          {copiedKey === `custom_${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {metadata.tags && metadata.tags.length > 0 && (
                <div className="flex items-center gap-1.5 pt-2">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={() => {
              onDelete(metadata.id);
              onClose();
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete Item
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
