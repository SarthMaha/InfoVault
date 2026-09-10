import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  File,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Lock,
  Tag,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Paperclip
} from 'lucide-react';
import { encryptData } from '../lib/crypto';
import { vaultStorage } from '../lib/storage';
import { VaultItemData, VaultItemMetadata, StoredVaultItem } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  masterKey: CryptoKey;
  onItemAdded: (item: StoredVaultItem, decryptedData: VaultItemData) => void;
}

const CATEGORIES = [
  'Identity & Passport',
  'Legal & Contracts',
  'Financial & Tax',
  'Medical Records',
  'Insurance Policies',
  'Property & Deeds',
  'Personal Documents',
  'Other Important Files',
];

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  userId,
  masterKey,
  onItemAdded,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    // Limit to reasonable size for browser-side storage (e.g. 15MB)
    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File exceeds 15MB maximum size limit.');
      return;
    }

    setError(null);
    setFile(selectedFile);
    if (!title) {
      // Strip extension for cleaner default title
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(cleanName);
    }

    // Read preview if it's an image
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a document or file to encrypt.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a document title.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert file to Base64 data URL
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        try {
          const fileDataUrl = reader.result as string;

          const tags = tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          const itemId = crypto.randomUUID();
          const now = Date.now();

          const metadata: VaultItemMetadata = {
            id: itemId,
            userId,
            type: 'document',
            title: title.trim(),
            category,
            tags,
            favorite: false,
            createdAt: now,
            updatedAt: now,
            fileMeta: {
              originalName: file.name,
              mimeType: file.type || 'application/octet-stream',
              sizeBytes: file.size,
            },
          };

          const itemData: VaultItemData = {
            notes: notes.trim(),
            fileDataUrl,
          };

          // Encrypt data payload using AES-256-GCM
          const encryptedPayload = await encryptData(masterKey, itemData);

          const storedItem: StoredVaultItem = {
            metadata,
            encryptedData: encryptedPayload,
          };

          await vaultStorage.saveItem(storedItem);
          onItemAdded(storedItem, itemData);
          onClose();
        } catch (err: any) {
          setError(err.message || 'Failed to encrypt document.');
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file from disk.');
        setLoading(false);
      };
    } catch (err: any) {
      setError(err.message || 'Failed to upload and encrypt file.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Upload Important Document</h2>
              <p className="text-xs text-slate-400">Encrypted end-to-end before saving to vault</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop File Zone */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Document or File (PDF, Images, Scans, Documents, up to 15MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />

            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-950/20'
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/60'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <Upload className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-sm font-medium text-white mb-1">
                  Drag & drop your document here, or <span className="text-cyan-400 underline">browse</span>
                </p>
                <p className="text-xs text-slate-400">
                  Supports PDF, PNG, JPG, DOCX, TXT, XLSX, etc.
                </p>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-white truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatFileSize(file.size)} • {file.type || 'Binary Document'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium px-2 py-1"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setFilePreview(null);
                    }}
                    className="text-slate-400 hover:text-rose-400 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Small Image Preview */}
            {filePreview && (
              <div className="mt-2 p-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center max-h-36 overflow-hidden">
                <img src={filePreview} alt="Preview" className="max-h-32 rounded object-contain" />
              </div>
            )}
          </div>

          {/* Title and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Document Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Passport Scan 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tags (Comma separated)
            </label>
            <div className="relative">
              <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="urgent, tax, travel, medical, deed"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          {/* Confidential Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Confidential Description or Notes (Encrypted)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Original stored in safe deposit box #4. Valid until 2035."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 transition resize-none"
            />
          </div>

          {/* Security Banner */}
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-200/90 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              This file will be encrypted using <strong>AES-256-GCM</strong> with your unique master key before leaving your device's memory.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file || !title.trim()}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs sm:text-sm transition shadow-lg shadow-cyan-950/50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Encrypting & Saving...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Encrypt & Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
